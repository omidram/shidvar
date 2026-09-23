import type { RouteDefinition } from "@/server/http/router";

export function buildOpenApi(routes: RouteDefinition[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of routes) {
    const path = route.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    paths[path] ??= {};
    paths[path][route.method.toLowerCase()] = {
      summary: `${route.method} ${route.path}`,
      security: route.auth === false ? [] : [{ cookieAuth: [] }],
      "x-permissions": route.permissions ?? [],
      responses: {
        "200": { description: "Envelope { success, data, message, meta }" },
        "400": { description: "VALIDATION_ERROR" },
        "401": { description: "AUTH_REQUIRED" },
        "403": { description: "FORBIDDEN" },
        "404": { description: "NOT_FOUND" },
        "409": { description: "CONFLICT or INVALID_STATE_TRANSITION" },
      },
    };
  }
  return {
    openapi: "3.0.3",
    info: { title: "Shidvar API", version: "1.0.0" },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "sc_session" },
      },
    },
    paths,
  };
}
