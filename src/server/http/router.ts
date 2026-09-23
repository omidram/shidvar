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
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const from = new URL(origin);
    const app = new URL(config.appUrl);
    if (from.origin === app.origin) return true;
    const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
    return from.protocol === app.protocol && from.port === (app.port || (app.protocol === "https:" ? "443" : "80")) && loopback.has(from.hostname) && loopback.has(app.hostname);
  } catch {
    return false;
  }
}

export async function dispatch(req: NextRequest, pathParts: string[], routes: RouteDefinition[]) {
  const path = "/" + pathParts.join("/");
  const method = req.method as HttpMethod;
  try {
    if (!originAllowed(req)) {
      throw Errors.forbidden("Invalid origin");
    }

    const matched = routes
      .map((route) => ({ route, params: matchPath(route.path, path) }))
      .find((entry) => entry.params && entry.route.method === method);

    if (!matched?.params) {
      throw Errors.notFound("Endpoint not found");
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
        throw Errors.validation(zodFields(parsed.error));
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
      return Response.json(fail("VALIDATION_ERROR", "Invalid JSON"), { status: 400 });
    }
    if (isDatabaseUnavailable(error)) {
      const mapped = databaseUnavailableError(error);
      logger.error("database_unavailable", { path, method, code: prismaErrorCode(error) });
      return Response.json(fail(mapped.code, mapped.message), { status: mapped.status });
    }
    const err = error && typeof error === "object" ? (error as { name?: string; message?: string }) : {};
    logger.error("unhandled_api_error", { path, method, name: err.name, code: prismaErrorCode(error) });
    return Response.json(fail("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
