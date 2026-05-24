#!/usr/bin/env node
import { searchResyRestaurants } from "./lib/resy.mjs";

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error("Usage: npm run search -- <restaurant name>");
  process.exit(1);
}

const results = await searchResyRestaurants(query);
if (results.length === 0) {
  console.log("No results found.");
  process.exit(0);
}

console.log("\nResults:\n");
for (const r of results) {
  console.log(`  ${r.name} (${r.location ?? "unknown"})`);
  console.log(`    venue_id: ${r.venueId}`);
  console.log(`    ${r.url ?? ""}\n`);
}
