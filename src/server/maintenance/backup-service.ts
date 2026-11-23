import { execFile } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "@/server/config";
import { prisma } from "@/server/db";
import { Errors } from "@/server/errors";
import { writeAudit } from "@/server/audit";
import { assertPermission, type Actor } from "@/server/rbac/actor";
import { backupIdFor, backupIsExpired, isBackupId, tehranClock } from "@/server/maintenance/backup-policy";

const execFileAsync = promisify(execFile);

type Manifest = {
  id: string;
  createdAt: string;
  automatic: boolean;
  hasDatabase: boolean;
  hasFiles: boolean;
};

export type BackupRecord = Manifest & { bytes: number };

function backupRoot() {
  return path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), ".backups"));
}

function assertAdmin(actor: Actor) {
  if (!actor.isPlatformStaff) throw Errors.forbidden("پشتیبان فقط برای مدیر است");
  assertPermission(actor, "settings.manage");
}

function databaseTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw Errors.conflict("نشانی پایگاه برای پشتیبان تنظیم نشده است");
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database) throw Errors.conflict("نشانی پایگاه برای پشتیبان معتبر نیست");
  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

function safeError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://…").slice(0, 400);
}

async function commandOnPath(name: string) {
  try {
    const finder = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(finder, [name], { windowsHide: true });
    return stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null;
  } catch {
    return null;
  }
}

async function postgresBin(name: "pg_dump" | "pg_restore") {
  const fromEnv = name === "pg_dump" ? process.env.PG_DUMP_BIN : process.env.PG_RESTORE_BIN;
  if (fromEnv) return fromEnv;
  const onPath = await commandOnPath(name);
  if (onPath) return onPath;
  for (const version of ["17", "16", "15", "14"]) {
    const candidate = `/usr/lib/postgresql/${version}/bin/${name}`;
    try {
      await stat(candidate);
      return candidate;
    } catch {
      /* try the next version */
    }
  }
  throw Errors.conflict("ابزار پشتیبان پایگاه روی سرور نصب نیست. بسته postgresql-client را نصب کنید و دوباره تلاش کنید.");
}

async function directorySize(dir: string) {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await directorySize(full);
    else total += (await stat(full)).size;
  }
  return total;
}

async function readManifest(dir: string): Promise<Manifest | null> {
  try {
    const parsed = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as Manifest;
    if (!isBackupId(parsed.id)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function listBackups() {
  await mkdir(backupRoot(), { recursive: true });
  const entries = await readdir(backupRoot(), { withFileTypes: true });
  const records: BackupRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isBackupId(entry.name)) continue;
    const dir = path.join(backupRoot(), entry.name);
    const manifest = await readManifest(dir);
    if (!manifest) continue;
    records.push({ ...manifest, bytes: await directorySize(dir) });
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function pruneBackups(now = Date.now()) {
  const records = await listBackups();
  const removed: string[] = [];
  for (const record of records) {
    if (!backupIsExpired(Date.parse(record.createdAt), now)) continue;
    await rm(path.join(backupRoot(), record.id), { recursive: true, force: true });
    removed.push(record.id);
  }
  return removed;
}

let creating = false;

export async function createBackup(actor: Actor | null, automatic = false) {
  if (actor) assertAdmin(actor);
  if (creating) throw Errors.conflict("یک پشتیبان همین حالا در حال ساخته شدن است");
  creating = true;
  const id = backupIdFor();
  const dir = path.join(backupRoot(), id);
  try {
    await mkdir(dir, { recursive: true });
    const db = databaseTarget();
    const dumpBin = await postgresBin("pg_dump");
    await execFileAsync(
      dumpBin,
      ["--format=custom", "--no-owner", "--no-acl", "--file", path.join(dir, "database.dump"), "--host", db.host, "--port", db.port, "--username", db.user, "--dbname", db.database],
      { env: { ...process.env, PGPASSWORD: db.password }, windowsHide: true },
    );
    let hasFiles = false;
    try {
      await stat(config.storageLocalPath);
      await cp(config.storageLocalPath, path.join(dir, "files"), { recursive: true });
      hasFiles = true;
    } catch {
      hasFiles = false;
    }
    const manifest: Manifest = {
      id,
      createdAt: new Date().toISOString(),
      automatic,
      hasDatabase: true,
      hasFiles,
    };
    await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest), "utf8");
    await pruneBackups();
    if (actor) {
      await writeAudit({ actor, action: "admin.backup_created", entityType: "System", entityId: id, newValue: { automatic } });
    }
    const bytes = await directorySize(dir);
    return { ...manifest, bytes };
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    if (error instanceof Error && "status" in error) throw error;
    throw Errors.conflict(`پشتیبان ساخته نشد. ${safeError(error)}`);
  } finally {
    creating = false;
  }
}

export async function restoreBackup(actor: Actor, id: string) {
  assertAdmin(actor);
  if (!isBackupId(id)) throw Errors.validation({ id: ["این پشتیبان معتبر نیست"] });
  const dir = path.join(backupRoot(), id);
  const manifest = await readManifest(dir);
  if (!manifest) throw Errors.notFound("این پشتیبان پیدا نشد");
  const db = databaseTarget();
  const restoreBin = await postgresBin("pg_restore");
  try {
    await prisma.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()`,
    );
  } catch {
    /* the pool reconnects after restore */
  }
  await prisma.$disconnect();
  try {
    await execFileAsync(
      restoreBin,
      ["--clean", "--if-exists", "--no-owner", "--no-acl", "--host", db.host, "--port", db.port, "--username", db.user, "--dbname", db.database, path.join(dir, "database.dump")],
      { env: { ...process.env, PGPASSWORD: db.password }, windowsHide: true },
    );
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? Number(error.code) : 1;
    if (code !== 1) throw Errors.conflict(`بازیابی پایگاه انجام نشد. ${safeError(error)}`);
  } finally {
    await prisma.$connect();
  }
  if (manifest.hasFiles) {
    await rm(config.storageLocalPath, { recursive: true, force: true });
    await cp(path.join(dir, "files"), config.storageLocalPath, { recursive: true });
  }
  await writeAudit({ actor, action: "admin.backup_restored", entityType: "System", entityId: id });
  return { restored: id, tehranDate: tehranClock().date };
}
