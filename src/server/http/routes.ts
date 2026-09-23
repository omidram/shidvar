import { z } from "zod";
import type { RouteDefinition } from "@/server/http/router";
import {
  loginSchema,
  logoutUser,
  registerSchema,
  registerUser,
  loginUser,
  serializeActor,
  forgotPasswordSchema,
  resetPasswordSchema,
  requestPasswordReset,
  resetPassword,
  verifyLoginOtp,
  verifyLoginOtpSchema,
  resendLoginOtp,
  resendLoginOtpSchema,
} from "@/server/domains/identity/auth-service";
import { requireActor, clearAuthCookies, attachAuthCookies, rotateRefreshToken } from "@/server/auth/session";
import { COOKIES } from "@/server/config";
import { NextResponse } from "next/server";
import { ok } from "@/server/http/envelope";
import { listPendingVerifications, moderateCompany, moderateDriver } from "@/server/domains/admin/verification-service";
import { createRequest, createRequestSchema, listRequests, getRequestForActor, submitRequest, publishRequest, cancelRequest } from "@/server/domains/procurement/request-service";
import { listMarketplaceRequests, submitOffer, offerSchema, acceptOffer, rejectOffer, listOffers } from "@/server/domains/offers/offer-service";
import { acceptCargoJob, applyToJob, confirmDelivery, confirmDriver, getJob, listDriverMarketplace, listJobsForActor, rejectCargoJob, returnDeliveryDocs, selectDriver, submitPod, podSchema, updateJobStatus } from "@/server/domains/logistics/job-service";
import { consentJobTracking, getJobTracking, listLiveTracking, recordDriverPing } from "@/server/domains/logistics/tracking-service";
import { dashboardFor, listNotifications, markNotificationRead } from "@/server/domains/dashboard/dashboard-service";
import { reportsFor } from "@/server/domains/reports/report-service";
import { getOrderForActor, listOrders } from "@/server/domains/orders/order-service";
import { getInvoice, listInvoices, payInvoice } from "@/server/domains/finance/invoice-service";
import {
  addDisputeMessage,
  addTicketMessage,
  approveJobExtra,
  createDispute,
  createJobRating,
  createTicket,
  getDispute,
  getTicket,
  listDisputes,
  listJobExtras,
  listJobMessages,
  listJobRatings,
  listTickets,
  rejectJobExtra,
  requestJobExtra,
  resolveDispute,
  sendJobMessage,
  updateTicketStatus,
} from "@/server/domains/ops/ops-service";
import {
  createDisputeSchema,
  createRatingSchema,
  createTicketSchema,
  disputeMessageSchema,
  requestExtraSchema,
  resolveDisputeSchema,
  sendJobMessageSchema,
  ticketMessageSchema,
  ticketStatusSchema,
} from "@/lib/validation/ops";
import {
  addBankAccount,
  addWalletExpense,
  connectBankAccount,
  createWalletAccount,
  disconnectBankAccount,
  getWallet,
  topUpWallet,
  transferWallet,
  updateWalletAccount,
  verifyZarinpalTopup,
  withdrawWallet,
} from "@/server/domains/finance/wallet-service";
import { getDriverProfile } from "@/server/domains/identity/driver-profile-service";
import { createCargoCompany, getCompanyProfile } from "@/server/domains/identity/company-profile-service";
import { getPortalSettings, updatePortalSettings, updateSettingsSchema } from "@/server/domains/identity/settings-service";
import { getOwnPriceBook, getPriceBookForCompany, quotePrice, upsertPriceBook } from "@/server/domains/finance/price-book-service";
import { buildChecklist, deleteDocument, getOwnChecklist, verifyDocument } from "@/server/domains/documents/document-service";
import { prisma } from "@/server/db";
import { getAllRules } from "@/server/settings/rules";
import { assertPermission } from "@/server/rbac/actor";
import { buildOpenApi } from "@/server/http/openapi";
import { AppError, Errors } from "@/server/errors";
import type { CompanyStatus } from "@prisma/client";

function clientMeta(req: Request) {
  return {
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  };
}

export const routes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/openapi.json",
    auth: false,
    async handler() {
      return buildOpenApi(routes);
    },
  },
  {
    method: "POST",
    path: "/auth/register",
    auth: false,
    input: registerSchema,
    async handler({ req, body }) {
      const data = body as z.infer<typeof registerSchema>;
      const result = await registerUser(data, clientMeta(req));
      const res = NextResponse.json(ok({ userId: result.userId, companyId: result.companyId, driverProfileId: result.driverProfileId, vehicleId: result.vehicleId }));
      attachAuthCookies(res, result.tokens.sessionToken, result.tokens.refreshToken);
      return res;
    },
  },
  {
    method: "POST",
    path: "/auth/login",
    auth: false,
    input: loginSchema,
    async handler({ req, body }) {
      const result = await loginUser(body as z.infer<typeof loginSchema>, clientMeta(req));
      if (result.kind === "otp") {
        return {
          authenticated: false,
          requiresTwoFactor: true,
          challengeId: result.challengeId,
          channel: result.channel,
          destination: result.destination,
          expiresInSec: result.expiresInSec,
          devCode: result.devCode,
        };
      }
      const res = NextResponse.json(ok({ authenticated: true }));
      attachAuthCookies(res, result.tokens.sessionToken, result.tokens.refreshToken);
      return res;
    },
  },
  {
    method: "POST",
    path: "/auth/login/otp",
    auth: false,
    input: verifyLoginOtpSchema,
    async handler({ req, body }) {
      const result = await verifyLoginOtp(body as z.infer<typeof verifyLoginOtpSchema>, clientMeta(req));
      const res = NextResponse.json(ok({ authenticated: true }));
      attachAuthCookies(res, result.tokens.sessionToken, result.tokens.refreshToken);
      return res;
    },
  },
  {
    method: "POST",
    path: "/auth/login/otp/resend",
    auth: false,
    input: resendLoginOtpSchema,
    async handler({ body }) {
      const result = await resendLoginOtp(body as z.infer<typeof resendLoginOtpSchema>);
      return {
        requiresTwoFactor: true,
        challengeId: result.challengeId,
        channel: result.channel,
        destination: result.destination,
        expiresInSec: result.expiresInSec,
        devCode: result.devCode,
      };
    },
  },
  {
    method: "POST",
    path: "/auth/refresh",
    auth: false,
    async handler({ req }) {
      const refresh = req.cookies.get(COOKIES.refresh)?.value;
      if (!refresh) throw Errors.unauthorized();
      try {
        const tokens = await rotateRefreshToken(refresh, clientMeta(req));
        const res = NextResponse.json(ok({ authenticated: true }));
        attachAuthCookies(res, tokens.sessionToken, tokens.refreshToken);
        return res;
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw Errors.unauthorized();
      }
    },
  },
  {
    method: "POST",
    path: "/auth/forgot-password",
    auth: false,
    input: forgotPasswordSchema,
    async handler({ body }) {
      return requestPasswordReset(body as z.infer<typeof forgotPasswordSchema>);
    },
  },
  {
    method: "POST",
    path: "/auth/reset-password",
    auth: false,
    input: resetPasswordSchema,
    async handler({ body }) {
      return resetPassword(body as z.infer<typeof resetPasswordSchema>);
    },
  },
  {
    method: "POST",
    path: "/auth/logout",
    async handler({ actor }) {
      if (actor) await logoutUser(actor.userId);
      const res = NextResponse.json(ok({ loggedOut: true }));
      clearAuthCookies(res);
      return res;
    },
  },
  {
    method: "GET",
    path: "/auth/me",
    async handler({ actor }) {
      return serializeActor(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/settings",
    async handler({ actor }) {
      return getPortalSettings(requireActor(actor));
    },
  },
  {
    method: "PATCH",
    path: "/settings",
    input: updateSettingsSchema,
    async handler({ actor, body }) {
      return updatePortalSettings(requireActor(actor), body as z.infer<typeof updateSettingsSchema>);
    },
  },
  {
    method: "GET",
    path: "/dashboard",
    async handler({ actor }) {
      return dashboardFor(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/reports",
    async handler({ actor }) {
      return reportsFor(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/notifications",
    async handler({ actor }) {
      return listNotifications(requireActor(actor));
    },
  },
  {
    method: "POST",
    path: "/notifications/:id/read",
    async handler({ actor, params }) {
      return markNotificationRead(requireActor(actor), params.id);
    },
  },
  {
    method: "GET",
    path: "/catalog/products",
    async handler() {
      return prisma.product.findMany({ include: { category: true }, orderBy: { sku: "asc" } });
    },
  },
  {
    method: "GET",
    path: "/catalog/categories",
    async handler() {
      return prisma.productCategory.findMany({ orderBy: { code: "asc" } });
    },
  },
  {
    method: "GET",
    path: "/catalog/units",
    async handler() {
      return prisma.unit.findMany({ orderBy: { code: "asc" } });
    },
  },
  {
    method: "GET",
    path: "/geo/areas",
    async handler() {
      return prisma.geographicArea.findMany({ orderBy: [{ type: "asc" }, { code: "asc" }] });
    },
  },
  {
    method: "GET",
    path: "/tenancy/stores",
    async handler({ actor }) {
      const a = requireActor(actor);
      const companyIds = a.isPlatformStaff ? undefined : a.memberships.map((m) => m.companyId);
      return prisma.store.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        include: { address: true, warehouses: true },
      });
    },
  },
  {
    method: "GET",
    path: "/tenancy/warehouses",
    async handler({ actor }) {
      const a = requireActor(actor);
      const companyIds = a.isPlatformStaff ? undefined : a.memberships.map((m) => m.companyId);
      return prisma.warehouse.findMany({
        where: companyIds ? { companyId: { in: companyIds } } : undefined,
        include: { address: true },
      });
    },
  },
  {
    method: "GET",
    path: "/requests",
    async handler({ actor }) {
      return listRequests(requireActor(actor));
    },
  },
  {
    method: "POST",
    path: "/requests",
    input: createRequestSchema,
    async handler({ actor, body }) {
      return createRequest(requireActor(actor), body as z.infer<typeof createRequestSchema>);
    },
  },
  {
    method: "GET",
    path: "/requests/:id",
    async handler({ actor, params }) {
      return getRequestForActor(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/requests/:id/submit",
    async handler({ actor, params }) {
      return submitRequest(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/requests/:id/publish",
    async handler({ actor, params }) {
      return publishRequest(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/requests/:id/cancel",
    input: z.object({ reason: z.string().min(1) }),
    async handler({ actor, params, body }) {
      return cancelRequest(requireActor(actor), params.id, (body as { reason: string }).reason);
    },
  },
  {
    method: "GET",
    path: "/marketplace/requests",
    async handler({ actor }) {
      return listMarketplaceRequests(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/offers",
    async handler({ actor }) {
      return listOffers(requireActor(actor));
    },
  },
  {
    method: "POST",
    path: "/requests/:id/offers",
    input: offerSchema,
    async handler({ actor, params, body }) {
      return submitOffer(requireActor(actor), params.id, body as z.infer<typeof offerSchema>);
    },
  },
  {
    method: "POST",
    path: "/offers/:id/accept",
    async handler({ actor, params }) {
      return acceptOffer(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/offers/:id/reject",
    input: z.object({ reason: z.string().optional() }),
    async handler({ actor, params, body }) {
      return rejectOffer(requireActor(actor), params.id, (body as { reason?: string }).reason);
    },
  },
  {
    method: "GET",
    path: "/marketplace/jobs",
    async handler({ actor }) {
      return listDriverMarketplace(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/jobs",
    async handler({ actor }) {
      return listJobsForActor(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/tracking",
    async handler({ actor }) {
      return listLiveTracking(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/jobs/:id/tracking",
    async handler({ actor, params }) {
      return getJobTracking(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/tracking/consent",
    input: z.object({
      deviceAllowed: z.boolean(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    }),
    async handler({ actor, params, body }) {
      return consentJobTracking(
        requireActor(actor),
        params.id,
        body as { deviceAllowed: boolean; latitude?: number; longitude?: number },
      );
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/tracking",
    input: z.object({
      latitude: z.number(),
      longitude: z.number(),
      speedKmh: z.number().optional(),
      heading: z.number().optional(),
    }),
    async handler({ actor, params, body }) {
      return recordDriverPing(requireActor(actor), params.id, body as { latitude: number; longitude: number; speedKmh?: number; heading?: number });
    },
  },
  {
    method: "GET",
    path: "/jobs/:id",
    async handler({ actor, params }) {
      return getJob(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/accept",
    async handler({ actor, params }) {
      return acceptCargoJob(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/reject",
    async handler({ actor, params }) {
      return rejectCargoJob(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/apply",
    input: z.object({ notes: z.string().optional() }),
    async handler({ actor, params, body }) {
      return applyToJob(requireActor(actor), params.id, (body as { notes?: string }).notes);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/select-driver",
    input: z.object({ driverId: z.string().uuid() }),
    async handler({ actor, params, body }) {
      return selectDriver(requireActor(actor), params.id, (body as { driverId: string }).driverId);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/confirm-driver",
    async handler({ actor, params }) {
      return confirmDriver(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/status",
    input: z.object({ status: z.string(), note: z.string().optional() }),
    async handler({ actor, params, body }) {
      const payload = body as { status: string; note?: string };
      return updateJobStatus(requireActor(actor), params.id, payload.status as never, payload.note);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/pod",
    input: podSchema,
    async handler({ actor, params, body }) {
      return submitPod(requireActor(actor), params.id, body as z.infer<typeof podSchema>);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/confirm-delivery",
    input: z.object({
      resolution: z.enum(["ACCEPTED", "PARTIALLY_ACCEPTED", "REJECTED", "DISPUTED"]),
      reason: z.enum(["DAMAGE", "SHORTAGE", "DELAY", "OVERCHARGE", "NO_SHOW", "OTHER"]).optional(),
      description: z.string().optional(),
    }),
    async handler({ actor, params, body }) {
      const payload = body as {
        resolution: "ACCEPTED" | "PARTIALLY_ACCEPTED" | "REJECTED" | "DISPUTED";
        reason?: "DAMAGE" | "SHORTAGE" | "DELAY" | "OVERCHARGE" | "NO_SHOW" | "OTHER";
        description?: string;
      };
      return confirmDelivery(requireActor(actor), params.id, payload.resolution, {
        reason: payload.reason,
        description: payload.description,
      });
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/delivery-docs/return",
    input: z.object({ note: z.string().max(500).optional() }),
    async handler({ actor, params, body }) {
      return returnDeliveryDocs(requireActor(actor), params.id, (body as { note?: string }).note);
    },
  },
  {
    method: "GET",
    path: "/jobs/:id/messages",
    async handler({ actor, params }) {
      return listJobMessages(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/messages",
    input: sendJobMessageSchema,
    async handler({ actor, params, body }) {
      return sendJobMessage(requireActor(actor), params.id, body as z.infer<typeof sendJobMessageSchema>);
    },
  },
  {
    method: "GET",
    path: "/jobs/:id/extras",
    async handler({ actor, params }) {
      return listJobExtras(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/extras",
    input: requestExtraSchema,
    async handler({ actor, params, body }) {
      return requestJobExtra(requireActor(actor), params.id, body as z.infer<typeof requestExtraSchema>);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/extras/:extraId/approve",
    async handler({ actor, params }) {
      return approveJobExtra(requireActor(actor), params.id, params.extraId);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/extras/:extraId/reject",
    async handler({ actor, params }) {
      return rejectJobExtra(requireActor(actor), params.id, params.extraId);
    },
  },
  {
    method: "GET",
    path: "/jobs/:id/ratings",
    async handler({ actor, params }) {
      return listJobRatings(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/jobs/:id/ratings",
    input: createRatingSchema,
    async handler({ actor, params, body }) {
      return createJobRating(requireActor(actor), params.id, body as z.infer<typeof createRatingSchema>);
    },
  },
  {
    method: "GET",
    path: "/disputes",
    async handler({ actor }) {
      return listDisputes(requireActor(actor));
    },
  },
  {
    method: "POST",
    path: "/disputes",
    input: createDisputeSchema,
    async handler({ actor, body }) {
      return createDispute(requireActor(actor), body as z.infer<typeof createDisputeSchema>);
    },
  },
  {
    method: "GET",
    path: "/disputes/:id",
    async handler({ actor, params }) {
      return getDispute(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/disputes/:id/messages",
    input: disputeMessageSchema,
    async handler({ actor, params, body }) {
      return addDisputeMessage(requireActor(actor), params.id, body as z.infer<typeof disputeMessageSchema>);
    },
  },
  {
    method: "POST",
    path: "/disputes/:id/resolve",
    input: resolveDisputeSchema,
    async handler({ actor, params, body }) {
      return resolveDispute(requireActor(actor), params.id, body as z.infer<typeof resolveDisputeSchema>);
    },
  },
  {
    method: "GET",
    path: "/tickets",
    async handler({ actor }) {
      return listTickets(requireActor(actor));
    },
  },
  {
    method: "POST",
    path: "/tickets",
    input: createTicketSchema,
    async handler({ actor, body }) {
      return createTicket(requireActor(actor), body as z.infer<typeof createTicketSchema>);
    },
  },
  {
    method: "GET",
    path: "/tickets/:id",
    async handler({ actor, params }) {
      return getTicket(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/tickets/:id/messages",
    input: ticketMessageSchema,
    async handler({ actor, params, body }) {
      return addTicketMessage(requireActor(actor), params.id, body as z.infer<typeof ticketMessageSchema>);
    },
  },
  {
    method: "PATCH",
    path: "/tickets/:id",
    input: ticketStatusSchema,
    async handler({ actor, params, body }) {
      return updateTicketStatus(requireActor(actor), params.id, body as z.infer<typeof ticketStatusSchema>);
    },
  },
  {
    method: "GET",
    path: "/orders",
    async handler({ actor }) {
      return listOrders(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/orders/:id",
    async handler({ actor, params }) {
      return getOrderForActor(requireActor(actor), params.id);
    },
  },
  {
    method: "GET",
    path: "/admin/verifications",
    permissions: ["companies.verify", "drivers.verify"],
    async handler({ actor }) {
      return listPendingVerifications(requireActor(actor));
    },
  },
  {
    method: "POST",
    path: "/admin/companies/:id/status",
    permissions: ["companies.verify", "companies.reject", "companies.suspend"],
    input: z.object({
      status: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "BLOCKED"]),
      reason: z.string().optional(),
    }),
    async handler({ actor, params, body }) {
      const payload = body as { status: CompanyStatus; reason?: string };
      return moderateCompany(requireActor(actor), params.id, payload.status as "APPROVED" | "REJECTED" | "SUSPENDED" | "BLOCKED", payload.reason);
    },
  },
  {
    method: "POST",
    path: "/admin/drivers/:id/status",
    permissions: ["drivers.verify", "drivers.reject"],
    input: z.object({
      status: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "BLOCKED"]),
      reason: z.string().optional(),
    }),
    async handler({ actor, params, body }) {
      const payload = body as { status: "APPROVED" | "REJECTED" | "SUSPENDED" | "BLOCKED"; reason?: string };
      return moderateDriver(requireActor(actor), params.id, payload.status, payload.reason);
    },
  },
  {
    method: "GET",
    path: "/invoices",
    async handler({ actor }) {
      return listInvoices(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/invoices/:id",
    async handler({ actor, params }) {
      return getInvoice(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/invoices/:id/pay",
    async handler({ actor, params }) {
      return payInvoice(requireActor(actor), params.id);
    },
  },
  {
    method: "GET",
    path: "/drivers/:id",
    async handler({ actor, params }) {
      return getDriverProfile(requireActor(actor), params.id);
    },
  },
  {
    method: "GET",
    path: "/admin/companies/:id",
    permissions: ["companies.read"],
    async handler({ actor, params }) {
      return getCompanyProfile(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/admin/companies",
    permissions: ["companies.create"],
    input: z.object({
      tradeName: z.string().min(2),
      legalName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      taxId: z.string().optional(),
      registrationNumber: z.string().optional(),
      ownerFirstName: z.string().min(1),
      ownerLastName: z.string().min(1),
      ownerEmail: z.string().email(),
      ownerPhone: z.string().optional(),
      ownerPassword: z.string().min(10),
    }),
    async handler({ actor, body }) {
      return createCargoCompany(requireActor(actor), body as Parameters<typeof createCargoCompany>[1]);
    },
  },
  {
    method: "GET",
    path: "/admin/companies/:id/price-book",
    permissions: ["companies.read"],
    async handler({ actor, params }) {
      return getPriceBookForCompany(requireActor(actor), params.id);
    },
  },
  {
    method: "PUT",
    path: "/admin/companies/:id/price-book",
    permissions: ["companies.update"],
    input: z.object({
      name: z.string().min(2),
      status: z.enum(["DRAFT", "ACTIVE"]).optional(),
      validFrom: z.string().nullable().optional(),
      validTo: z.string().nullable().optional(),
      currencyCode: z.string().optional(),
      unitCode: z.string().optional(),
      channels: z.array(z.string()).optional(),
      terms: z.string().nullable().optional(),
      settlementDays: z.number().int().nullable().optional(),
      stopAfterUnpaidDays: z.number().int().nullable().optional(),
      serviceAmount: z.number().nullable().optional(),
      lines: z.array(
        z.object({
          zoneName: z.string(),
          provinces: z.array(z.string()),
          minQuantity: z.number().int(),
          maxQuantity: z.number().int().nullable().optional(),
          rateType: z.enum(["PER_UNIT", "SERVICE"]),
          unitPrice: z.number().nullable().optional(),
          sortOrder: z.number().int().optional(),
        }),
      ),
    }),
    async handler({ actor, params, body }) {
      return upsertPriceBook(requireActor(actor), params.id, body as Parameters<typeof upsertPriceBook>[2]);
    },
  },
  {
    method: "GET",
    path: "/price-books/me",
    async handler({ actor }) {
      return getOwnPriceBook(requireActor(actor));
    },
  },
  {
    method: "GET",
    path: "/price-books/quote",
    async handler({ actor, query }) {
      const a = requireActor(actor);
      const companyId = a.memberships.find((m) => m.companyType === "REQUESTER")?.companyId;
      if (!companyId) throw Errors.forbidden();
      const destinationCity = query.get("destinationCity") ?? "";
      const quantity = Number(query.get("quantity") ?? 0);
      return quotePrice(companyId, destinationCity, quantity);
    },
  },
  {
    method: "GET",
    path: "/admin/drivers",
    permissions: ["drivers.read"],
    async handler() {
      return prisma.driverProfile.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, phone: true, email: true } },
          carrier: { include: { company: { select: { id: true, tradeName: true } } } },
          vehicles: { include: { vehicle: { select: { plateNumber: true, vehicleType: true, status: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    },
  },
  {
    method: "GET",
    path: "/admin/companies",
    permissions: ["companies.read"],
    async handler() {
      return prisma.company.findMany({
        where: { type: { not: "PLATFORM" } },
        include: { supplierProfile: true, carrierProfile: true, priceBooks: { include: { lines: { select: { id: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    },
  },
  {
    method: "GET",
    path: "/admin/users",
    permissions: ["users.read"],
    async handler() {
      return prisma.user.findMany({
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          memberships: { include: { company: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    },
  },
  {
    method: "GET",
    path: "/admin/audit-logs",
    permissions: ["audit_logs.read"],
    async handler({ query }) {
      const take = Math.min(Number(query.get("pageSize") ?? 50), 100);
      return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take });
    },
  },
  {
    method: "GET",
    path: "/documents/checklist",
    async handler({ actor, query }) {
      const kind = (query.get("kind") ?? "company") as "driver" | "company" | "vehicle" | "job";
      const entityId = query.get("entityId") ?? "";
      return buildChecklist(requireActor(actor), kind, entityId);
    },
  },
  {
    method: "GET",
    path: "/documents/me",
    async handler({ actor }) {
      return getOwnChecklist(requireActor(actor));
    },
  },
  {
    method: "DELETE",
    path: "/documents/:id",
    permissions: ["documents.delete", "documents.upload"],
    async handler({ actor, params }) {
      return deleteDocument(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/documents/:id/verify",
    permissions: ["documents.verify"],
    input: z.object({ verification: z.enum(["VERIFIED", "REJECTED"]) }),
    async handler({ actor, params, body }) {
      return verifyDocument(requireActor(actor), params.id, (body as { verification: "VERIFIED" | "REJECTED" }).verification);
    },
  },
  {
    method: "GET",
    path: "/wallet",
    permissions: ["wallet.read"],
    async handler({ actor }) {
      return getWallet(requireActor(actor));
    },
  },
  {
    method: "POST",
    path: "/wallet/accounts",
    permissions: ["wallet.manage"],
    input: z.object({ name: z.string().min(2), kind: z.enum(["MAIN", "INCOME", "VEHICLE", "TRAVEL", "CUSTOM"]).optional() }),
    async handler({ actor, body }) {
      return createWalletAccount(requireActor(actor), body as { name: string; kind?: "MAIN" | "INCOME" | "VEHICLE" | "TRAVEL" | "CUSTOM" });
    },
  },
  {
    method: "PATCH",
    path: "/wallet/accounts/:id",
    permissions: ["wallet.manage"],
    input: z.object({ name: z.string().min(2).optional(), isDefault: z.boolean().optional() }),
    async handler({ actor, params, body }) {
      return updateWalletAccount(requireActor(actor), params.id, body as { name?: string; isDefault?: boolean });
    },
  },
  {
    method: "POST",
    path: "/wallet/topup",
    permissions: ["wallet.manage"],
    input: z.object({
      amount: z.number().positive(),
      accountId: z.string().optional(),
      bankAccountId: z.string().optional(),
      method: z.string().optional(),
    }),
    async handler({ actor, body }) {
      return topUpWallet(requireActor(actor), body as { amount: number; accountId?: string; bankAccountId?: string; method?: string });
    },
  },
  {
    method: "POST",
    path: "/wallet/expenses",
    permissions: ["wallet.manage"],
    input: z.object({
      amount: z.number().positive(),
      kind: z.enum(["VEHICLE", "TRAVEL"]),
      category: z.string().min(2),
      title: z.string().optional(),
      note: z.string().optional(),
      accountId: z.string().optional(),
      occurredAt: z.string().optional(),
    }),
    async handler({ actor, body }) {
      return addWalletExpense(
        requireActor(actor),
        body as {
          amount: number;
          kind: "VEHICLE" | "TRAVEL";
          category: string;
          title?: string;
          note?: string;
          accountId?: string;
          occurredAt?: string;
        },
      );
    },
  },
  {
    method: "POST",
    path: "/wallet/transfer",
    permissions: ["wallet.manage"],
    input: z.object({
      fromAccountId: z.string(),
      toAccountId: z.string(),
      amount: z.number().positive(),
      note: z.string().optional(),
    }),
    async handler({ actor, body }) {
      return transferWallet(requireActor(actor), body as { fromAccountId: string; toAccountId: string; amount: number; note?: string });
    },
  },
  {
    method: "POST",
    path: "/wallet/withdraw",
    permissions: ["wallet.manage"],
    input: z.object({ amount: z.number().positive(), bankAccountId: z.string(), accountId: z.string().optional() }),
    async handler({ actor, body }) {
      return withdrawWallet(requireActor(actor), body as { amount: number; bankAccountId: string; accountId?: string });
    },
  },
  {
    method: "POST",
    path: "/wallet/banks",
    permissions: ["wallet.manage"],
    input: z.object({
      bankName: z.string().min(2).optional(),
      accountHolder: z.string().min(3).optional(),
      iban: z.string().min(10),
      cardLast4: z.string().optional(),
    }),
    async handler({ actor, body }) {
      return addBankAccount(requireActor(actor), body as { bankName?: string; accountHolder?: string; iban: string; cardLast4?: string });
    },
  },
  {
    method: "POST",
    path: "/wallet/zarinpal/verify",
    permissions: ["wallet.manage"],
    input: z.object({ authority: z.string().min(1), status: z.string().optional() }),
    async handler({ actor, body }) {
      const data = body as { authority: string; status?: string };
      return verifyZarinpalTopup({ authority: data.authority, status: data.status ?? "" }, requireActor(actor));
    },
  },
  {
    method: "POST",
    path: "/wallet/banks/:id/connect",
    permissions: ["wallet.manage"],
    async handler({ actor, params }) {
      return connectBankAccount(requireActor(actor), params.id);
    },
  },
  {
    method: "POST",
    path: "/wallet/banks/:id/disconnect",
    permissions: ["wallet.manage"],
    async handler({ actor, params }) {
      return disconnectBankAccount(requireActor(actor), params.id);
    },
  },
  {
    method: "GET",
    path: "/admin/business-rules",
    permissions: ["business_rules.manage", "settings.read"],
    async handler() {
      return getAllRules();
    },
  },
  {
    method: "PATCH",
    path: "/admin/business-rules/:key",
    permissions: ["business_rules.manage"],
    input: z.object({ value: z.unknown(), description: z.string().optional() }),
    async handler({ actor, params, body }) {
      const a = requireActor(actor);
      assertPermission(a, "business_rules.manage");
      const payload = body as { value: unknown; description?: string };
      return prisma.businessRule.upsert({
        where: { key: params.key },
        create: { key: params.key, value: payload.value as object, description: payload.description ?? params.key },
        update: { value: payload.value as object, description: payload.description },
      });
    },
  },
];
