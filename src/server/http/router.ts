import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Actor } from "@/server/rbac/actor";
import { actorFromRequest, requireActor } from "@/server/auth/session";
import { actorCan } from "@/server/rbac/actor";
import { AppError, Errors } from "@/server/errors";
import { databaseUnavailableError, isDatabaseUnavailable, prismaErrorCode } from "@/server/http/database-error";
import { fail, ok, zodFields } from "@/server/http/envelope";
import { logger } from "@/server/logger";
import { config } from "@/server/config";
import { isAllowedRequestOrigin, PRODUCTION_ORIGINS } from "@/server/http/origin";
import { installFaErrorMap } from "@/lib/validation/zod-fa";

installFaErrorMap();

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type RouteContext = {
  req: NextRequest;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  actor: Actor | null;
};

export type RouteDefinition = {
  method: HttpMethod;
  path: string;
  auth?: boolean;
  permissions?: string[];
  input?: z.ZodType;
  handler: (ctx: RouteContext) => Promise<unknown>;
};

function matchPath(pattern: string, actual: string) {
  const p = pattern.split("/").filter(Boolean);
  const a = actual.split("/").filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

function originAllowed(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return true;
  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return isAllowedRequestOrigin(req.headers.get("origin"), [
    config.appUrl,
    req.nextUrl.origin,
    req.headers.get("host"),
    req.headers.get("x-forwarded-host")?.split(",")[0],
    ...PRODUCTION_ORIGINS,
    ...extra,
  ]);
}

export async function dispatch(req: NextRequest, pathParts: string[], routes: RouteDefinition[]) {
  const path = "/" + pathParts.join("/");
  const method = req.method as HttpMethod;
  try {
    if (!originAllowed(req)) {
      throw Errors.forbidden("درخواست از مبدأ نامعتبر ارسال شده است");
    }

    const matched = routes
      .map((route) => ({ route, params: matchPath(route.path, path) }))
      .find((entry) => entry.params && entry.route.method === method);

    if (!matched?.params) {
      throw Errors.notFound("آدرس درخواستی پیدا نشد");
    }

    const actor = await actorFromRequest(req);
    if (matched.route.auth !== false) {
      requireActor(actor);
    }
    if (matched.route.permissions?.length && actor) {
      const allowed = matched.route.permissions.some((p) => actorCan(actor, p));
      if (!allowed) throw Errors.forbidden();
    }

    let body: unknown = undefined;
    if (method !== "GET" && method !== "DELETE") {
      const text = await req.text();
      body = text ? JSON.parse(text) : undefined;
    }
    if (matched.route.input) {
      const parsed = matched.route.input.safeParse(body);
      if (!parsed.success) {
        const fields = zodFields(parsed.error);
        const first = Object.values(fields)[0]?.[0];
        throw Errors.validation(fields, first ?? undefined);
      }
      body = parsed.data;
    }

    const data = await matched.route.handler({
      req,
      params: matched.params,
      query: req.nextUrl.searchParams,
      body,
      actor,
    });
    if (data instanceof Response) return data;
    return Response.json(ok(data));
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(fail(error.code, error.message, error.fields), { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json(fail("VALIDATION_ERROR", "قالب درخواست معتبر نیست"), { status: 400 });
    }
    if (isDatabaseUnavailable(error)) {
      const mapped = databaseUnavailableError(error);
      logger.error("database_unavailable", { path, method, code: prismaErrorCode(error) });
      return Response.json(fail(mapped.code, mapped.message), { status: mapped.status });
    }
    const err = error && typeof error === "object" ? (error as { name?: string; message?: string }) : {};
    logger.error("unhandled_api_error", { path, method, name: err.name, code: prismaErrorCode(error) });
    return Response.json(fail("INTERNAL_ERROR", "خطایی در سرور رخ داد؛ دوباره تلاش کنید"), { status: 500 });
  }
}
