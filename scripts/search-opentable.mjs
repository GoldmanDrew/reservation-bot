#!/usr/bin/env node
import {
  getOpenTableConfigFromEnv,
  searchOpenTableRestaurants,
  verifyOpenTableAuth,
} from "./lib/opentable.mjs";

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error("Usage: npm run search:opentable -- <restaurant name>");
  console.error("Requires OPENTABLE_COOKIES env var (or GitHub Secret locally)");
  process.exit(1);
}

const config = getOpenTableConfigFromEnv();
const valid = await verifyOpenTableAuth(config);
if (!valid) {
  console.error("OpenTable cookies invalid or expired.");
  process.exit(1);
}

const results = await searchOpenTableRestaurants(config, query);
if (results.length === 0) {
  console.log("No results found.");
  process.exit(0);
}

console.log("\nOpenTable results:\n");
for (const r of results) {
  console.log(`  ${r.name} (${r.location ?? "unknown"})`);
  console.log(`    restaurant_id: ${r.venueId}`);
  console.log(`    ${r.url ?? ""}\n`);
}
