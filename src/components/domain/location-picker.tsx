"use client";

import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo/city-coords";

/** Click on the map (or drag the pin) to choose a point. */
export function LocationPicker({ value, onChange, className }: { value: LatLng | null; onChange: (point: LatLng) => void; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const inst = useRef<{ map: import("leaflet").Map; marker: import("leaflet").Marker | null; L: typeof import("leaflet") } | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !host.current) return;
      const start = value ?? { lat: 35.6892, lng: 51.389 };
      const map = L.map(host.current).setView([start.lat, start.lng], value ? 14 : 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#00b562;transform:rotate(-45deg);border:3px solid #0b1220"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const place = (point: LatLng) => {
        if (!inst.current) return;
        if (inst.current.marker) inst.current.marker.setLatLng([point.lat, point.lng]);
        else {
          const marker = L.marker([point.lat, point.lng], { icon, draggable: true }).addTo(map);
          marker.on("dragend", () => {
            const p = marker.getLatLng();
            onChangeRef.current({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
          });
          inst.current.marker = marker;
        }
      };
      inst.current = { map, marker: null, L };
      if (value) place(value);
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        const point = { lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) };
        place(point);
        onChangeRef.current(point);
      });
    })();
    return () => {
      cancelled = true;
      inst.current?.map.remove();
      inst.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = inst.current;
    if (!current || !value) return;
    if (current.marker) current.marker.setLatLng([value.lat, value.lng]);
    else {
      const marker = current.L.marker([value.lat, value.lng], { draggable: true }).addTo(current.map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChangeRef.current({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
      });
      current.marker = marker;
    }
    current.map.setView([value.lat, value.lng], Math.max(current.map.getZoom(), 12));
  }, [value?.lat, value?.lng]);

  return <div ref={host} dir="ltr" className={className ?? "h-72 w-full overflow-hidden rounded-2xl border border-border"} />;
}
