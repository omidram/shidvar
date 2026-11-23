import { isNightlyWindow, tehranClock } from "@/server/maintenance/backup-policy";
import { createBackup, listBackups, pruneBackups } from "@/server/maintenance/backup-service";

const globalState = globalThis as typeof globalThis & { __shidroBackupTimer?: boolean };

export function startBackupSchedule() {
  if (globalState.__shidroBackupTimer) return;
  if (process.env.SHIDVAR_BACKUPS === "0") return;
  globalState.__shidroBackupTimer = true;
  void pruneBackups().catch((error) => {
    console.error("Backup prune skipped.", error instanceof Error ? error.message : error);
  });
  setInterval(() => {
    void runNightlyBackup();
  }, 60_000).unref?.();
}

async function runNightlyBackup() {
  if (!isNightlyWindow()) return;
  const today = tehranClock().date;
  try {
    const existing = await listBackups();
    if (existing.some((item) => item.automatic && tehranClock(new Date(item.createdAt)).date === today)) return;
    await createBackup(null, true);
    console.info(`Nightly backup saved for ${today}.`);
  } catch (error) {
    console.error("Nightly backup failed.", error instanceof Error ? error.message : error);
  }
}
