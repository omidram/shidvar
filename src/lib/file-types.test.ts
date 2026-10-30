import { describe, expect, it } from "vitest";
import { checkUpload, MAX_UPLOAD_BYTES, sniffFileType } from "./file-types";

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("checkUpload", () => {
  it("accepts a real pdf and a real jpeg", () => {
    expect(checkUpload({ name: "a.pdf", size: 10, bytes: pdf, mimeType: "application/pdf" })).toEqual({ ok: true, kind: "pdf" });
    expect(checkUpload({ name: "a.JPG", size: 10, bytes: jpeg, mimeType: "image/jpeg" })).toEqual({ ok: true, kind: "jpeg" });
    expect(checkUpload({ name: "a.jpeg", size: 10, bytes: jpeg })).toEqual({ ok: true, kind: "jpeg" });
  });

  it("rejects other formats and renamed files", () => {
    expect(checkUpload({ name: "a.webp", size: 10 }).ok).toBe(false);
    expect(checkUpload({ name: "a.heic", size: 10 }).ok).toBe(false);
    expect(checkUpload({ name: "a.exe", size: 10, bytes: pdf }).ok).toBe(false);
    expect(checkUpload({ name: "a.pdf", size: 10, bytes: jpeg }).ok).toBe(false);
    expect(checkUpload({ name: "a.jpg", size: 10, bytes: new Uint8Array([1, 2, 3, 4]) }).ok).toBe(false);
  });

  it("allows png only for e-signature slots", () => {
    expect(checkUpload({ name: "s.png", size: 10, bytes: png }).ok).toBe(false);
    expect(checkUpload({ name: "s.png", size: 10, bytes: png, allowPng: true })).toEqual({ ok: true, kind: "png" });
  });

  it("limits size", () => {
    expect(checkUpload({ name: "a.pdf", size: 0, bytes: pdf }).ok).toBe(false);
    expect(checkUpload({ name: "a.pdf", size: MAX_UPLOAD_BYTES + 1, bytes: pdf }).ok).toBe(false);
  });

  it("sniffs signatures", () => {
    expect(sniffFileType(pdf)).toBe("pdf");
    expect(sniffFileType(jpeg)).toBe("jpeg");
    expect(sniffFileType(png)).toBe("png");
    expect(sniffFileType(new Uint8Array([0]))).toBeNull();
  });
});
