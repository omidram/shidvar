import type { z } from "zod";
import type { Portal } from "@prisma/client";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { hashPassword, passwordPolicy, verifyPassword } from "@/server/auth/password";
import { createSession, revokeUserSessions } from "@/server/auth/session";
import { hashToken, randomToken } from "@/server/auth/tokens";
import { writeAudit } from "@/server/audit";
import { getRule } from "@/server/settings/rules";
import { logger } from "@/server/logger";
import { config } from "@/server/config";
import { sendLoginSmsOtp } from "@/server/notify/sms-otp";
import type { Actor } from "@/server/rbac/actor";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyLoginOtpSchema,
  resendLoginOtpSchema,
} from "@/lib/validation/auth";
import type { TwoFactorChannel } from "@/lib/settings";

export { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, verifyLoginOtpSchema, resendLoginOtpSchema };

export type LoginOtpChallenge = {
  kind: "otp";
  challengeId: string;
  channel: TwoFactorChannel;
  destination: string;
  expiresInSec: number;
  devCode?: string;
};

export type LoginSession = {
  kind: "session";
  tokens: { sessionToken: string; refreshToken: string };
};

const loginWindow = new Map<string, { count: number; resetAt: number }>();

function hitRateLimit(key: string, max = 20, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const current = loginWindow.get(key);
  if (!current || current.resetAt < now) {
    loginWindow.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > max) throw Errors.rateLimited();
}

function publicActor(actor: Actor) {
  return {
    userId: actor.userId,
    email: actor.email,
    phone: actor.phone,
    firstName: actor.firstName,
    lastName: actor.lastName,
    status: actor.status,
    locale: actor.locale,
    isPlatformStaff: actor.isPlatformStaff,
    permissions: [...actor.permissions],
    memberships: actor.memberships,
    driverProfile: actor.driverProfile,
    portal: actor.portal,
  };
}

export async function registerUser(input: z.infer<typeof registerSchema>, meta: { ip?: string; userAgent?: string }) {
  const policy = passwordPolicy(input.password);
  if (policy.length) throw Errors.validation({ password: policy });

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email.toLowerCase() }, ...(input.phone ? [{ phone: input.phone }] : [])] },
  });
  if (existing) throw Errors.conflict("An account with this email or phone already exists");

  const passwordHash = await hashPassword(input.password);
  const companyType = input.portal === "DRIVER" ? "CARRIER" : input.portal;
  const roleCode = input.portal === "REQUESTER" ? "REQUESTER_OWNER" : input.portal === "SUPPLIER" ? "SUPPLIER_OWNER" : "DRIVER";

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        phone: input.phone,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: config.isProd ? "PENDING_VERIFICATION" : "ACTIVE",
        emailVerifiedAt: config.isProd ? null : new Date(),
      },
    });
    const company = await tx.company.create({
      data: {
        type: companyType,
        status: "UNDER_REVIEW",
        legalName: input.companyName,
        tradeName: input.companyName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        taxId: input.taxId,
        registrationNumber: input.registrationNumber,
      },
    });
    await tx.membership.create({
      data: { userId: user.id, companyId: company.id, isOwner: true, status: "ACTIVE" },
    });
    const role = await tx.role.findFirst({ where: { code: roleCode, isSystem: true } });
    if (role) {
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id, companyId: company.id } });
    }
    if (input.portal === "SUPPLIER") {
      await tx.supplierProfile.create({ data: { companyId: company.id, status: "UNDER_REVIEW" } });
    }
    let driverProfileId: string | undefined;
    let vehicleId: string | undefined;
    if (input.portal === "DRIVER") {
      await tx.carrierProfile.create({ data: { companyId: company.id, status: "UNDER_REVIEW" } });
      const driver = await tx.driverProfile.create({
        data: {
          userId: user.id,
          carrierCompanyId: company.id,
          status: "UNDER_REVIEW",
          licenseNumber: input.licenseNumber,
          licenseType: input.licenseType,
          nationalIdMasked: input.nationalId ? `****${input.nationalId.slice(-4)}` : null,
        },
      });
      driverProfileId = driver.id;
      if (input.plateNumber) {
        const vehicle = await tx.vehicle.create({
          data: {
            companyId: company.id,
            plateNumber: input.plateNumber,
            vehicleType: input.vehicleType ?? "TRUCK",
            weightCapacity: 8,
          },
        });
        await tx.driverVehicle.create({ data: { driverId: driver.id, vehicleId: vehicle.id, isPrimary: true } });
        vehicleId = vehicle.id;
      }
    }
    return { user, company, driverProfileId, vehicleId };
  });
  if (input.portal === "REQUESTER") {
    const { ensurePriceBook } = await import("@/server/domains/finance/price-book-service");
    await ensurePriceBook(result.company.id, `دفترچه قیمت ${result.company.tradeName}`);
  }

  await writeAudit({
    actor: null,
    action: "user.registered",
    entityType: "User",
    entityId: result.user.id,
    newValue: { portal: input.portal, companyId: result.company.id },
    ipAddress: meta.ip,
  });

  const tokens = await createSession(result.user.id, { ...meta, portal: input.portal });
  return { tokens, companyId: result.company.id, userId: result.user.id, driverProfileId: result.driverProfileId, vehicleId: result.vehicleId };
}

export async function loginUser(input: z.infer<typeof loginSchema>, meta: { ip?: string; userAgent?: string }) {
  hitRateLimit(`login:${meta.ip ?? "unknown"}`);
  const identifier = input.identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: input.identifier.trim() }],
    },
  });
  if (!user) throw Errors.unauthorized("Invalid credentials");

  const maxFails = await getRule<number>("auth.maxFailedLogins", 5);
  const lockMinutes = await getRule<number>("auth.lockoutMinutes", 15);
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw Errors.locked();
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    const fails = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: fails,
        lockedUntil: fails >= maxFails ? new Date(Date.now() + lockMinutes * 60 * 1000) : null,
      },
    });
    throw Errors.unauthorized("Invalid credentials");
  }

  if (user.status === "BLOCKED" || user.status === "DEACTIVATED") {
    throw Errors.forbidden("Account is not allowed to sign in");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  if (user.twoFactorEnabled) {
    return issueLoginOtp(user, input.portal as Portal | undefined);
  }

  return completeLogin(user.id, input.portal as Portal | undefined, meta);
}

function twoFactorChannelOf(user: { twoFactorSecret: string | null; email: string | null; phone: string | null }): {
  channel: TwoFactorChannel;
  target: string;
} {
  const preferred = user.twoFactorSecret === "SMS" ? "SMS" : "EMAIL";
  if (preferred === "SMS" && user.phone) return { channel: "SMS", target: user.phone };
  if (preferred === "EMAIL" && user.email) return { channel: "EMAIL", target: user.email };
  if (user.phone) return { channel: "SMS", target: user.phone };
  if (user.email) return { channel: "EMAIL", target: user.email };
  throw Errors.forbidden("برای ورود دو مرحله‌ای موبایل یا ایمیل لازم است");
}

function maskDestination(channel: TwoFactorChannel, target: string) {
  if (channel === "EMAIL") {
    const [name, domain] = target.split("@");
    if (!domain) return target;
    const visible = name.slice(0, 1);
    return `${visible}***@${domain}`;
  }
  const digits = target.replace(/\D/g, "");
  if (digits.length < 7) return "۰۹*****";
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

function sixDigitCode() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

async function issueLoginOtp(
  user: { id: string; email: string | null; phone: string | null; twoFactorSecret: string | null },
  portal?: Portal,
): Promise<LoginOtpChallenge> {
  const { channel, target } = twoFactorChannelOf(user);
  const code = sixDigitCode();
  await prisma.credentialChallenge.updateMany({
    where: { userId: user.id, type: "LOGIN_OTP", consumedAt: null },
    data: { consumedAt: new Date() },
  });
  const challenge = await prisma.credentialChallenge.create({
    data: {
      userId: user.id,
      type: "LOGIN_OTP",
      target: `${channel}:${target}:${portal ?? ""}`,
      tokenHash: hashToken(code),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });
  let delivered = false;
  if (channel === "SMS") {
    delivered = await sendLoginSmsOtp(target, code);
  } else {
    logger.info("login_otp_email_queued", { userId: user.id, target: maskDestination(channel, target) });
  }
  logger.info("login_otp_issued", { userId: user.id, channel, target: maskDestination(channel, target), delivered });
  return {
    kind: "otp",
    challengeId: challenge.id,
    channel,
    destination: maskDestination(channel, target),
    expiresInSec: 300,
    ...(delivered || config.isProd ? {} : { devCode: code }),
  };
}

async function completeLogin(userId: string, portal: Portal | undefined, meta: { ip?: string; userAgent?: string }): Promise<LoginSession> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
  const tokens = await createSession(userId, { ...meta, portal });
  await writeAudit({
    actor: null,
    action: "user.login",
    entityType: "User",
    entityId: userId,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { kind: "session", tokens };
}

export async function verifyLoginOtp(input: z.infer<typeof verifyLoginOtpSchema>, meta: { ip?: string; userAgent?: string }) {
  hitRateLimit(`otp:${meta.ip ?? "unknown"}`, 30);
  const challenge = await prisma.credentialChallenge.findUnique({ where: { id: input.challengeId } });
  if (!challenge || challenge.type !== "LOGIN_OTP" || !challenge.userId || challenge.consumedAt || challenge.expiresAt < new Date()) {
    throw Errors.unauthorized("کد ورود نادرست یا منقضی است");
  }
  if (hashToken(input.code.replace(/\s/g, "")) !== challenge.tokenHash) {
    throw Errors.unauthorized("کد ورود نادرست یا منقضی است");
  }
  await prisma.credentialChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  const portal = (challenge.target.split(":")[2] || input.portal) as Portal | undefined;
  return completeLogin(challenge.userId, portal || input.portal, meta);
}

export async function resendLoginOtp(input: z.infer<typeof resendLoginOtpSchema>) {
  const challenge = await prisma.credentialChallenge.findUnique({
    where: { id: input.challengeId },
    include: { user: true },
  });
  if (!challenge?.user || challenge.type !== "LOGIN_OTP") {
    throw Errors.unauthorized("کد ورود نادرست یا منقضی است");
  }
  const portal = (challenge.target.split(":")[2] || undefined) as Portal | undefined;
  return issueLoginOtp(challenge.user, portal);
}

export async function logoutUser(userId: string) {
  await revokeUserSessions(userId);
}

export function serializeActor(actor: Actor) {
  return publicActor(actor);
}

export async function requestPasswordReset(input: z.infer<typeof forgotPasswordSchema>) {
  const identifier = input.identifier.trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { phone: identifier }] },
  });
  if (!user) return { sent: true as const };
  const token = randomToken();
  await prisma.credentialChallenge.create({
    data: {
      userId: user.id,
      type: "PASSWORD_RESET",
      target: user.email ?? user.phone ?? user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  logger.info("password_reset_issued", { userId: user.id });
  return config.isProd ? { sent: true as const } : { sent: true as const, devToken: token };
}

export async function resetPassword(input: z.infer<typeof resetPasswordSchema>) {
  const policy = passwordPolicy(input.password);
  if (policy.length) throw Errors.validation({ password: policy });
  const challenge = await prisma.credentialChallenge.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });
  if (!challenge || challenge.type !== "PASSWORD_RESET" || challenge.consumedAt || challenge.expiresAt < new Date()) {
    throw Errors.unauthorized("Reset token is invalid or expired");
  }
  if (!challenge.userId) throw Errors.unauthorized("Reset token is invalid or expired");
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: challenge.userId! },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    await tx.credentialChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    await tx.session.updateMany({
      where: { userId: challenge.userId!, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.refreshToken.updateMany({
      where: { userId: challenge.userId!, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
  await writeAudit({
    actor: null,
    action: "user.password_reset",
    entityType: "User",
    entityId: challenge.userId,
  });
  return { reset: true as const };
}
