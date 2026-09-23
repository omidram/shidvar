import { cookies } from "next/headers";
import { COOKIES, config } from "@/server/config";

const SESSION_MINUTES = 30;
const REFRESH_DAYS = 14;

export function sessionMaxAgeSeconds() {
  return SESSION_MINUTES * 60;
}

export function refreshMaxAgeSeconds() {
  return REFRESH_DAYS * 24 * 60 * 60;
}

export async function setAuthCookies(sessionToken: string, refreshToken: string) {
  const jar = await cookies();
  const secure = config.isProd;
  jar.set(COOKIES.session, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  });
  jar.set(COOKIES.refresh, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: refreshMaxAgeSeconds(),
  });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(COOKIES.session);
  jar.delete(COOKIES.refresh);
}

export async function readSessionToken() {
  const jar = await cookies();
  return jar.get(COOKIES.session)?.value ?? null;
}

export async function readRefreshToken() {
  const jar = await cookies();
  return jar.get(COOKIES.refresh)?.value ?? null;
}

export function cookieHeader(name: string, value: string, maxAge: number) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (config.isProd) parts.push("Secure");
  return parts.join("; ");
}
