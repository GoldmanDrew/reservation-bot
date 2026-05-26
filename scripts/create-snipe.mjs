#!/usr/bin/env node
import { resolveRestaurant, researchDropTime } from "./resolve-restaurant.mjs";
import { upsertSnipe, makeSnipeId } from "./lib/snipes-config.mjs";
import { sendNotification } from "./lib/notify.mjs";

function parsePreferredTimes(raw) {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

async function main() {
  const name = process.env.RESTAURANT_NAME ?? process.argv[2];
  const targetDate = process.env.TARGET_DATE ?? process.argv[3];
  const partySize = parseInt(process.env.PARTY_SIZE ?? process.argv[4] ?? "2", 10);
  const timesRaw = process.env.PREFERRED_TIMES ?? process.argv[5] ?? "19:00,19:30,20:00";
  const dryRun = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
  const mode = process.env.SNIPE_MODE ?? "drop";

  if (!name || !targetDate) {
    console.error("Usage: RESTAURANT_NAME TARGET_DATE PARTY_SIZE PREFERRED_TIMES");
    process.exit(1);
  }

  console.log(`Resolving: ${name}...`);
  const resolved = await resolveRestaurant(name);
  console.log(JSON.stringify(resolved, null, 2));

  console.log(`Researching drop time for ${targetDate}...`);
  const drop = researchDropTime({
    platform: resolved.platform,
    venue_id: resolved.venue_id,
    slug: resolved.slug,
    name: resolved.name,
    target_date: targetDate,
  });
  console.log(JSON.stringify(drop, null, 2));

  const snipe = {
    id: makeSnipeId(resolved.name, targetDate),
    enabled: true,
    platform: resolved.platform,
    venue_id: resolved.venue_id,
    restaurant_name: resolved.name,
    target_date: targetDate,
    party_size: partySize,
    preferred_times: parsePreferredTimes(timesRaw),
    mode,
    drop_at: drop.drop_at,
    dry_run: dryRun,
  };

  upsertSnipe(snipe);
  console.log("Snipe saved:", JSON.stringify(snipe, null, 2));

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const fs = await import("fs");
    fs.appendFileSync(
      summaryPath,
      [
        "## Snipe Created",
        "",
        `- **Restaurant:** ${snipe.restaurant_name}`,
        `- **Platform:** ${snipe.platform}`,
        `- **Venue ID:** ${snipe.venue_id}`,
        `- **Target date:** ${snipe.target_date}`,
        `- **Party size:** ${snipe.party_size}`,
        `- **Times:** ${snipe.preferred_times.join(", ")}`,
        `- **Drop at:** ${snipe.drop_at} (${drop.local_time} ${drop.timezone})`,
        `- **Dry run:** ${snipe.dry_run}`,
        "",
      ].join("\n")
    );
  }

  await sendNotification(
    `Snipe armed: ${snipe.restaurant_name}`,
    `Date: ${snipe.target_date} · Party: ${snipe.party_size}\nDrops: ${drop.local_time} ${drop.timezone}\nDry run: ${snipe.dry_run}`
  );
}

main().catch((err) => {
  console.error(err.message);
  if (err.matches) console.error(JSON.stringify(err.matches, null, 2));
  process.exit(1);
});
