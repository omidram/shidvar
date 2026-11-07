import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { Errors } from "@/server/errors";

export function runBlankSlate() {
  const candidates = [
    path.resolve(process.cwd(), "scripts", "blank-slate.mjs"),
    path.resolve(process.cwd(), "..", "..", "scripts", "blank-slate.mjs"),
  ];
  const script = candidates.find((file) => existsSync(file));
  if (!script) throw Errors.conflict("دستور پاک‌سازی روی این نسخه از سرور پیدا نشد");
  return execFileSync(process.execPath, [script], {
    cwd: path.resolve(path.dirname(script), ".."),
    env: { ...process.env, SHIDVAR_BLANK_FORCE: "1" },
    encoding: "utf8",
  });
}
