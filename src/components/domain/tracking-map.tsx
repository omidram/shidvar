"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo/city-coords";
import { fetchDrivingRoute, nearestOnRoute } from "@/lib/geo/osrm";

export type TrackingMapData = {
  origin: LatLng;
  dest: LatLng;
  current: LatLng;
  heading?: number | null;
  route: LatLng[];
  trail: Array<LatLng & { at?: string }>;
};

function asLatLngs(points: LatLng[]): [number, number][] {
  return points.map((p) => [p.lat, p.lng]);
}

/** Draw the OSM road, not a straight line between pings. */
export function TrackingMap({ data, className }: { data: TrackingMapData; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{
    map: import("leaflet").Map;
    truck: import("leaflet").Marker;
    traveled: import("leaflet").Polyline;
    remaining: import("leaflet").Polyline;
  } | null>(null);
  const [road, setRoad] = useState<LatLng[]>(data.route?.length > 8 ? data.route : []);

  useEffect(() => {
    let cancelled = false;
    const fallback = data.route?.length > 1 ? data.route : [data.origin, data.dest];
    void fetchDrivingRoute([data.origin, data.dest]).then((line) => {
      if (cancelled) return;
      setRoad(line && line.length > 8 ? line : fallback);
    });
    return () => {
      cancelled = true;
    };
  }, [data.origin.lat, data.origin.lng, data.dest.lat, data.dest.lng]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    const line = road.length > 1 ? road : [data.origin, data.dest];

    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !host.current) return;

      const snapIndex = nearestOnRoute(line, data.current);
      const snapped = line[snapIndex] ?? data.current;
      const traveled = line.slice(0, snapIndex + 1);
      const remaining = line.slice(snapIndex);

      const map = L.map(host.current, { zoomControl: true, attributionControl: true }).setView([snapped.lat, snapped.lng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const remainingLine = L.polyline(asLatLngs(remaining.length > 1 ? remaining : line), {
        color: "#94a3b8",
        weight: 6,
        opacity: 0.85,
      }).addTo(map);
      const traveledLine = L.polyline(asLatLngs(traveled.length > 1 ? traveled : [line[0], snapped]), {
        color: "#00b562",
        weight: 6,
        opacity: 0.95,
      }).addTo(map);

      L.circleMarker([data.origin.lat, data.origin.lng], { radius: 8, color: "#0b1220", fillColor: "#0b1220", fillOpacity: 1 }).addTo(map);
      L.circleMarker([data.dest.lat, data.dest.lng], { radius: 8, color: "#6d28d9", fillColor: "#6d28d9", fillOpacity: 1 }).addTo(map);

      const truck = L.marker([snapped.lat, snapped.lng], {
        icon: L.divIcon({
          className: "tracking-truck",
          html: `<div style="transform:rotate(${data.heading ?? 0}deg)" class="grid h-10 w-10 place-items-center rounded-full bg-primary text-lg shadow-lg">🚚</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      }).addTo(map);

      map.fitBounds(L.latLngBounds(asLatLngs(line)).pad(0.12));
      mapRef.current = { map, truck, traveled: traveledLine, remaining: remainingLine };
    })();

    return () => {
      cancelled = true;
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
  }, [road, data.origin.lat, data.origin.lng, data.dest.lat, data.dest.lng]);

  useEffect(() => {
    const inst = mapRef.current;
    const line = road.length > 1 ? road : [data.origin, data.dest];
    if (!inst || line.length < 2) return;
    const snapIndex = nearestOnRoute(line, data.current);
    const snapped = line[snapIndex] ?? data.current;
    inst.truck.setLatLng([snapped.lat, snapped.lng]);
    inst.traveled.setLatLngs(asLatLngs(line.slice(0, snapIndex + 1)));
    inst.remaining.setLatLngs(asLatLngs(line.slice(snapIndex)));
  }, [data.current.lat, data.current.lng, road]);

  return <div ref={host} dir="ltr" className={className ?? "h-[420px] w-full overflow-hidden rounded-3xl"} />;
}
