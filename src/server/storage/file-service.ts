import { mkdir, unlink, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomToken } from "@/server/auth/tokens";
import { config } from "@/server/config";
import { Errors } from "@/server/errors";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

export type StoredFile = {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
};

export const FileService = {
  async validate(file: { mimeType: string; sizeBytes: number; originalName: string }) {
    if (file.sizeBytes <= 0 || file.sizeBytes > 20 * 1024 * 1024) {
      throw Errors.validation({ file: ["File must be between 1 byte and 20MB"] });
    }
    if (!ALLOWED_MIME.has(file.mimeType)) {
      throw Errors.validation({ file: ["Unsupported file type"] });
    }
    return true;
  },

  async upload(input: { buffer: Buffer; mimeType: string; originalName: string }): Promise<StoredFile> {
    await this.validate({
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      originalName: input.originalName,
    });
    const key = `${new Date().toISOString().slice(0, 10)}/${randomToken(18)}`;
    if (config.storageDriver === "local") {
      const full = path.join(config.storageLocalPath, key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, input.buffer);
    }
    return {
      storageKey: key,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      originalName: input.originalName,
    };
  },

  async read(storageKey: string) {
    const full = path.join(config.storageLocalPath, storageKey);
    return readFile(full);
  },

  async delete(storageKey: string) {
    const full = path.join(config.storageLocalPath, storageKey);
    await unlink(full).catch(() => undefined);
  },

  async generateSignedUrl(storageKey: string) {
    return `/api/v1/documents/download?key=${encodeURIComponent(storageKey)}`;
  },
};
