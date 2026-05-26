#!/usr/bin/env node
import { upsertSnipe, makeSnipeId } from "./lib/snipes-config.mjs";

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

const preferredTimes = (args.times ?? "19:00")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const snipe = {
  id: args.id ?? makeSnipeId(args.name, args.date),
  enabled: args.enabled !== "false",
  platform: args.platform ?? "opentable",
  venue_id: String(args.venue_id),
  restaurant_name: args.name,
  target_date: args.date,
  party_size: parseInt(args.party ?? args.party_size ?? "2", 10),
  preferred_times: preferredTimes,
  mode: args.mode ?? "drop",
  drop_at: args.drop_at,
  dry_run: args.dry_run !== "false",
};

if (snipe.mode === "drop" && !snipe.drop_at) {
  console.error("drop_at required for drop mode");
  process.exit(1);
}

upsertSnipe(snipe);
console.log(JSON.stringify(snipe, null, 2));
