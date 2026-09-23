import { ensureDemoTracking } from "../src/server/domains/logistics/tracking-service";

async function main() {
  const result = await ensureDemoTracking();
  console.log("tracking seeded", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
