import { cpSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function findStandaloneServer(dir = path.join(root, ".next", "standalone"), depth = 0) {
  if (depth > 4 || !existsSync(dir)) return null;
  const direct = path.join(dir, "server.js");
  if (existsSync(direct)) return direct;
  for (const name of readdirSync(dir)) {
    const child = path.join(dir, name);
    if (statSync(child).isDirectory()) {
      const found = findStandaloneServer(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** Next standalone does not include public/ or .next/static. Copy them beside server.js. */
export function copyStandaloneAssets() {
  const server = findStandaloneServer();
  if (!server) {
    console.warn("Standalone server.js not found; skip asset copy.");
    return null;
  }
  const destRoot = path.dirname(server);
  const staticSrc = path.join(root, ".next", "static");
  const publicSrc = path.join(root, "public");
  if (!existsSync(staticSrc)) {
    console.warn("Missing .next/static. Run the production build before start.");
  } else {
    cpSync(staticSrc, path.join(destRoot, ".next", "static"), { recursive: true });
  }
  if (!existsSync(publicSrc)) {
    console.warn("Missing public/. Images and video will 404.");
  } else {
    cpSync(publicSrc, path.join(destRoot, "public"), { recursive: true });
  }
  console.log(`Copied CSS, JS, images, and video next to ${path.relative(root, server)}`);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  copyStandaloneAssets();
}
