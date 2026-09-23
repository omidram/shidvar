import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { copyFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const payload = path.join(dist, "payload");
const packPg = path.join(dist, "pack-pg");
const pgPort = 55432;
const nodeBin = process.execPath;
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const prismaBin = path.join(root, "node_modules", "prisma", "build", "index.js");
const tsxBin = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

function log(message) {
  console.log(message);
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd ?? root,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: opts.stdio ?? "inherit",
    shell: opts.shell ?? false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})`);
  }
}

async function copyDir(src, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
}

function findPkg(name) {
  const direct = path.join(root, "node_modules", name);
  if (existsSync(direct)) return direct;
  throw new Error(`package not found: ${name}`);
}

async function copyPackage(name, destNodeModules, seen = new Set()) {
  if (seen.has(name) || (name.startsWith("@embedded-postgres/") && name !== "@embedded-postgres/windows-x64")) return;
  seen.add(name);
  const src = findPkg(name);
  const dest = path.join(destNodeModules, name);
  await copyDir(src, dest);
  const pkg = JSON.parse(readFileSync(path.join(src, "package.json"), "utf8"));
  const deps = { ...(pkg.dependencies ?? {}), ...(name === "embedded-postgres" ? { "@embedded-postgres/windows-x64": pkg.optionalDependencies?.["@embedded-postgres/windows-x64"] } : {}) };
  for (const dep of Object.keys(deps).filter(Boolean)) {
    try {
      await copyPackage(dep, destNodeModules, seen);
    } catch (error) {
      if (dep.startsWith("@embedded-postgres/")) continue;
      throw error;
    }
  }
}

function compileStub(outExe) {
  const cs = path.join(root, "scripts", "desktop", "ShidvarStub.cs");
  const csc = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
  if (!existsSync(csc)) throw new Error("csc.exe پیدا نشد. .NET Framework 4 لازم است.");
  run(csc, [
    "/nologo",
    "/optimize+",
    "/target:exe",
    `/out:${outExe}`,
    "/reference:System.IO.Compression.dll",
    "/reference:System.IO.Compression.FileSystem.dll",
    cs,
  ]);
}

async function waitPg(url, tries = 40) {
  const mod = await import("pg");
  const Client = mod.Client ?? mod.default?.Client;
  for (let i = 0; i < tries; i++) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
    try {
      await client.connect();
      await client.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Postgres pack cluster did not become ready");
}

function rmrf(dir) {
  for (let i = 0; i < 8; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      spawnSync("cmd.exe", ["/c", "rmdir", "/s", "/q", dir], { stdio: "ignore" });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
    }
  }
  spawnSync("cmd.exe", ["/c", "rmdir", "/s", "/q", dir], { stdio: "inherit" });
}

function stripPgRuntime(dir) {
  for (const name of ["postmaster.pid", "postmaster.opts"]) {
    rmSync(path.join(dir, name), { force: true });
  }
}

async function wrapExe() {
  stripPgRuntime(path.join(payload, "data", "postgres"));
  const version = createHash("sha256").update(`${Date.now()}`).digest("hex").slice(0, 16);
  writeFileSync(path.join(payload, "PAYLOAD_VERSION"), version);

  log("Compressing payload...");
  const zipPath = path.join(dist, "payload.zip");
  rmSync(zipPath, { force: true });
  run("tar.exe", ["-a", "-cf", zipPath, "-C", payload, "."]);

  log("Compiling launcher...");
  const stubPath = path.join(dist, "Shidvar-stub.exe");
  compileStub(stubPath);

  log("Writing Shidvar.exe...");
  const outExe = path.join(dist, "Shidvar.exe");
  const stub = readFileSync(stubPath);
  const marker = Buffer.from(`SHIDVAR_ZIP_PAYLOAD_V1:${version}\n`, "utf8");
  const zip = readFileSync(zipPath);
  writeFileSync(outExe, Buffer.concat([stub, marker, zip]));
  const mb = (statSync(outExe).size / (1024 * 1024)).toFixed(1);
  log(`Ready: ${outExe} (${mb} MB)`);
  log("Copy that single file to any Windows PC and double-click it. Do not use Run as administrator.");
}

async function main() {
  const rewrap = process.argv.includes("--rewrap");
  if (rewrap) {
    if (!existsSync(path.join(payload, "launch.mjs")) || !existsSync(path.join(payload, "app", "server.js"))) {
      throw new Error("dist/payload is incomplete. Run npm run package:win without --rewrap.");
    }
    log("Rewrapping existing payload with a new launcher...");
    await copyFile(path.join(root, "scripts", "desktop", "launch.mjs"), path.join(payload, "launch.mjs"));
    await wrapExe();
    return;
  }

  log("1/6  Building Next.js standalone...");
  run(nodeBin, [prismaBin, "generate"]);
  run(nodeBin, [nextBin, "build", "--webpack"], { env: { NEXT_PUBLIC_SHIDVAR_DEMO: "1" } });

  log("2/6  Assembling payload...");
  rmSync(payload, { recursive: true, force: true });
  mkdirSync(payload, { recursive: true });
  const standalone = path.join(root, ".next", "standalone");
  if (!existsSync(path.join(standalone, "server.js"))) {
    throw new Error("standalone build missing server.js");
  }
  await copyDir(standalone, path.join(payload, "app"));
  for (const name of [".env", ".env.local", ".env.production", ".env.development"]) {
    rmSync(path.join(payload, "app", name), { force: true });
  }
  const publicDir = path.join(root, "public");
  if (existsSync(publicDir)) await copyDir(publicDir, path.join(payload, "app", "public"));
  const staticDir = path.join(root, ".next", "static");
  if (existsSync(staticDir)) await copyDir(staticDir, path.join(payload, "app", ".next", "static"));
  await copyFile(process.execPath, path.join(payload, "node.exe"));
  await copyFile(path.join(root, "scripts", "desktop", "launch.mjs"), path.join(payload, "launch.mjs"));
  writeFileSync(path.join(payload, "package.json"), JSON.stringify({ type: "module", name: "shidvar-desktop" }));
  await copyPackage("embedded-postgres", path.join(payload, "node_modules"));

  log("4/6  Seeding demo database...");
  rmSync(packPg, { recursive: true, force: true });
  const cluster = new EmbeddedPostgres({
    databaseDir: packPg,
    user: "shidvar",
    password: "shidvar",
    port: pgPort,
    persistent: true,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => undefined,
    onError: (err) => console.error(err),
  });
  await cluster.initialise();
  await cluster.start();
  try {
    await cluster.createDatabase("shidvar");
    const databaseUrl = `postgresql://shidvar:shidvar@127.0.0.1:${pgPort}/shidvar`;
    await waitPg(databaseUrl);
    run(nodeBin, [prismaBin, "db", "push", "--skip-generate", "--accept-data-loss"], { env: { DATABASE_URL: databaseUrl } });
    run(nodeBin, [tsxBin, "--tsconfig", "tsconfig.json", "prisma/seed.ts"], {
      env: { DATABASE_URL: databaseUrl, NODE_ENV: "development", SHIDVAR_DEMO: "1" },
    });
    const version = createHash("sha256").update(`${Date.now()}`).digest("hex").slice(0, 16);
    writeFileSync(path.join(packPg, ".demo-version"), version);
  } finally {
    await cluster.stop();
    await new Promise((r) => setTimeout(r, 1500));
  }

  await copyDir(packPg, path.join(payload, "data", "postgres"));
  await wrapExe();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
