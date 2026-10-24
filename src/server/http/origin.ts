export const PRODUCTION_ORIGINS = ["https://shidro.com", "https://www.shidro.com"];

export function requestHostname(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null") return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    return url.hostname.replace(/\.$/, "").replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Browser CSRF check: the Origin host must be this app, ignoring http/https and a www prefix. */
export function isAllowedRequestOrigin(origin: string | null, candidates: Array<string | null | undefined>) {
  if (!origin) return true;
  const from = requestHostname(origin);
  if (!from) return false;
  return candidates.some((candidate) => requestHostname(candidate) === from);
}
