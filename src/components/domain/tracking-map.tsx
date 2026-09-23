"use client";

import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo/city-coords";

export type TrackingMapData = {
  origin: LatLng;
  dest: LatLng;
  current: LatLng;
  heading?: number | null;
  route: LatLng[];
  trail: Array<LatLng & { at?: string }>;
};

export function TrackingMap({ data, className }: { data: TrackingMapData; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{
    map: import("leaflet").Map;
    truck: import("leaflet").Marker;
    trail: import("leaflet").Polyline;
  } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !host.current) return;

      const map = L.map(host.current, { zoomControl: true, attributionControl: true }).setView([data.current.lat, data.current.lng], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 16,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      if (data.route.length > 1) {
        L.polyline(
          data.route.map((p) => [p.lat, p.lng] as [number, number]),
          { color: "#94a3b8", weight: 4, dashArray: "8 8", opacity: 0.8 },
        ).addTo(map);
      }
      const trail = L.polyline(
        data.trail.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#00b562", weight: 5, opacity: 0.95 },
      ).addTo(map);

      L.circleMarker([data.origin.lat, data.origin.lng], { radius: 8, color: "#0b1220", fillColor: "#0b1220", fillOpacity: 1 }).addTo(map);
      L.circleMarker([data.dest.lat, data.dest.lng], { radius: 8, color: "#6d28d9", fillColor: "#6d28d9", fillOpacity: 1 }).addTo(map);

      const truck = L.marker([data.current.lat, data.current.lng], {
        icon: L.divIcon({
          className: "tracking-truck",
          html: `<div style="transform:rotate(${data.heading ?? 0}deg)" class="grid h-10 w-10 place-items-center rounded-full bg-primary text-lg shadow-lg">🚚</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      }).addTo(map);

      const bounds = L.latLngBounds([
        [data.origin.lat, data.origin.lng],
        [data.dest.lat, data.dest.lng],
        [data.current.lat, data.current.lng],
      ]);
      map.fitBounds(bounds.pad(0.18));
      mapRef.current = { map, truck, trail };
    })();

    return () => {
      cancelled = true;
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
  }, [data.origin.lat, data.origin.lng, data.dest.lat, data.dest.lng]);

  useEffect(() => {
    const inst = mapRef.current;
    if (!inst) return;
    inst.truck.setLatLng([data.current.lat, data.current.lng]);
    inst.trail.setLatLngs(data.trail.map((p) => [p.lat, p.lng] as [number, number]));
  }, [data.current.lat, data.current.lng, data.trail]);

  return <div ref={host} dir="ltr" className={className ?? "h-[420px] w-full overflow-hidden rounded-3xl"} />;
}
