import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlFile = path.join(root, "scripts", "ensure-schema.sql");
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");

function run(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

console.log("Applying schema hotfix (isSpecial, specialNote, loadType)…");
let code = run(["db", "execute", "--file", sqlFile, "--schema", "prisma/schema.prisma"]);
if (code !== 0) {
  console.warn("SQL hotfix failed; falling back to prisma db push…");
  code = run(["db", "push", "--skip-generate", "--accept-data-loss"]);
}
if (code !== 0) {
  console.error("Schema sync failed. Login will break until columns exist.");
  process.exit(code);
}
console.log("Schema is up to date.");
