#!/usr/bin/env node
import { researchDropTime } from "./resolve-restaurant.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      out[argv[i].slice(2)] = argv[i + 1] ?? "true";
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.test) {
  const drop = researchDropTime({
    platform: "opentable",
    venue_id: "76686487",
    slug: "san-sabino-new-york",
    name: "San Sabino",
    target_date: "2026-06-26",
  });
  console.log(JSON.stringify(drop, null, 2));
  const expected = "2026-05-27T13:00:00.000Z";
  if (!drop.drop_at.startsWith("2026-05-27T13:")) {
    console.error(`Expected drop near ${expected}, got ${drop.drop_at}`);
    process.exit(1);
  }
  console.log("Test passed.");
  process.exit(0);
}

const drop = researchDropTime({
  platform: args.platform ?? "opentable",
  venue_id: args.venue_id,
  slug: args.slug,
  name: args.name,
  target_date: args.date,
});

console.log(JSON.stringify(drop, null, 2));
