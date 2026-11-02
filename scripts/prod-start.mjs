import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "5500";
const ensure = path.join(root, "scripts", "ensure-schema.mjs");
const standalone = path.join(root, ".next", "standalone", "server.js");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const sync = spawnSync(process.execPath, [ensure], { cwd: root, env: process.env, stdio: "inherit" });
if ((sync.status ?? 1) !== 0) process.exit(sync.status ?? 1);

// Bind every interface. A public IP or the machine hostname makes nginx on 127.0.0.1 return 502.
const env = { ...process.env, PORT: port, HOSTNAME: "0.0.0.0" };

if (existsSync(standalone)) {
  const standaloneDir = path.dirname(standalone);
  const staticSrc = path.join(root, ".next", "static");
  const publicSrc = path.join(root, "public");
  if (existsSync(staticSrc)) cpSync(staticSrc, path.join(standaloneDir, ".next", "static"), { recursive: true });
  if (existsSync(publicSrc)) cpSync(publicSrc, path.join(standaloneDir, "public"), { recursive: true });
  console.log(`Starting standalone server on 0.0.0.0:${port}…`);
  const child = spawn(process.execPath, [standalone], { cwd: standaloneDir, env, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
} else {
  console.warn('Standalone build missing; falling back to "next start". Run "npm run build" first.');
  const child = spawn(process.execPath, [nextBin, "start", "--port", port], { cwd: root, env, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}
