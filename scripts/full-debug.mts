const BASE = "http://localhost:5500/api/v1";

type Jar = string[];

async function req(jar: Jar, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      cookie: jar.join("; "),
      ...(init?.headers ?? {}),
    },
  });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) jar.push(c.split(";")[0]);
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, json };
}

async function login(email: string, password: string) {
  const jar: Jar = [];
  const auth = await req(jar, "/auth/login", { method: "POST", body: JSON.stringify({ identifier: email, password }) });
  if (!auth.ok) throw new Error(`login ${email} failed ${auth.status} ${JSON.stringify(auth.json)}`);
  return jar;
}

function count(data: unknown) {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.data)) return rec.data.length;
    if (rec.companies && rec.drivers) {
      return `${(rec.companies as unknown[]).length}c/${(rec.drivers as unknown[]).length}d`;
    }
    if (rec.stats) return rec.stats;
  }
  return data;
}

async function probe(label: string, jar: Jar, paths: string[]) {
  const rows: string[] = [];
  for (const path of paths) {
    const res = await req(jar, path);
    const payload = res.json && typeof res.json === "object" && "data" in res.json ? (res.json as { data: unknown }).data : res.json;
    rows.push(`${res.ok ? "OK " : "ERR"} ${res.status} ${path} → ${typeof count(payload) === "object" ? JSON.stringify(count(payload)) : count(payload)}`);
    if (!res.ok) rows.push(`     ${JSON.stringify(res.json)?.slice(0, 220)}`);
  }
  console.log(`\n=== ${label} ===`);
  for (const row of rows) console.log(row);
}

async function main() {
  const admin = await login("admin@shidvar.local", "DevAdmin!2026");
  const owner = await login("buyer@alpha-stores.local", "DevStore!2026");
  const driver = await login("ali.rezaei@fleet.local", "DevDriver!2026");

  await probe("ADMIN", admin, [
    "/auth/me",
    "/dashboard",
    "/admin/verifications",
    "/admin/drivers",
    "/admin/companies",
    "/admin/users",
    "/requests",
    "/jobs",
    "/invoices",
    "/orders",
    "/admin/audit-logs",
    "/notifications",
  ]);
  await probe("CARGO OWNER", owner, [
    "/auth/me",
    "/dashboard",
    "/requests",
    "/orders",
    "/invoices",
    "/tenancy/warehouses",
    "/catalog/products",
    "/notifications",
  ]);
  await probe("DRIVER", driver, [
    "/auth/me",
    "/dashboard",
    "/marketplace/jobs",
    "/jobs",
    "/notifications",
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
