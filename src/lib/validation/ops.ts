import { z } from "zod";

export const extraKinds = ["DETENTION", "WAITING", "EXTRA_LABOR", "FUEL", "RETURN", "OTHER"] as const;
export type ExtraKind = (typeof extraKinds)[number];

export const sendJobMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const requestExtraSchema = z.object({
  kind: z.enum(extraKinds),
  amount: z.number().positive().max(500_000_000),
  note: z.string().trim().max(500).optional(),
});

export const createRatingSchema = z.object({
  overall: z.number().int().min(1).max(5),
  punctuality: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(500).optional(),
});

export const createDisputeSchema = z.object({
  jobId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  reason: z.enum(["DAMAGE", "SHORTAGE", "DELAY", "OVERCHARGE", "NO_SHOW", "OTHER"]),
  description: z.string().trim().min(8).max(2000),
});

export const disputeMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const resolveDisputeSchema = z.object({
  status: z.enum(["RESOLVED", "REJECTED", "CLOSED"]),
  resolution: z.string().trim().min(4).max(2000),
});

export const createTicketSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  category: z.enum(["BILLING", "LOAD", "ACCOUNT", "TRACKING", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  body: z.string().trim().min(8).max(2000),
  relatedType: z.string().optional(),
  relatedId: z.string().optional(),
});

export const ticketMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const ticketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"]),
});
