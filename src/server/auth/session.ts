import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import type { Portal } from "@prisma/client";
import { prisma } from "@/server/db";
import { COOKIES, config } from "@/server/config";
import { hashToken, randomToken } from "@/server/auth/tokens";
import { Errors } from "@/server/errors";
import type { Actor } from "@/server/rbac/actor";
import { SYSTEM_ROLES } from "@/server/rbac/permissions";

const SESSION_MS = 30 * 60 * 1000;
const REFRESH_MS = 14 * 24 * 60 * 60 * 1000;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: (config.appUrl ?? "").startsWith("https:"),
    path: "/",
    maxAge: Math.floor(maxAge / 1000),
  };
}

export function attachAuthCookies(res: NextResponse, sessionToken: string, refreshToken: string) {
  res.cookies.set(COOKIES.session, sessionToken, cookieOptions(SESSION_MS));
  res.cookies.set(COOKIES.refresh, refreshToken, cookieOptions(REFRESH_MS));
  return res;
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(COOKIES.session, "", { ...cookieOptions(0), maxAge: 0 });
  res.cookies.set(COOKIES.refresh, "", { ...cookieOptions(0), maxAge: 0 });
  return res;
}

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string; portal?: Portal }) {
  const sessionToken = randomToken();
  const refreshToken = randomToken();
  const familyId = randomToken(16);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + SESSION_MS),
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      portal: meta.portal,
    },
  });
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_MS),
    },
  });
  return { sessionToken, refreshToken };
}

export async function rotateRefreshToken(
  refreshToken: string,
  meta: { ip?: string; userAgent?: string; portal?: Portal },
) {
  const tokenHash = hashToken(refreshToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing || existing.expiresAt < new Date()) {
    throw Errors.unauthorized();
  }
  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.session.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw Errors.unauthorized("Refresh token reuse detected");
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const sessionToken = randomToken();
  const nextRefresh = randomToken();
  await prisma.session.create({
    data: {
      userId: existing.userId,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + SESSION_MS),
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      portal: meta.portal,
    },
  });
  await prisma.refreshToken.create({
    data: {
      userId: existing.userId,
      tokenHash: hashToken(nextRefresh),
      familyId: existing.familyId,
      rotatedFromId: existing.id,
      expiresAt: new Date(Date.now() + REFRESH_MS),
    },
  });
  return { sessionToken, refreshToken: nextRefresh };
}

export async function revokeUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function loadActorFromToken(sessionToken: string | undefined): Promise<Actor | null> {
  if (!sessionToken) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(sessionToken) },
    include: {
      user: {
        include: {
          userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          memberships: { include: { company: true } },
          driverProfile: true,
        },
      },
    },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const user = session.user;
  if (user.status === "BLOCKED" || user.status === "DEACTIVATED") return null;

  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: new Date(Date.now() + SESSION_MS) },
  });

  const permissions = new Set<string>();
  let isSuperAdmin = false;
  let isPlatformStaff = false;
  for (const assignment of user.userRoles) {
    if (assignment.role.code === "SUPER_ADMIN") isSuperAdmin = true;
    if (assignment.role.portal === "PLATFORM") isPlatformStaff = true;
    for (const rp of assignment.role.permissions) {
      permissions.add(rp.permission.code);
    }
    const bundled = SYSTEM_ROLES[assignment.role.code];
    if (bundled) {
      for (const p of bundled.permissions) permissions.add(p);
    }
  }
  if (user.driverProfile) {
    for (const p of SYSTEM_ROLES.DRIVER.permissions) permissions.add(p);
  }

  return {
    userId: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    locale: user.locale,
    permissions,
    isPlatformStaff: isPlatformStaff || isSuperAdmin,
    isSuperAdmin,
    memberships: user.memberships
      .filter((m) => m.status === "ACTIVE")
      .map((m) => ({
        companyId: m.companyId,
        companyType: m.company.type,
        companyStatus: m.company.status,
        isOwner: m.isOwner,
      })),
    driverProfile: user.driverProfile
      ? {
          id: user.driverProfile.id,
          status: user.driverProfile.status,
          carrierCompanyId: user.driverProfile.carrierCompanyId,
        }
      : null,
    portal: session.portal,
  };
}

export async function actorFromRequest(req: NextRequest) {
  return loadActorFromToken(req.cookies.get(COOKIES.session)?.value);
}

export async function actorFromCookies() {
  const jar = await cookies();
  return loadActorFromToken(jar.get(COOKIES.session)?.value);
}

export function requireActor(actor: Actor | null) {
  if (!actor) throw Errors.unauthorized();
  if (actor.status === "SUSPENDED") throw Errors.forbidden("Account is suspended");
  return actor;
}
