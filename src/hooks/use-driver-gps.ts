"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDriverGps(jobId: string | null, enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || !jobId || typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        void api(`/jobs/${jobId}/tracking`, {
          method: "POST",
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speedKmh: pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed * 3.6 : undefined,
            heading: pos.coords.heading != null && pos.coords.heading >= 0 ? pos.coords.heading : undefined,
          }),
        })
          .then(() => {
            void qc.invalidateQueries({ queryKey: ["tracking", jobId] });
            void qc.invalidateQueries({ queryKey: ["tracking-live"] });
          })
          .catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, jobId, qc]);
}

export function readPhonePosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geo-missing"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err.code === err.PERMISSION_DENIED ? new Error("geo-denied") : new Error("geo-failed")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
