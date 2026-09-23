import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";
import { coordsForCity, type LatLng } from "@/lib/geo/city-coords";
import { distanceKm, estimatedHours, headingDeg, interpolate, routeDistanceKm, routeWaypoints } from "@/lib/geo/route";

export const TRACKING_LIVE_STATUSES = [
  "LOADED",
  "IN_TRANSIT",
  "ARRIVING_AT_DESTINATION",
  "AT_DESTINATION",
  "UNLOADING",
] as const;

export const DRIVER_TRIP_STATUSES = [
  "ARRIVING_AT_PICKUP",
  "AT_PICKUP",
  "LOADING",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVING_AT_DESTINATION",
  "AT_DESTINATION",
  "UNLOADING",
] as const;

export async function findOpenTrip(driverId: string, exceptJobId?: string) {
  return prisma.transportationJob.findFirst({
    where: {
      assignedDriverId: driverId,
      status: { in: [...DRIVER_TRIP_STATUSES] },
      ...(exceptJobId ? { id: { not: exceptJobId } } : {}),
    },
    select: { id: true, number: true, status: true },
  });
}

export async function assertDriverFreeForTrip(driverId: string, exceptJobId?: string) {
  const open = await findOpenTrip(driverId, exceptJobId);
  if (open) {
    throw Errors.conflict("این راننده الان یک سفر باز دارد. تا پایان همان بار نمی‌تواند سفر دیگری را هم‌زمان انجام دهد.");
  }
}

const TRACKING_DONE = ["DELIVERED", "PROOF_SUBMITTED", "CONFIRMED", "COMPLETED", "CANCELLED"];

const jobInclude = {
  order: { include: { request: true, requesterCompany: true, supplierCompany: true } },
  pickupWarehouse: { include: { address: true } },
  deliveryWarehouse: { include: { address: true } },
  assignedDriver: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
  assignedVehicle: true,
  shipment: true,
  trackingSession: { include: { pings: { orderBy: { recordedAt: "asc" as const } } } },
} as const;

function num(value: unknown) {
  return value == null ? null : Number(value);
}

function canSeeJob(
  actor: Actor,
  job: { assignedDriverId: string | null; order: { requesterCompanyId: string; supplierCompanyId: string } },
) {
  if (actor.isPlatformStaff) return true;
  if (actor.driverProfile?.id && actor.driverProfile.id === job.assignedDriverId) return true;
  return actor.memberships.some(
    (m) => m.companyId === job.order.requesterCompanyId || m.companyId === job.order.supplierCompanyId,
  );
}

function endpoints(job: {
  order: { request: { originCity: string | null; destinationCity: string | null } | null };
  pickupWarehouse: { address: { latitude: unknown; longitude: unknown; city: string } } | null;
  deliveryWarehouse: { address: { latitude: unknown; longitude: unknown; city: string } } | null;
}) {
  const originCity = job.order.request?.originCity ?? job.pickupWarehouse?.address.city ?? null;
  const destCity = job.order.request?.destinationCity ?? job.deliveryWarehouse?.address.city ?? null;
  const origin =
    (num(job.pickupWarehouse?.address.latitude) != null && num(job.pickupWarehouse?.address.longitude) != null
      ? { lat: num(job.pickupWarehouse!.address.latitude)!, lng: num(job.pickupWarehouse!.address.longitude)! }
      : coordsForCity(originCity)) ?? coordsForCity("تهران")!;
  const dest =
    (num(job.deliveryWarehouse?.address.latitude) != null && num(job.deliveryWarehouse?.address.longitude) != null
      ? { lat: num(job.deliveryWarehouse!.address.latitude)!, lng: num(job.deliveryWarehouse!.address.longitude)! }
      : coordsForCity(destCity)) ?? coordsForCity("اصفهان")!;
  return { origin, dest, originCity, destCity };
}

function progressFor(startedAt: Date, points: LatLng[], status: string) {
  if (TRACKING_DONE.includes(status) || status === "UNLOADING" || status === "AT_DESTINATION") return 0.97;
  if (status === "ARRIVING_AT_DESTINATION") return 0.88;
  const hours = Math.max(0, (Date.now() - startedAt.getTime()) / 3_600_000);
  const duration = estimatedHours(points);
  return Math.min(0.93, 0.16 + hours / duration);
}

function canSimulate(session: { status: string; consentStatus: string; deviceConsent: boolean }) {
  return session.status === "ACTIVE" && session.consentStatus === "GRANTED" && !session.deviceConsent;
}

function presentTracking(
  actor: Actor,
  job: { assignedDriverId: string | null },
  payload: ReturnType<typeof serializeSession>,
) {
  if (payload.waitingForDriver && actor.driverProfile?.id !== job.assignedDriverId) {
    return {
      ...payload,
      current: payload.origin,
      trail: [] as typeof payload.trail,
      speedKmh: null,
      lastAt: null,
    };
  }
  return payload;
}

function serializeSession(
  job: Awaited<ReturnType<typeof loadTrackedJob>>,
  session: NonNullable<Awaited<ReturnType<typeof loadTrackedJob>>["trackingSession"]>,
) {
  const { origin, dest, originCity, destCity } = endpoints(job);
  const route = routeWaypoints(originCity, destCity, origin, dest);
  const pings = session.pings.map((ping) => ({
    lat: Number(ping.latitude),
    lng: Number(ping.longitude),
    speedKmh: num(ping.speedKmh),
    heading: num(ping.heading),
    at: ping.recordedAt.toISOString(),
  }));
  const current = session.lastLat != null && session.lastLng != null
    ? { lat: Number(session.lastLat), lng: Number(session.lastLng) }
    : pings.at(-1) ?? origin;
  const remaining = distanceKm(current, dest);
  const speed = Number(session.speedKmh ?? 68);
  return {
    jobId: job.id,
    jobNumber: job.number,
    waybill: job.shipment?.trackingNumber ?? null,
    status: job.status,
    sessionStatus: session.status,
    consentStatus: session.consentStatus,
    needsConsent: session.consentStatus !== "GRANTED" || session.status === "PENDING",
    waitingForDriver: session.consentStatus !== "GRANTED",
    deviceConsent: session.deviceConsent,
    source: session.deviceConsent ? "phone" : "pending",
    active: session.status === "ACTIVE" && session.consentStatus === "GRANTED",
    origin,
    dest,
    originCity,
    destCity,
    originLabel: [originCity, job.pickupWarehouse?.address.line1].filter(Boolean).join(" · "),
    destLabel: [destCity, job.deliveryWarehouse?.address.line1].filter(Boolean).join(" · "),
    cargoOwner: job.order.requesterCompany.tradeName,
    driver: job.assignedDriver
      ? {
          id: job.assignedDriver.id,
          name: `${job.assignedDriver.user.firstName} ${job.assignedDriver.user.lastName}`.trim(),
          phone: job.assignedDriver.user.phone,
        }
      : null,
    plate: job.assignedVehicle?.plateNumber ?? null,
    current,
    heading: num(session.heading),
    speedKmh: num(session.speedKmh),
    lastAt: session.lastAt?.toISOString() ?? null,
    startedAt: session.startedAt.toISOString(),
    remainingKm: Math.round(remaining),
    etaMinutes: Math.max(8, Math.round((remaining / Math.max(speed, 30)) * 60)),
    routeKm: Math.round(routeDistanceKm(route)),
    route,
    trail: pings,
  };
}

async function notifyTrackingConsent(job: Awaited<ReturnType<typeof loadTrackedJob>>) {
  const userId = job.assignedDriver?.user.id ?? job.assignedDriver?.userId;
  if (!userId) return;
  const waybill = job.shipment?.trackingNumber || job.number;
  const { originCity, destCity } = endpoints(job);
  const open = await prisma.notification.findMany({
    where: { userId, eventType: "tracking.consent", readAt: null },
    take: 8,
  });
  if (open.some((row) => (row.payload as { jobId?: string } | null)?.jobId === job.id)) return;
  await prisma.notification.create({
    data: {
      userId,
      eventType: "tracking.consent",
      title: "تأیید ردیابی سفر",
      body: `بار ${waybill} از ${originCity ?? "مبدأ"} به ${destCity ?? "مقصد"} تحویل گرفته شد. ردیابی فقط بعد از اجازهٔ موقعیت روی گوشی فعال می‌شود.`,
      payload: { jobId: job.id, kind: "tracking.consent", waybill },
    },
  });
}

async function loadTrackedJob(jobId: string) {
  const job = await prisma.transportationJob.findUnique({
    where: { id: jobId },
    include: jobInclude,
  });
  if (!job) throw Errors.notFound();
  return job;
}

export async function startTrackingForJob(
  jobId: string,
  opts?: { startedAt?: Date; seedTrail?: boolean; progress?: number; preGranted?: boolean },
) {
  const job = await loadTrackedJob(jobId);
  if (job.assignedDriverId && !opts?.preGranted) {
    await assertDriverFreeForTrip(job.assignedDriverId, jobId);
  }
  const { origin, dest, originCity, destCity } = endpoints(job);
  const route = routeWaypoints(originCity, destCity, origin, dest);
  const startedAt = opts?.startedAt ?? new Date();
  const progress = opts?.progress ?? progressFor(startedAt, route, job.status);
  const here = interpolate(route, progress);
  const next = interpolate(route, Math.min(1, progress + 0.02));
  const heading = headingDeg(here, next);
  const speed = 58 + Math.round(progress * 18);
  const granted = Boolean(opts?.preGranted);
  const nextStatus = TRACKING_DONE.includes(job.status) ? "COMPLETED" : granted ? "ACTIVE" : "PENDING";

  const session = await prisma.trackingSession.upsert({
    where: { jobId },
    create: {
      jobId,
      status: nextStatus,
      consentStatus: granted ? "GRANTED" : "PENDING",
      consentedAt: granted ? new Date() : null,
      deviceConsent: false,
      startedAt,
      originLat: origin.lat,
      originLng: origin.lng,
      destLat: dest.lat,
      destLng: dest.lng,
      lastLat: granted ? here.lat : origin.lat,
      lastLng: granted ? here.lng : origin.lng,
      heading,
      speedKmh: granted ? speed : null,
      lastAt: granted ? new Date() : null,
    },
    update: job.trackingSession?.status === "COMPLETED"
      ? {}
      : {
          originLat: origin.lat,
          originLng: origin.lng,
          destLat: dest.lat,
          destLng: dest.lng,
        },
  });

  if (!granted && session.consentStatus === "PENDING") {
    await notifyTrackingConsent(job);
  }

  if (granted && opts?.seedTrail !== false && (await prisma.trackingPing.count({ where: { sessionId: session.id } })) < 8) {
    const stamps: Date[] = [];
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const t = (progress * i) / steps;
      const point = interpolate(route, t);
      const at = new Date(startedAt.getTime() + t * estimatedHours(route) * 3_600_000);
      stamps.push(at);
      await prisma.trackingPing.create({
        data: {
          sessionId: session.id,
          latitude: point.lat,
          longitude: point.lng,
          speedKmh: 52 + Math.round(t * 20),
          heading: headingDeg(point, interpolate(route, Math.min(1, t + 0.03))),
          recordedAt: at,
        },
      });
    }
    await prisma.trackingSession.update({
      where: { id: session.id },
      data: { lastLat: here.lat, lastLng: here.lng, heading, speedKmh: speed, lastAt: stamps.at(-1) ?? new Date() },
    });
  }

  return prisma.trackingSession.findUniqueOrThrow({
    where: { id: session.id },
    include: { pings: { orderBy: { recordedAt: "asc" } } },
  });
}

export async function completeTracking(jobId: string) {
  const session = await prisma.trackingSession.findUnique({ where: { jobId } });
  if (!session || session.status === "COMPLETED") return session;
  const dest = { lat: Number(session.destLat), lng: Number(session.destLng) };
  await prisma.trackingPing.create({
    data: { sessionId: session.id, latitude: dest.lat, longitude: dest.lng, speedKmh: 0, heading: session.heading, recordedAt: new Date() },
  });
  return prisma.trackingSession.update({
    where: { id: session.id },
    data: { status: "COMPLETED", completedAt: new Date(), lastLat: dest.lat, lastLng: dest.lng, speedKmh: 0, lastAt: new Date() },
  });
}

async function advanceSession(jobId: string) {
  const job = await loadTrackedJob(jobId);
  if (!job.trackingSession) return startTrackingForJob(jobId);
  if (job.trackingSession.status === "COMPLETED") return job.trackingSession;
  if (!canSimulate(job.trackingSession)) return job.trackingSession;
  const { origin, dest, originCity, destCity } = endpoints(job);
  const route = routeWaypoints(originCity, destCity, origin, dest);
  const progress = progressFor(job.trackingSession.startedAt, route, job.status);
  const here = interpolate(route, progress);
  const next = interpolate(route, Math.min(1, progress + 0.015));
  const heading = headingDeg(here, next);
  const last = job.trackingSession.lastAt ? Date.now() - job.trackingSession.lastAt.getTime() : 99999;
  if (last < 12_000) return job.trackingSession;
  await prisma.trackingPing.create({
    data: {
      sessionId: job.trackingSession.id,
      latitude: here.lat,
      longitude: here.lng,
      speedKmh: 60 + Math.round(Math.sin(progress * 8) * 8),
      heading,
      recordedAt: new Date(),
    },
  });
  return prisma.trackingSession.update({
    where: { id: job.trackingSession.id },
    data: { lastLat: here.lat, lastLng: here.lng, heading, speedKmh: 64, lastAt: new Date() },
  });
}

export async function getJobTracking(actor: Actor, jobId: string) {
  const job = await loadTrackedJob(jobId);
  if (!canSeeJob(actor, job)) throw Errors.notFound();
  if (TRACKING_LIVE_STATUSES.includes(job.status as (typeof TRACKING_LIVE_STATUSES)[number]) || job.trackingSession) {
    if (!job.trackingSession) await startTrackingForJob(jobId);
    else if (canSimulate(job.trackingSession)) {
      await advanceSession(jobId);
    }
  }
  const fresh = await loadTrackedJob(jobId);
  if (!fresh.trackingSession) throw Errors.notFound("ردیابی برای این بار فعال نشده است");
  return presentTracking(actor, fresh, serializeSession(fresh, fresh.trackingSession));
}

export async function consentJobTracking(
  actor: Actor,
  jobId: string,
  input: { deviceAllowed: boolean; latitude?: number; longitude?: number },
) {
  const job = await loadTrackedJob(jobId);
  if (actor.driverProfile?.id !== job.assignedDriverId) throw Errors.forbidden("فقط رانندهٔ همین سفر می‌تواند ردیابی را تأیید کند");
  if (!TRACKING_LIVE_STATUSES.includes(job.status as (typeof TRACKING_LIVE_STATUSES)[number])) {
    throw Errors.conflict("ردیابی بعد از تحویل گرفتن بار درخواست می‌شود");
  }
  if (!input.deviceAllowed) throw Errors.validation({ deviceAllowed: ["باید اجازهٔ ردیابی روی گوشی را بدهید"] });
  if (input.latitude == null || input.longitude == null) {
    throw Errors.validation({ latitude: ["موقعیت گوشی برای فعال‌سازی ردیابی لازم است"] });
  }
  await assertDriverFreeForTrip(job.assignedDriverId!, jobId);
  if (!job.trackingSession) await startTrackingForJob(jobId, { seedTrail: false });
  const session = await prisma.trackingSession.findUniqueOrThrow({ where: { jobId } });
  const point = { lat: input.latitude, lng: input.longitude };
  await prisma.driverProfile.update({
    where: { id: job.assignedDriverId! },
    data: { trackingAllowed: true, trackingAllowedAt: new Date(), lastKnownLat: point.lat, lastKnownLng: point.lng },
  });
  await prisma.trackingPing.create({
    data: {
      sessionId: session.id,
      latitude: point.lat,
      longitude: point.lng,
      recordedAt: new Date(),
    },
  });
  await prisma.trackingSession.update({
    where: { id: session.id },
    data: {
      status: "ACTIVE",
      consentStatus: "GRANTED",
      consentedAt: new Date(),
      deviceConsent: true,
      lastLat: point.lat,
      lastLng: point.lng,
      lastAt: new Date(),
      speedKmh: 0,
    },
  });
  await prisma.notification.updateMany({
    where: { userId: actor.userId, eventType: "tracking.consent", readAt: null },
    data: { readAt: new Date() },
  });
  return getJobTracking(actor, jobId);
}

export async function recordDriverPing(
  actor: Actor,
  jobId: string,
  input: { latitude: number; longitude: number; speedKmh?: number; heading?: number },
) {
  const job = await loadTrackedJob(jobId);
  const assigned = actor.driverProfile?.id === job.assignedDriverId;
  if (!actor.isPlatformStaff && !assigned) throw Errors.forbidden();
  if (!TRACKING_LIVE_STATUSES.includes(job.status as (typeof TRACKING_LIVE_STATUSES)[number])) {
    throw Errors.conflict("ردیابی پس از تحویل گرفتن بار فعال می‌شود");
  }
  const session = job.trackingSession ?? (await startTrackingForJob(jobId, { seedTrail: false }));
  if (session.consentStatus !== "GRANTED" || !session.deviceConsent) {
    throw Errors.forbidden("ابتدا اجازهٔ ردیابی روی گوشی را تأیید کنید");
  }
  await prisma.trackingPing.create({
    data: {
      sessionId: session.id,
      latitude: input.latitude,
      longitude: input.longitude,
      speedKmh: input.speedKmh,
      heading: input.heading,
      recordedAt: new Date(),
    },
  });
  await prisma.trackingSession.update({
    where: { id: session.id },
    data: {
      lastLat: input.latitude,
      lastLng: input.longitude,
      speedKmh: input.speedKmh,
      heading: input.heading,
      lastAt: new Date(),
      status: "ACTIVE",
    },
  });
  await prisma.driverProfile.update({
    where: { id: job.assignedDriverId! },
    data: { lastKnownLat: input.latitude, lastKnownLng: input.longitude },
  });
  return getJobTracking(actor, jobId);
}

export async function listLiveTracking(actor: Actor) {
  await ensureDemoTracking();
  const open = { status: { in: ["PENDING" as const, "ACTIVE" as const] } };
  const where = actor.isPlatformStaff
    ? open
    : actor.driverProfile
      ? { ...open, job: { assignedDriverId: actor.driverProfile.id } }
      : {
          ...open,
          job: {
            order: {
              OR: [
                { requesterCompanyId: { in: actor.memberships.map((m) => m.companyId) } },
                { supplierCompanyId: { in: actor.memberships.map((m) => m.companyId) } },
              ],
            },
          },
        };

  const sessions = await prisma.trackingSession.findMany({
    where,
    include: { job: { include: jobInclude } },
    orderBy: { lastAt: "desc" },
    take: 20,
  });

  const live = [];
  for (const session of sessions) {
    if (!canSeeJob(actor, session.job)) continue;
    if (canSimulate(session)) await advanceSession(session.jobId);
    const fresh = await loadTrackedJob(session.jobId);
    if (fresh.trackingSession) {
      live.push(presentTracking(actor, fresh, serializeSession(fresh, fresh.trackingSession)));
    }
  }
  return live;
}

async function demoteOpenTrip(jobId: string) {
  const job = await prisma.transportationJob.findUnique({
    where: { id: jobId },
    include: { shipment: true, order: true },
  });
  if (!job) return;
  await prisma.trackingSession.updateMany({
    where: { jobId, status: { not: "COMPLETED" } },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await prisma.transportationJob.update({
    where: { id: jobId },
    data: { status: "DRIVER_ASSIGNED" },
  });
  if (job.shipment) {
    await prisma.shipment.update({ where: { id: job.shipment.id }, data: { status: "SCHEDULED" } });
  }
}

async function promoteLiveJob(job: { id: string; detailsReleasedAt: Date | null; shipment: { id: string } | null; order: { id: string; requestId: string } }) {
  await prisma.transportationJob.update({
    where: { id: job.id },
    data: { status: "IN_TRANSIT", detailsReleasedAt: job.detailsReleasedAt ?? new Date() },
  });
  if (job.shipment) {
    await prisma.shipment.update({ where: { id: job.shipment.id }, data: { status: "IN_TRANSIT" } });
  }
  await prisma.procurementRequest.update({
    where: { id: job.order.requestId },
    data: { status: "IN_TRANSIT" },
  });
  await prisma.order.update({
    where: { id: job.order.id },
    data: { status: "IN_FULFILLMENT" },
  });
}

export async function ensureDemoTracking() {
  const ali = await prisma.user.findFirst({
    where: { email: "ali.rezaei@fleet.local" },
    select: { id: true, driverProfile: { select: { id: true } } },
  });
  const aliDriverId = ali?.driverProfile?.id ?? null;
  const badr = await prisma.company.findFirst({
    where: { OR: [{ tradeName: { contains: "بدر" } }, { legalName: { contains: "هوفرد" } }] },
    select: { id: true },
  });

  const openTrips = await prisma.transportationJob.findMany({
    where: { status: { in: [...DRIVER_TRIP_STATUSES] }, assignedDriverId: { not: null } },
    include: {
      order: { include: { requesterCompany: true, request: true } },
      shipment: true,
    },
  });

  const byDriver = new Map<string, typeof openTrips>();
  for (const job of openTrips) {
    const driverId = job.assignedDriverId!;
    byDriver.set(driverId, [...(byDriver.get(driverId) ?? []), job]);
  }

  for (const [driverId, jobs] of byDriver) {
    if (jobs.length < 2) continue;
    const preferred =
      jobs.find((job) => badr && job.order.requesterCompanyId === badr.id && (job.order.request?.destinationCity?.includes("زاهدان") || job.number.includes("000520"))) ??
      jobs.find((job) => badr && job.order.requesterCompanyId === badr.id) ??
      jobs[0];
    for (const job of jobs) {
      if (job.id !== preferred.id) await demoteOpenTrip(job.id);
    }
    void driverId;
  }

  const occupied = new Set(
    (
      await prisma.transportationJob.findMany({
        where: { status: { in: [...DRIVER_TRIP_STATUSES] }, assignedDriverId: { not: null } },
        select: { assignedDriverId: true },
      })
    )
      .map((row) => row.assignedDriverId)
      .filter((id): id is string => Boolean(id)),
  );

  async function pickAssignable(where: Record<string, unknown>, take: number) {
    const rows = await prisma.transportationJob.findMany({
      where: { status: "DRIVER_ASSIGNED", assignedDriverId: { not: null }, ...where },
      orderBy: { updatedAt: "desc" },
      take: take + occupied.size + 4,
      include: { shipment: true, order: true },
    });
    return rows.filter((job) => job.assignedDriverId && !occupied.has(job.assignedDriverId)).slice(0, take);
  }

  if (badr) {
    const badrLive = await prisma.transportationJob.count({
      where: { status: { in: [...TRACKING_LIVE_STATUSES] }, order: { requesterCompanyId: badr.id } },
    });
    if (badrLive < 2) {
      for (const job of await pickAssignable({ order: { requesterCompanyId: badr.id } }, 2 - badrLive)) {
        await promoteLiveJob(job);
        occupied.add(job.assignedDriverId!);
      }
    }
  }

  const liveNow = await prisma.transportationJob.count({ where: { status: { in: [...TRACKING_LIVE_STATUSES] } } });
  if (liveNow < 3) {
    for (const job of await pickAssignable({}, 3 - liveNow)) {
      await promoteLiveJob(job);
      occupied.add(job.assignedDriverId!);
    }
  }

  const targets = await prisma.transportationJob.findMany({
    where: { status: { in: [...TRACKING_LIVE_STATUSES] } },
    include: { assignedDriver: { include: { user: { select: { email: true } } } } },
    take: 8,
  });

  let index = 0;
  for (const job of targets) {
    const isAli = Boolean(aliDriverId && job.assignedDriverId === aliDriverId);
    const existing = await prisma.trackingSession.findUnique({ where: { jobId: job.id } });
    if (existing) {
      if (isAli && existing.consentStatus !== "GRANTED") {
        await prisma.trackingSession.update({
          where: { id: existing.id },
          data: { status: "PENDING", consentStatus: "PENDING", deviceConsent: false, lastAt: null, speedKmh: null },
        });
        const full = await loadTrackedJob(job.id);
        await notifyTrackingConsent(full);
      } else if (!isAli && existing.status !== "COMPLETED") {
        await prisma.trackingSession.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", consentStatus: "GRANTED", deviceConsent: false },
        });
        if (canSimulate({ ...existing, status: "ACTIVE", consentStatus: "GRANTED", deviceConsent: false })) {
          await advanceSession(job.id);
        }
      }
      continue;
    }
    if (isAli) {
      await startTrackingForJob(job.id, { seedTrail: false });
    } else {
      await startTrackingForJob(job.id, {
        startedAt: new Date(Date.now() - (2.2 + index * 1.4) * 3_600_000),
        seedTrail: true,
        progress: Math.min(0.86, 0.28 + index * 0.22),
        preGranted: true,
      });
      index += 1;
    }
  }

  return { seeded: targets.length };
}
