import { CITY_COORDS, coordsForCity, type LatLng } from "@/lib/geo/city-coords";

const CORRIDORS: Record<string, string[]> = {
  "تهران|مشهد": ["تهران", "سمنان", "شاهرود", "سبزوار", "مشهد"],
  "تهران|رشت": ["تهران", "کرج", "قزوین", "رشت"],
  "تهران|اصفهان": ["تهران", "قم", "کاشان", "اصفهان"],
  "تهران|شیراز": ["تهران", "قم", "اصفهان", "شیراز"],
  "تهران|تبریز": ["تهران", "کرج", "قزوین", "زنجان", "تبریز"],
  "تهران|اهواز": ["تهران", "قم", "اراک", "خرم آباد", "اهواز"],
  "تهران|زاهدان": ["تهران", "قم", "یزد", "کرمان", "زاهدان"],
  "تهران|کرمان": ["تهران", "قم", "یزد", "کرمان"],
  "تهران|یزد": ["تهران", "قم", "کاشان", "یزد"],
  "کرج|تهران": ["کرج", "تهران"],
  "کرج|قم": ["کرج", "تهران", "قم"],
  "آمل|تهران": ["آمل", "هراز", "لاریجان", "دماوند", "تهران"],
  "تهران|آمل": ["تهران", "دماوند", "لاریجان", "هراز", "آمل"],
};

const EXTRA: Record<string, LatLng> = {
  زنجان: { lat: 36.6764, lng: 48.4963 },
  دماوند: { lat: 35.7167, lng: 52.0667 },
  لاریجان: { lat: 36.0, lng: 52.22 },
  هراز: { lat: 36.2, lng: 52.3 },
};

function pointFor(name: string): LatLng | null {
  return coordsForCity(name) ?? EXTRA[name] ?? CITY_COORDS[name] ?? null;
}

export function routeKey(origin: string, dest: string) {
  return `${origin}|${dest}`;
}

export function routeWaypoints(originCity?: string | null, destCity?: string | null, origin?: LatLng | null, dest?: LatLng | null): LatLng[] {
  const from = origin ?? coordsForCity(originCity);
  const to = dest ?? coordsForCity(destCity);
  if (!from || !to) return [from, to].filter(Boolean) as LatLng[];
  const named = originCity && destCity ? CORRIDORS[routeKey(originCity, destCity)] : null;
  const mid = (named ?? [])
    .map(pointFor)
    .filter((p): p is LatLng => Boolean(p));
  const points = [from, ...mid.filter((p) => distanceKm(p, from) > 8 && distanceKm(p, to) > 8), to];
  return densify(points, 18);
}

export function interpolate(points: LatLng[], t: number): LatLng {
  const clamped = Math.min(1, Math.max(0, t));
  if (points.length === 0) return { lat: 0, lng: 0 };
  if (points.length === 1) return points[0];
  const segments = segmentLengths(points);
  const total = segments.reduce((sum, item) => sum + item, 0) || 1;
  let remain = clamped * total;
  for (let i = 0; i < points.length - 1; i++) {
    const len = segments[i];
    if (remain <= len) {
      const f = len === 0 ? 0 : remain / len;
      return {
        lat: points[i].lat + (points[i + 1].lat - points[i].lat) * f,
        lng: points[i].lng + (points[i + 1].lng - points[i].lng) * f,
      };
    }
    remain -= len;
  }
  return points[points.length - 1];
}

export function headingDeg(from: LatLng, to: LatLng) {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function distanceKm(a: LatLng, b: LatLng) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function routeDistanceKm(points: LatLng[]) {
  return segmentLengths(points).reduce((sum, item) => sum + item, 0);
}

/** Roads are longer than the straight polyline: less so when we know the real corridor towns. */
export function roadFactor(originCity?: string | null, destCity?: string | null) {
  const known = originCity && destCity ? Boolean(CORRIDORS[routeKey(originCity, destCity)]) : false;
  return known ? 1.2 : 1.3;
}

/** Road kilometres for the whole trip. */
export function roadDistanceKm(points: LatLng[], factor = 1.3) {
  return routeDistanceKm(points) * factor;
}

/** Road kilometres left from the vehicle's position to the end of the route (not the straight line). */
export function remainingRoadKm(points: LatLng[], current: LatLng, factor = 1.3) {
  if (points.length < 2) return 0;
  let nearest = 0;
  let best = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const d = distanceKm(point, current);
    if (d < best) {
      best = d;
      nearest = index;
    }
  });
  const segments = segmentLengths(points);
  let left = 0;
  for (let i = nearest; i < segments.length; i++) left += segments[i];
  return (left + best) * factor;
}

/** Driving time in minutes. A parked or very slow vehicle is assumed to average a normal truck speed. */
export function etaMinutesFor(remainingKm: number, speedKmh?: number | null) {
  if (remainingKm <= 0.5) return 0;
  const speed = speedKmh && speedKmh >= 25 ? Math.min(speedKmh, 90) : 55;
  return Math.max(1, Math.round((remainingKm / speed) * 60));
}

export function estimatedHours(points: LatLng[], speedKmh = 55, factor = 1.3) {
  return Math.max(0.25, roadDistanceKm(points, factor) / speedKmh);
}

function segmentLengths(points: LatLng[]) {
  const out: number[] = [];
  for (let i = 0; i < points.length - 1; i++) out.push(distanceKm(points[i], points[i + 1]));
  return out;
}

function densify(points: LatLng[], minPoints: number) {
  if (points.length >= minPoints) return points;
  const extra = Math.max(1, Math.ceil(minPoints / Math.max(points.length - 1, 1)));
  const out: LatLng[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    out.push(points[i]);
    for (let s = 1; s < extra; s++) {
      const f = s / extra;
      out.push({
        lat: points[i].lat + (points[i + 1].lat - points[i].lat) * f,
        lng: points[i].lng + (points[i + 1].lng - points[i].lng) * f,
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
