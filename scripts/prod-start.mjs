import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "5500";
const ensure = path.join(root, "scripts", "ensure-schema.mjs");
const standalone = path.join(root, ".next", "standalone", "server.js");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const sync = spawnSync(process.execPath, [ensure], { cwd: root, env: process.env, stdio: "inherit" });
if ((sync.status ?? 1) !== 0) process.exit(sync.status ?? 1);

const env = { ...process.env, PORT: port, HOSTNAME: process.env.HOSTNAME || "185.165.119.9" };

if (existsSync(standalone)) {
  console.log(`Starting standalone server on port ${port}…`);
  const child = spawn(process.execPath, [standalone], { cwd: path.dirname(standalone), env, stdio: "inherit" });
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
