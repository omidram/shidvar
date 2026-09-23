import { z } from "zod";
import type { NotificationChannel } from "@prisma/client";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { hashPassword, passwordPolicy, verifyPassword } from "@/server/auth/password";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/rbac/actor";
import {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PREFS,
  SETTINGS_VEHICLES,
  type PortalSettings,
  type SettingsNotifications,
  type SettingsPrefs,
  type SettingsVehicle,
} from "@/lib/settings";

const NOTIF_MAP: Array<{ key: keyof SettingsNotifications; eventType: string; channel: NotificationChannel }> = [
  { key: "jobSms", eventType: "job.status", channel: "SMS" },
  { key: "jobInApp", eventType: "job.status", channel: "IN_APP" },
  { key: "jobEmail", eventType: "job.status", channel: "EMAIL" },
  { key: "walletSms", eventType: "wallet.movement", channel: "SMS" },
  { key: "walletInApp", eventType: "wallet.movement", channel: "IN_APP" },
  { key: "docsInApp", eventType: "documents.update", channel: "IN_APP" },
  { key: "docsEmail", eventType: "documents.update", channel: "EMAIL" },
  { key: "marketingEmail", eventType: "marketing.digest", channel: "EMAIL" },
];

const PREF_BOOLS: Array<keyof Omit<SettingsPrefs, "defaultVehicle">> = [
  "acceptingLoads",
  "nightShift",
  "autoAcceptNearby",
  "soundAlerts",
  "hidePhoneUntilAccept",
  "shareWeeklyReport",
  "requireInsurance",
  "requireWorkers",
  "requireCover",
  "autoPublish",
  "weekendDelivery",
];

function timeToDate(value?: string | null) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, hours, minutes, 0));
}

function dateToTime(value?: Date | null) {
  if (!value) return "";
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
}

function policyFa(password: string) {
  return passwordPolicy(password).map((item) => {
    if (item.includes("10")) return "رمز باید حداقل ۱۰ نویسه باشد";
    if (item.includes("uppercase")) return "رمز باید حرف بزرگ انگلیسی داشته باشد";
    if (item.includes("lowercase")) return "رمز باید حرف کوچک انگلیسی داشته باشد";
    if (item.includes("number")) return "رمز باید عدد داشته باشد";
    return item;
  });
}

export const updateSettingsSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
  twoFactorEnabled: z.boolean().optional(),
  twoFactorChannel: z.enum(["SMS", "EMAIL"]).optional(),
  tradeName: z.string().trim().min(2).max(120).optional(),
  companyPhone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
  companyEmail: z.string().email().optional().or(z.literal("")),
  website: z.string().trim().max(160).optional().or(z.literal("")),
  trackingAllowed: z.boolean().optional(),
  availableFrom: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  availableTo: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  notifications: z
    .object({
      jobSms: z.boolean(),
      jobInApp: z.boolean(),
      jobEmail: z.boolean(),
      walletSms: z.boolean(),
      walletInApp: z.boolean(),
      docsInApp: z.boolean(),
      docsEmail: z.boolean(),
      marketingEmail: z.boolean(),
    })
    .optional(),
  prefs: z
    .object({
      acceptingLoads: z.boolean(),
      nightShift: z.boolean(),
      autoAcceptNearby: z.boolean(),
      soundAlerts: z.boolean(),
      hidePhoneUntilAccept: z.boolean(),
      shareWeeklyReport: z.boolean(),
      requireInsurance: z.boolean(),
      requireWorkers: z.boolean(),
      requireCover: z.boolean(),
      autoPublish: z.boolean(),
      weekendDelivery: z.boolean(),
      defaultVehicle: z.enum(SETTINGS_VEHICLES),
    })
    .optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
});

function readNotifications(rows: Array<{ eventType: string; channel: NotificationChannel; enabled: boolean }>): SettingsNotifications {
  const next = { ...DEFAULT_NOTIFICATIONS };
  for (const item of NOTIF_MAP) {
    const row = rows.find((r) => r.eventType === item.eventType && r.channel === item.channel);
    if (row) next[item.key] = row.enabled;
  }
  return next;
}

function readPrefs(rows: Array<{ eventType: string; channel: NotificationChannel; enabled: boolean }>): SettingsPrefs {
  const next = { ...DEFAULT_PREFS };
  for (const key of PREF_BOOLS) {
    const row = rows.find((r) => r.eventType === `pref.${key}` && r.channel === "IN_APP");
    if (row) next[key] = row.enabled;
  }
  const vehicle = SETTINGS_VEHICLES.find((type) =>
    rows.some((r) => r.eventType === `pref.vehicle.${type}` && r.channel === "IN_APP" && r.enabled),
  );
  if (vehicle) next.defaultVehicle = vehicle;
  return next;
}

async function upsertFlags(
  userId: string,
  notifications: SettingsNotifications | undefined,
  prefs: SettingsPrefs | undefined,
) {
  const rows: Array<{ eventType: string; channel: NotificationChannel; enabled: boolean }> = [];
  if (notifications) {
    for (const item of NOTIF_MAP) rows.push({ eventType: item.eventType, channel: item.channel, enabled: notifications[item.key] });
  }
  if (prefs) {
    for (const key of PREF_BOOLS) rows.push({ eventType: `pref.${key}`, channel: "IN_APP", enabled: prefs[key] });
    for (const type of SETTINGS_VEHICLES) {
      rows.push({ eventType: `pref.vehicle.${type}`, channel: "IN_APP", enabled: prefs.defaultVehicle === type });
    }
  }
  await Promise.all(
    rows.map((row) =>
      prisma.notificationPreference.upsert({
        where: { userId_eventType_channel: { userId, eventType: row.eventType, channel: row.channel } },
        create: { userId, ...row },
        update: { enabled: row.enabled },
      }),
    ),
  );
}

export async function getPortalSettings(actor: Actor): Promise<PortalSettings> {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: {
      notificationPrefs: true,
      driverProfile: true,
      memberships: { include: { company: { include: { _count: { select: { warehouses: true, stores: true, memberships: true } } } } } },
    },
  });
  if (!user) throw Errors.notFound();

  const membership =
    user.memberships.find((item) => item.company.type === "REQUESTER") ??
    user.memberships.find((item) => item.company.type === "CARRIER") ??
    user.memberships[0];
  const company = membership?.company;

  return {
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      locale: user.locale,
      timezone: user.timezone,
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorChannel: user.twoFactorSecret === "SMS" ? "SMS" : "EMAIL",
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneVerified: Boolean(user.phoneVerifiedAt),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    },
    company: company
      ? {
          id: company.id,
          type: company.type,
          status: company.status,
          legalName: company.legalName,
          tradeName: company.tradeName,
          taxId: company.taxId,
          registrationNumber: company.registrationNumber,
          phone: company.phone,
          email: company.email,
          website: company.website,
          defaultCurrency: company.defaultCurrency,
          warehouseCount: company._count.warehouses,
          storeCount: company._count.stores,
          memberCount: company._count.memberships,
        }
      : null,
    driver: user.driverProfile
      ? {
          id: user.driverProfile.id,
          status: user.driverProfile.status,
          licenseNumber: user.driverProfile.licenseNumber,
          licenseType: user.driverProfile.licenseType,
          trackingAllowed: user.driverProfile.trackingAllowed,
          availableFrom: dateToTime(user.driverProfile.availableFrom),
          availableTo: dateToTime(user.driverProfile.availableTo),
          completedJobs: user.driverProfile.completedJobs,
          ratingAvg: Number(user.driverProfile.ratingAvg),
        }
      : null,
    notifications: readNotifications(user.notificationPrefs),
    prefs: readPrefs(user.notificationPrefs),
  };
}

export async function updatePortalSettings(actor: Actor, input: z.infer<typeof updateSettingsSchema>) {
  const current = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { driverProfile: true, memberships: { include: { company: true } } },
  });
  if (!current) throw Errors.notFound();

  if (input.newPassword) {
    if (!input.currentPassword) throw Errors.validation({ currentPassword: ["رمز فعلی را وارد کنید"] }, "رمز فعلی لازم است");
    const ok = await verifyPassword(input.currentPassword, current.passwordHash);
    if (!ok) throw Errors.validation({ currentPassword: ["رمز فعلی نادرست است"] }, "رمز فعلی نادرست است");
    const issues = policyFa(input.newPassword);
    if (issues.length) throw Errors.validation({ newPassword: issues }, issues[0]);
  }

  const nextPhone = input.phone === "" ? null : (input.phone ?? current.phone);
  const twoFactorEnabled = input.twoFactorEnabled ?? current.twoFactorEnabled;
  const twoFactorChannel = input.twoFactorChannel ?? (current.twoFactorSecret === "SMS" ? "SMS" : "EMAIL");
  if (twoFactorEnabled) {
    if (twoFactorChannel === "SMS" && !nextPhone) {
      throw Errors.validation({ twoFactorChannel: ["برای ارسال کد با پیامک، موبایل حساب را وارد کنید"] }, "موبایل برای پیامک لازم است");
    }
    if (twoFactorChannel === "EMAIL" && !current.email) {
      throw Errors.validation({ twoFactorChannel: ["برای ارسال کد با ایمیل، ایمیل حساب لازم است"] }, "ایمیل برای کد ورود لازم است");
    }
  }

  const company =
    current.memberships.find((item) => item.company.type === "REQUESTER")?.company ??
    current.memberships.find((item) => item.isOwner)?.company;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: current.id },
      data: {
        firstName: input.firstName ?? current.firstName,
        lastName: input.lastName ?? current.lastName,
        phone: nextPhone,
        twoFactorEnabled,
        twoFactorSecret: twoFactorChannel,
        ...(input.newPassword ? { passwordHash: await hashPassword(input.newPassword) } : {}),
      },
    });

    if (current.driverProfile && (input.trackingAllowed !== undefined || input.availableFrom !== undefined || input.availableTo !== undefined)) {
      await tx.driverProfile.update({
        where: { id: current.driverProfile.id },
        data: {
          trackingAllowed: input.trackingAllowed ?? current.driverProfile.trackingAllowed,
          trackingAllowedAt: input.trackingAllowed ? new Date() : current.driverProfile.trackingAllowedAt,
          availableFrom: input.availableFrom !== undefined ? timeToDate(input.availableFrom) : current.driverProfile.availableFrom,
          availableTo: input.availableTo !== undefined ? timeToDate(input.availableTo) : current.driverProfile.availableTo,
        },
      });
    }

    if (company && (input.tradeName || input.companyPhone !== undefined || input.companyEmail !== undefined || input.website !== undefined)) {
      await tx.company.update({
        where: { id: company.id },
        data: {
          tradeName: input.tradeName ?? company.tradeName,
          phone: input.companyPhone === "" ? null : (input.companyPhone ?? company.phone),
          email: input.companyEmail === "" ? null : (input.companyEmail ?? company.email),
          website: input.website === "" ? null : (input.website ?? company.website),
        },
      });
    }
  });

  await upsertFlags(current.id, input.notifications, input.prefs);

  if (input.newPassword) {
    await prisma.session.updateMany({ where: { userId: current.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  await writeAudit({
    actor,
    action: "user.settings.update",
    entityType: "User",
    entityId: current.id,
    newValue: { keys: Object.keys(input) },
  });

  return getPortalSettings(actor);
}
