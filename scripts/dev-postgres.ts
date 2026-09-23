import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const DEFAULT_URL = "postgresql://shidvar:shidvar@localhost:5433/shidvar";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) return DEFAULT_URL;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL=(.*)$/);
    if (!match) continue;
    return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return DEFAULT_URL;
}

function parseDatabaseUrl(raw: string) {
  const url = new URL(raw.replace(/^postgresql:/i, "http:"));
  return {
    user: decodeURIComponent(url.username) || "shidvar",
    password: decodeURIComponent(url.password) || "shidvar",
    host: url.hostname || "localhost",
    port: Number(url.port || 5433),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "shidvar",
  };
}

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function canBind(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function toWslPath(winPath: string) {
  const resolved = path.resolve(winPath);
  const match = resolved.match(/^([A-Za-z]):\\(.*)$/);
  if (!match) return resolved.replace(/\\/g, "/");
  return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, "/")}`;
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

function startWslPostgres(): boolean {
  if (process.platform !== "win32") return false;
  const script = toWslPath(path.join(process.cwd(), "scripts", "wsl-postgres.sh"));
  try {
    execFileSync(
      "wsl.exe",
      ["-d", "Ubuntu-24.04", "--", "bash", "-lc", `sed -i 's/\\r$//' '${script}' && bash '${script}'`],
      { stdio: "inherit" },
    );
    return true;
  } catch {
    return false;
  }
}

async function startEmbedded(parsed: ReturnType<typeof parseDatabaseUrl>) {
  const cluster = new EmbeddedPostgres({
    databaseDir: path.join(process.cwd(), ".data", "postgres"),
    user: parsed.user,
    password: parsed.password,
    port: parsed.port,
    persistent: true,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: (message) => process.stdout.write(String(message)),
  });

  await cluster.initialise();
  await cluster.start();

  try {
    await cluster.createDatabase(parsed.database);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
  }

  console.log(`PostgreSQL ready at postgresql://${parsed.user}@127.0.0.1:${parsed.port}/${parsed.database}`);
  console.log("Leave this process running. In another terminal: npm run db:push && npm run db:seed");

  const stop = async () => {
    await cluster.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
  await new Promise(() => undefined);
}

async function main() {
  const parsed = parseDatabaseUrl(loadDatabaseUrl());
  if (!isLocalHost(parsed.host)) {
    console.log(`DATABASE_URL host is ${parsed.host}; not starting a local cluster.`);
    return;
  }

  if (!(await canBind(parsed.port))) {
    console.log(`Port ${parsed.port} is already in use. Assuming PostgreSQL is up.`);
    return;
  }

  if (startWslPostgres()) return;

  if (isWindowsAdmin()) {
    throw new Error(
      "PostgreSQL cannot start from an Administrator terminal on Windows. Run `wsl -d Ubuntu-24.04` and `npm run db:up` from a normal prompt, or start Docker Desktop.",
    );
  }

  await startEmbedded(parsed);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
