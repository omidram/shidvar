import { NextRequest } from "next/server";
import { dispatch } from "@/server/http/router";
import { routes } from "@/server/http/routes";

type Ctx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return dispatch(req, path, routes);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
