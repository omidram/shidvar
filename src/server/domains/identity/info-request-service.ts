import { z } from "zod";
import type { Prisma, VehicleType } from "@prisma/client";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/rbac/actor";
import { documentsFor, fieldsFor, infoFieldLabel, VEHICLE_OPTIONS, type InfoTarget } from "@/lib/info-fields";
import { slotLabel } from "@/lib/documents";
import { CITY_COORDS } from "@/lib/geo/city-coords";

export const createInfoRequestSchema = z.object({
  companyId: z.string().uuid(),
  fields: z.array(z.string()).default([]),
  documents: z.array(z.string()).default([]),
  message: z.string().max(1000).optional(),
});

export const respondInfoRequestSchema = z.object({
  values: z.record(z.string(), z.string()),
});

export const reviewInfoRequestSchema = z.object({
  status: z.enum(["ACCEPTED", "OPEN", "CANCELLED"]),
  adminNote: z.string().max(1000).optional(),
});

function asStrings(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

async function targetOf(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      memberships: { where: { isOwner: true }, include: { user: { include: { driverProfile: true } } }, take: 1 },
    },
  });
  if (!company || company.type === "PLATFORM") throw Errors.notFound();
  const owner = company.memberships[0]?.user ?? null;
  const target: InfoTarget = company.type === "CARRIER" ? "driver" : "company";
  return { company, owner, target, driverProfile: owner?.driverProfile ?? null };
}

function serialize(row: Prisma.ProfileInfoRequestGetPayload<object>) {
  const fields = asStrings(row.fields);
  const documents = asStrings(row.documents);
  return {
    ...row,
    fields: fields.map((key) => ({ key, label: infoFieldLabel(key) })),
    documents: documents.map((type) => ({ type, label: slotLabel(type) })),
  };
}

async function notifyOwner(companyId: string, title: string, body: string, requestId: string) {
  const members = await prisma.membership.findMany({ where: { companyId, status: "ACTIVE" }, select: { userId: true } });
  if (!members.length) return;
  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      eventType: "profile.info_request",
      title,
      body,
      payload: { kind: "profile.info_request", requestId },
    })),
  });
}

async function notifyStaff(title: string, body: string, requestId: string) {
  const staff = await prisma.userRole.findMany({
    where: { role: { portal: "PLATFORM" } },
    select: { userId: true },
    distinct: ["userId"],
  });
  if (!staff.length) return;
  await prisma.notification.createMany({
    data: staff.map((s) => ({
      userId: s.userId,
      eventType: "profile.info_response",
      title,
      body,
      payload: { kind: "profile.info_response", requestId },
    })),
  });
}

export async function createInfoRequest(actor: Actor, input: z.infer<typeof createInfoRequestSchema>) {
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const { company, target, driverProfile } = await targetOf(input.companyId);
  const allowedFields = new Set(fieldsFor(target).map((f) => f.key));
  const allowedDocs = new Set(documentsFor(target).map((d) => d.type));
  const fields = Array.from(new Set(input.fields)).filter((key) => allowedFields.has(key));
  const documents = Array.from(new Set(input.documents)).filter((type) => allowedDocs.has(type));
  if (!fields.length && !documents.length && !input.message?.trim()) {
    throw Errors.validation({ fields: ["حداقل یک مورد یا یک توضیح لازم است"] });
  }
  const row = await prisma.profileInfoRequest.create({
    data: {
      companyId: company.id,
      driverProfileId: driverProfile?.id,
      fields,
      documents,
      message: input.message?.trim() || null,
      createdById: actor.userId,
    },
  });
  await notifyOwner(company.id, "تکمیل اطلاعات حساب", "مدیریت اطلاعات تکمیلی از شما خواسته است. از پنل خود پاسخ دهید.", row.id);
  await writeAudit({ actor, action: "profile.info_requested", entityType: "Company", entityId: company.id, newValue: { fields, documents } });
  return serialize(row);
}

export async function listInfoRequestsForCompany(actor: Actor, companyId: string) {
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const rows = await prisma.profileInfoRequest.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  return rows.map(serialize);
}

export async function listInfoRequestsForAdmin(actor: Actor) {
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const rows = await prisma.profileInfoRequest.findMany({
    where: { status: { in: ["OPEN", "SUBMITTED"] } },
    orderBy: { updatedAt: "desc" },
    include: { company: { select: { id: true, tradeName: true, type: true, phone: true } } },
    take: 200,
  });
  return rows.map((row) => ({ ...serialize(row), company: row.company }));
}

export async function listOwnInfoRequests(actor: Actor) {
  const companyIds = actor.memberships.map((m) => m.companyId);
  if (!companyIds.length) return [];
  const rows = await prisma.profileInfoRequest.findMany({
    where: { companyId: { in: companyIds }, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(serialize);
}

async function applyValues(companyId: string, values: Record<string, string>) {
  const { company, owner, target, driverProfile } = await targetOf(companyId);
  const v = (key: string) => values[key]?.trim() || undefined;

  await prisma.$transaction(async (tx) => {
    if (owner && (v("firstName") || v("lastName") || v("email"))) {
      const email = v("email")?.toLowerCase();
      if (email) {
        const clash = await tx.user.findFirst({ where: { email, id: { not: owner.id } } });
        if (clash) throw Errors.validation({ email: ["این ایمیل برای حساب دیگری ثبت شده است"] });
      }
      await tx.user.update({
        where: { id: owner.id },
        data: { firstName: v("firstName") ?? owner.firstName, lastName: v("lastName") ?? owner.lastName, email: email ?? owner.email },
      });
    }

    const companyData: Prisma.CompanyUpdateInput = {};
    if (v("legalName")) companyData.legalName = v("legalName");
    if (v("tradeName")) companyData.tradeName = v("tradeName");
    if (v("registrationNumber")) companyData.registrationNumber = v("registrationNumber");
    if (v("taxId")) companyData.taxId = v("taxId");
    if (v("companyPhone")) companyData.phone = v("companyPhone");
    if (v("email")) companyData.email = v("email")!.toLowerCase();
    if (target === "driver" && (v("firstName") || v("lastName"))) {
      const name = `${v("firstName") ?? owner?.firstName ?? ""} ${v("lastName") ?? owner?.lastName ?? ""}`.trim();
      if (name) {
        companyData.legalName = name;
        companyData.tradeName = name;
      }
    }
    if (Object.keys(companyData).length) await tx.company.update({ where: { id: company.id }, data: companyData });

    const city = v("city");
    if (city && target === "company") {
      const area = await tx.geographicArea.findFirst({ where: { type: "CITY", OR: [{ nameFa: city }, { nameEn: city }] } });
      const coords = CITY_COORDS[city];
      const existing = await tx.address.findFirst({ where: { companyId: company.id, label: "HEAD_OFFICE" } });
      const data = {
        line1: v("address") ?? existing?.line1 ?? city,
        city,
        region: area?.nameFa ?? city,
        countryCode: "IR",
        geographicAreaId: area?.id,
        latitude: coords?.lat,
        longitude: coords?.lng,
      };
      if (existing) await tx.address.update({ where: { id: existing.id }, data });
      else await tx.address.create({ data: { ...data, companyId: company.id, label: "HEAD_OFFICE" } });
    }

    if (target === "driver" && driverProfile) {
      if (v("licenseNumber") || v("licenseType")) {
        await tx.driverProfile.update({
          where: { id: driverProfile.id },
          data: { licenseNumber: v("licenseNumber") ?? undefined, licenseType: v("licenseType") ?? undefined },
        });
      }
      const plate = v("plateNumber");
      const vehicleType = v("vehicleType");
      if (vehicleType && !VEHICLE_OPTIONS.some((o) => o.value === vehicleType)) {
        throw Errors.validation({ vehicleType: ["نوع ناوگان معتبر نیست"] });
      }
      if (plate || vehicleType) {
        const link = await tx.driverVehicle.findFirst({ where: { driverId: driverProfile.id, isPrimary: true } });
        if (link) {
          await tx.vehicle.update({
            where: { id: link.vehicleId },
            data: { plateNumber: plate ?? undefined, vehicleType: (vehicleType as VehicleType | undefined) ?? undefined },
          });
        } else if (plate) {
          const vehicle = await tx.vehicle.create({
            data: { companyId: company.id, plateNumber: plate, vehicleType: (vehicleType as VehicleType | undefined) ?? "TRUCK", weightCapacity: 8 },
          });
          await tx.driverVehicle.create({ data: { driverId: driverProfile.id, vehicleId: vehicle.id, isPrimary: true } });
        }
      }
      if (city) {
        const area = await tx.geographicArea.findFirst({ where: { type: "CITY", OR: [{ nameFa: city }, { nameEn: city }] } });
        if (area) {
          const exists = await tx.operatingArea.findFirst({
            where: { ownerType: "DRIVER", ownerId: driverProfile.id, geographicAreaId: area.id },
          });
          if (!exists) {
            await tx.operatingArea.create({ data: { ownerType: "DRIVER", ownerId: driverProfile.id, geographicAreaId: area.id } });
          }
        }
      }
    }
  });
}

export async function respondInfoRequest(actor: Actor, id: string, input: z.infer<typeof respondInfoRequestSchema>) {
  const row = await prisma.profileInfoRequest.findUnique({ where: { id } });
  if (!row || !actor.memberships.some((m) => m.companyId === row.companyId)) throw Errors.notFound();
  if (row.status !== "OPEN") throw Errors.conflict("این درخواست دیگر باز نیست");

  const fields = asStrings(row.fields);
  const missing = fields.filter((key) => !input.values[key]?.trim());
  if (missing.length) {
    throw Errors.validation(Object.fromEntries(missing.map((key) => [key, ["این مورد الزامی است"]])), "همه موارد خواسته‌شده را تکمیل کنید");
  }

  const documents = asStrings(row.documents);
  if (documents.length) {
    const { target, driverProfile } = await targetOf(row.companyId);
    const entityIds = target === "driver" && driverProfile
      ? [driverProfile.id, ...(await prisma.driverVehicle.findMany({ where: { driverId: driverProfile.id }, select: { vehicleId: true } })).map((r) => r.vehicleId)]
      : [row.companyId];
    const uploaded = await prisma.document.findMany({
      where: { entityId: { in: entityIds }, documentType: { in: documents }, verification: { not: "REJECTED" } },
      select: { documentType: true },
    });
    const have = new Set(uploaded.map((d) => d.documentType));
    const lacking = documents.filter((type) => !have.has(type));
    if (lacking.length) {
      throw Errors.validation({ documents: lacking.map(slotLabel) }, `مدارک بارگذاری نشده: ${lacking.map(slotLabel).join("، ")}`);
    }
  }

  const values = Object.fromEntries(fields.map((key) => [key, input.values[key].trim()]));
  await applyValues(row.companyId, values);
  const updated = await prisma.profileInfoRequest.update({
    where: { id },
    data: { status: "SUBMITTED", response: values, respondedAt: new Date() },
  });
  await notifyStaff("پاسخ به درخواست اطلاعات", "یک حساب اطلاعات خواسته‌شده را ارسال کرد.", id);
  await writeAudit({ actor, action: "profile.info_submitted", entityType: "Company", entityId: row.companyId, newValue: values });
  return serialize(updated);
}

export async function reviewInfoRequest(actor: Actor, id: string, input: z.infer<typeof reviewInfoRequestSchema>) {
  if (!actor.isPlatformStaff) throw Errors.forbidden();
  const row = await prisma.profileInfoRequest.findUnique({ where: { id } });
  if (!row) throw Errors.notFound();
  const updated = await prisma.profileInfoRequest.update({
    where: { id },
    data: { status: input.status, adminNote: input.adminNote?.trim() || null },
  });
  if (input.status === "OPEN") {
    await notifyOwner(row.companyId, "اطلاعات نیاز به اصلاح دارد", input.adminNote?.trim() || "پاسخ قبلی کامل نبود. دوباره ارسال کنید.", id);
  }
  await writeAudit({ actor, action: `profile.info_${input.status.toLowerCase()}`, entityType: "ProfileInfoRequest", entityId: id });
  return serialize(updated);
}
