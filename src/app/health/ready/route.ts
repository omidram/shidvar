import { prisma } from "@/server/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ success: true, data: { ready: true, database: "up" } });
  } catch {
    return Response.json(
      { success: false, error: { code: "NOT_READY", message: "Database unavailable" } },
      { status: 503 },
    );
  }
}
