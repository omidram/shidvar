export const BACKUP_KEEP_MS = 10 * 24 * 60 * 60 * 1000;

export type TehranClock = {
  date: string;
  hour: number;
  minute: number;
  second: number;
};

export function tehranClock(date = new Date()): TehranClock {
  const bag: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    date: `${bag.year}-${bag.month}-${bag.day}`,
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

export function backupIdFor(date = new Date()) {
  const clock = tehranClock(date);
  const day = clock.date.replaceAll("-", "");
  const time = [clock.hour, clock.minute, clock.second].map((value) => String(value).padStart(2, "0")).join("");
  return `shidro-${day}-${time}`;
}

export function isBackupId(value: string) {
  return /^shidro-\d{8}-\d{6}$/.test(value);
}

export function isNightlyWindow(date = new Date()) {
  const clock = tehranClock(date);
  return clock.hour === 0 && clock.minute < 5;
}

export function backupIsExpired(createdAtMs: number, now = Date.now()) {
  return now - createdAtMs >= BACKUP_KEEP_MS;
}
