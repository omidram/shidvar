import { mkdir, unlink, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomToken } from "@/server/auth/tokens";
import { config } from "@/server/config";
import { Errors } from "@/server/errors";
import { checkUpload, mimeForKind } from "@/lib/file-types";

export type StoredFile = {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
};

export const FileService = {
  async validate(file: { buffer: Buffer; mimeType: string; originalName: string; allowPng?: boolean }) {
    const result = checkUpload({
      name: file.originalName,
      size: file.buffer.length,
      bytes: file.buffer,
      mimeType: file.mimeType,
      allowPng: file.allowPng,
    });
    if (!result.ok) throw Errors.validation({ file: [result.message] }, result.message);
    return result.kind;
  },

  async upload(input: { buffer: Buffer; mimeType: string; originalName: string; allowPng?: boolean }): Promise<StoredFile> {
    const kind = await this.validate(input);
    const key = `${new Date().toISOString().slice(0, 10)}/${randomToken(18)}`;
    if (config.storageDriver === "local") {
      const full = path.join(config.storageLocalPath, key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, input.buffer);
    }
    return {
      storageKey: key,
      mimeType: mimeForKind(kind),
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
