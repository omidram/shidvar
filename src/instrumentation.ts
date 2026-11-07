export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { execFileSync } = await import("node:child_process");
  const { existsSync } = await import("node:fs");
  const path = await import("node:path");
  const candidates = [
    path.join(process.cwd(), "scripts", "blank-slate.mjs"),
    path.join(process.cwd(), "..", "..", "scripts", "blank-slate.mjs"),
  ];
  const script = candidates.find((file) => existsSync(file));
  if (!script) {
    console.error("Blank slate skipped: scripts/blank-slate.mjs was not found.");
    return;
  }
  try {
    execFileSync(process.execPath, [script], {
      cwd: path.resolve(path.dirname(script), ".."),
      env: process.env,
      stdio: "inherit",
    });
  } catch (error) {
    console.error("Blank slate failed.", error instanceof Error ? error.message : error);
  }
}
