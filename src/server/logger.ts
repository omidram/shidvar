type LogLevel = "debug" | "info" | "warn" | "error";

function write(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...extra,
  };
  const serialized = JSON.stringify(line);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

export const logger = {
  debug: (message: string, extra?: Record<string, unknown>) => write("debug", message, extra),
  info: (message: string, extra?: Record<string, unknown>) => write("info", message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => write("warn", message, extra),
  error: (message: string, extra?: Record<string, unknown>) => {
    const safe = { ...extra };
    delete safe.password;
    delete safe.token;
    delete safe.stack;
    write("error", message, safe);
  },
};
