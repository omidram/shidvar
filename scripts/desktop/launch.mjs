import { createServer } from "node:net";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(root, "app");
const dataDir = path.join(root, "data", "postgres");
const storageDir = path.join(root, "data", "storage");
const pgLog = path.join(root, "data", "postgres-start.log");
const pgBin = path.join(root, "node_modules", "@embedded-postgres", "windows-x64", "native", "bin");
const pgCtl = path.join(pgBin, "pg_ctl.exe");
const postgresExe = path.join(pgBin, "postgres.exe");
const preferredPgPort = 55433;
const nodeBin = process.execPath;

const envBase = {
  ...process.env,
  NODE_ENV: "production",
  SHIDVAR_DEMO: "1",
  SESSION_SECRET: process.env.SESSION_SECRET || "shidvar-desktop-demo-session-secret-key",
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  STORAGE_DRIVER: "local",
  STORAGE_LOCAL_PATH: storageDir,
  DEFAULT_LOCALE: "fa",
  DEFAULT_CURRENCY: "IRR",
  DEFAULT_COUNTRY: "IR",
  HOSTNAME: "127.0.0.1",
};

function log(message) {
  console.log(message);
}

function formatError(error) {
  if (error instanceof Error) return error.stack || error.message || error.name;
  if (typeof error === "string" && error) return error;
  try {
    const json = JSON.stringify(error);
    if (json && json !== "{}") return json;
  } catch {
    // ignore
  }
  return String(error);
}

function isWindowsAdmin() {
  if (process.platform !== "win32") return false;
  try {
    execFileSync("net", ["session"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function canBind(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function pickPort(preferred) {
  for (let port = preferred; port < preferred + 20; port++) {
    if (await canBind(port)) return port;
  }
  throw new Error("No free port found for the app.");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
  });
  return {
    status: result.status,
    out: `${result.stdout || ""}${result.stderr || ""}`.trim(),
    error: result.error,
  };
}

function killLeftoverPostgres() {
  const markers = [root.replace(/\\/g, "/").toLowerCase(), pgBin.replace(/\\/g, "/").toLowerCase()];
  const listed = run("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | ForEach-Object { '{0}|{1}' -f $_.ProcessId, $_.CommandLine }",
  ]);
  const pids = [];
  for (const line of listed.out.split(/\r?\n/)) {
    const [pid, commandLine] = line.split("|");
    if (!pid || !commandLine) continue;
    const haystack = commandLine.replace(/\\/g, "/").toLowerCase();
    if (markers.some((marker) => haystack.includes(marker))) pids.push(pid.trim());
  }
  for (const pid of pids) {
    run("taskkill.exe", ["/PID", pid, "/F", "/T"]);
  }
  rmSync(path.join(dataDir, "postmaster.pid"), { force: true });
  rmSync(path.join(dataDir, "postmaster.opts"), { force: true });
}

function readPgLog() {
  try {
    return readFileSync(pgLog, "utf8").trim();
  } catch {
    return "";
  }
}

async function startPostgres() {
  if (!existsSync(pgCtl) || !existsSync(postgresExe)) {
    throw new Error(`PostgreSQL binaries are missing at ${pgBin}`);
  }

  killLeftoverPostgres();
  await new Promise((r) => setTimeout(r, 1500));

  const port = await pickPort(preferredPgPort);
  rmSync(pgLog, { force: true });
  const started = run(pgCtl, [
    "-D",
    dataDir,
    "-l",
    pgLog,
    "-o",
    `-p ${port} -h 127.0.0.1`,
    "-w",
    "-t",
    "30",
    "start",
  ]);
  if (started.status !== 0) {
    const details = [started.out, readPgLog()].filter(Boolean).join("\n");
    throw new Error(`Could not start the demo database on port ${port}.\n${details || "No PostgreSQL log was written."}`);
  }
  return port;
}

function stopPostgres() {
  run(pgCtl, ["-D", dataDir, "-m", "fast", "stop"]);
  killLeftoverPostgres();
}

async function waitHttp(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("The app server did not become ready.");
}

function openBrowser(url) {
  spawn("cmd.exe", ["/c", "start", "", url], { stdio: "ignore", detached: true, windowsHide: true }).unref();
}

async function main() {
  if (isWindowsAdmin()) {
    throw new Error("Do not use Run as administrator. Close this window and double-click Shidvar.exe normally.");
  }

  mkdirSync(storageDir, { recursive: true });
  if (!existsSync(path.join(dataDir, "PG_VERSION")) || !existsSync(path.join(dataDir, ".demo-version"))) {
    throw new Error("Demo data is missing from this package. Rebuild Shidvar.exe.");
  }

  log("Starting demo database...");
  const pgPort = await startPostgres();
  const databaseUrl = `postgresql://shidvar:shidvar@127.0.0.1:${pgPort}/shidvar`;

  const port = await pickPort(5500);
  const appUrl = `http://127.0.0.1:${port}`;
  writeFileSync(
    path.join(appDir, ".env"),
    [
      "NODE_ENV=production",
      `APP_URL=${appUrl}`,
      `PORT=${port}`,
      `HOSTNAME=127.0.0.1`,
      `DATABASE_URL=${databaseUrl}`,
      "SHIDVAR_DEMO=1",
      `SESSION_SECRET=${envBase.SESSION_SECRET}`,
      `ENCRYPTION_KEY=${envBase.ENCRYPTION_KEY}`,
      "STORAGE_DRIVER=local",
      `STORAGE_LOCAL_PATH=${storageDir.replace(/\\/g, "/")}`,
      "DEFAULT_LOCALE=fa",
      "DEFAULT_CURRENCY=IRR",
      "DEFAULT_COUNTRY=IR",
      "",
    ].join("\n"),
  );
  log(`App is running at ${appUrl}`);

  const app = spawn(nodeBin, ["server.js"], {
    cwd: appDir,
    env: { ...envBase, DATABASE_URL: databaseUrl, PORT: String(port), APP_URL: appUrl },
    stdio: "inherit",
    windowsHide: false,
  });

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    if (!app.killed) app.kill();
    stopPostgres();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
  process.on("SIGHUP", () => void stop());

  await waitHttp(appUrl);
  log("Opening the browser. Keep this window open.");
  openBrowser(appUrl);

  app.on("exit", () => void stop());
}

main().catch((error) => {
  console.error(formatError(error));
  console.error("\nDo not use Run as administrator. Close this window and double-click Shidvar.exe.");
  console.error("If it still fails, delete %LOCALAPPDATA%\\ShidvarDesktop, then try again.");
  console.error("Press Enter to close.");
  try {
    stopPostgres();
  } catch {
    // ignore
  }
  process.stdin.resume();
  process.stdin.once("data", () => process.exit(1));
});
