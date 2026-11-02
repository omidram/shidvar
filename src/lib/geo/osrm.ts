import type { LatLng } from "@/lib/geo/city-coords";

const cache = new Map<string, LatLng[]>();

function keyOf(points: LatLng[]) {
  return points.map((point) => `${point.lng.toFixed(4)},${point.lat.toFixed(4)}`).join(";");
}

function endpoints(url: string, coords: string) {
  return `${url}/${coords}?overview=full&geometries=geojson&alternatives=false`;
}

/** Road geometry from OpenStreetMap routing. Falls back to null so callers can use the corridor polyline. */
export async function fetchDrivingRoute(points: LatLng[], signal?: AbortSignal): Promise<LatLng[] | null> {
  const usable = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (usable.length < 2) return null;
  const key = keyOf(usable);
  const hit = cache.get(key);
  if (hit) return hit;
  const coords = usable.map((point) => `${point.lng},${point.lat}`).join(";");
  const urls = [
    endpoints("https://router.project-osrm.org/route/v1/driving", coords),
    endpoints("https://routing.openstreetmap.de/routed-car/route/v1/driving", coords),
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        code?: string;
        routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
      };
      const line = json.routes?.[0]?.geometry?.coordinates;
      if (json.code !== "Ok" || !line?.length) continue;
      const route = line.map(([lng, lat]) => ({ lat, lng }));
      cache.set(key, route);
      return route;
    } catch {
      continue;
    }
  }
  return null;
}

/** Nearest vertex on a polyline, used to snap the truck onto the road. */
export function nearestOnRoute(route: LatLng[], point: LatLng) {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < route.length; i++) {
    const dLat = route[i].lat - point.lat;
    const dLng = route[i].lng - point.lng;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
