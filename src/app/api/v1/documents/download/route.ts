import { NextRequest } from "next/server";
import { actorFromRequest, requireActor } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { fail } from "@/server/http/envelope";
import { getDocumentForDownload } from "@/server/domains/documents/document-service";

export async function GET(req: NextRequest) {
  try {
    const actor = requireActor(await actorFromRequest(req));
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return Response.json(fail("VALIDATION_ERROR", "شناسه مدرک لازم است"), { status: 400 });
    const file = await getDocumentForDownload(actor, id);
    const bytes = new Uint8Array(file.buffer.byteLength);
    bytes.set(file.buffer);
    const mimeType = file.mimeType || "application/octet-stream";
    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=120",
    };
    if (mimeType.includes("pdf")) headers["Content-Disposition"] = 'inline; filename="file.pdf"';
    return new Response(bytes, { headers });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(fail(error.code, error.message, error.fields), { status: error.status });
    }
    return Response.json(fail("INTERNAL_ERROR", "دانلود ناموفق بود"), { status: 500 });
  }
}
