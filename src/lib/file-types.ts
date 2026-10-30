export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type UploadKind = "pdf" | "jpeg" | "png";

export const UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,application/pdf,image/jpeg";
export const UPLOAD_ACCEPT_IMAGE = ".jpg,.jpeg,image/jpeg";
export const UPLOAD_HINT = "فقط PDF یا JPEG (JPG)، حداکثر ۲۰ مگابایت";

const MIME_BY_KIND: Record<UploadKind, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
};

export function mimeForKind(kind: UploadKind) {
  return MIME_BY_KIND[kind];
}

/** Reads the real file signature, so a renamed file cannot sneak through. */
export function sniffFileType(bytes: Uint8Array): UploadKind | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "pdf";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  return null;
}

function extensionOf(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

export type UploadCheck = { ok: true; kind: UploadKind } | { ok: false; message: string };

/** Shared by the browser (before sending) and the server (before storing). */
export function checkUpload(input: { name: string; size: number; bytes?: Uint8Array; mimeType?: string; allowPng?: boolean }): UploadCheck {
  if (input.size <= 0) return { ok: false, message: "فایل خالی است" };
  if (input.size > MAX_UPLOAD_BYTES) return { ok: false, message: "حجم فایل بیشتر از ۲۰ مگابایت است" };
  const ext = extensionOf(input.name);
  const allowed = new Set(["pdf", "jpg", "jpeg", ...(input.allowPng ? ["png"] : [])]);
  if (!allowed.has(ext)) return { ok: false, message: "فرمت فایل مجاز نیست؛ فقط PDF یا JPEG (JPG) بارگذاری کنید" };
  if (input.mimeType) {
    const mime = input.mimeType.toLowerCase();
    const okMime = ["application/pdf", "image/jpeg", "image/jpg", "image/pjpeg", ...(input.allowPng ? ["image/png"] : []), "application/octet-stream"];
    if (!okMime.includes(mime)) return { ok: false, message: "فرمت فایل مجاز نیست؛ فقط PDF یا JPEG (JPG) بارگذاری کنید" };
  }
  if (!input.bytes) {
    return { ok: true, kind: ext === "pdf" ? "pdf" : ext === "png" ? "png" : "jpeg" };
  }
  const kind = sniffFileType(input.bytes);
  if (!kind || (kind === "png" && !input.allowPng)) {
    return { ok: false, message: "محتوای فایل با فرمت PDF یا JPEG نمی‌خواند" };
  }
  const extKind: UploadKind = ext === "pdf" ? "pdf" : ext === "png" ? "png" : "jpeg";
  if (extKind !== kind) return { ok: false, message: "پسوند فایل با محتوای آن یکی نیست" };
  return { ok: true, kind };
}
