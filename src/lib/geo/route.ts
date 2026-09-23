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
  "آمل|تهران": ["آمل", "تهران"],
  "تهران|آمل": ["تهران", "آمل"],
};

const EXTRA: Record<string, LatLng> = {
  زنجان: { lat: 36.6764, lng: 48.4963 },
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

export function estimatedHours(points: LatLng[], speedKmh = 68) {
  return Math.max(2.5, routeDistanceKm(points) / speedKmh);
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
