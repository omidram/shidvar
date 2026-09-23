import { NextRequest } from "next/server";
import { actorFromRequest, requireActor } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { fail, ok } from "@/server/http/envelope";
import { uploadDocument } from "@/server/domains/documents/document-service";

export async function POST(req: NextRequest) {
  try {
    const actor = requireActor(await actorFromRequest(req));
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json(fail("VALIDATION_ERROR", "فایل ارسال نشده", { file: ["فایل الزامی است"] }), { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await uploadDocument(actor, {
      buffer,
      mimeType: file.type || "application/octet-stream",
      originalName: file.name,
      documentType: String(form.get("documentType") ?? ""),
      entityType: String(form.get("entityType") ?? ""),
      entityId: String(form.get("entityId") ?? ""),
    });
    return Response.json(ok(data));
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(fail(error.code, error.message, error.fields), { status: error.status });
    }
    return Response.json(fail("INTERNAL_ERROR", "بارگذاری ناموفق بود"), { status: 500 });
  }
}
