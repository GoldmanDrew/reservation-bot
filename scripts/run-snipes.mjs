#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import {
  bookOpenTableSlot,
  checkOpenTableAvailability,
  getOpenTableConfigFromEnv,
  verifyOpenTableAuth,
} from "./lib/opentable.mjs";
import {
  bookResySlot,
  checkResyAvailability,
  getResyConfigFromEnv,
} from "./lib/resy.mjs";
import { sendNotification } from "./lib/notify.mjs";
import {
  normalizePreferredTimes,
  parseTimeToMinutes,
  pickBestSlot,
  sleep,
} from "./lib/time.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "config", "snipes.yaml");

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadSnipes() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing ${CONFIG_PATH} — copy config/snipes.example.yaml`);
  }
  const doc = yaml.load(fs.readFileSync(CONFIG_PATH, "utf-8"));
  return (doc?.snipes ?? []).filter((s) => s.enabled !== false);
}

function findMatchingSlot(slots, preferredTimes) {
  const availableMinutes = slots.map((s) => parseTimeToMinutes(s.time));
  const preferredMinutes = normalizePreferredTimes(preferredTimes);
  const best = pickBestSlot(availableMinutes, preferredMinutes);
  if (best === null) return null;
  return slots.find((s) => parseTimeToMinutes(s.time) === best) ?? null;
}

function shouldRunDropSnipe(snipe, now) {
  if (!snipe.drop_at) return false;
  const dropAt = new Date(snipe.drop_at).getTime();
  const msUntilDrop = dropAt - now.getTime();
  return msUntilDrop <= 6 * 60 * 1000 && msUntilDrop >= -3 * 60 * 1000;
}

function shouldRunPollSnipe(snipe) {
  return snipe.mode === "poll";
}

async function fetchSlots(platform, config, snipe) {
  if (platform === "opentable") {
    return checkOpenTableAvailability(
      config,
      String(snipe.venue_id),
      snipe.target_date,
      snipe.party_size
    );
  }
  return checkResyAvailability(
    config,
    String(snipe.venue_id),
    snipe.target_date,
    snipe.party_size
  );
}

async function attemptBook(platform, config, snipe, slot) {
  const dryRun = Boolean(snipe.dry_run);

  if (platform === "opentable") {
    return bookOpenTableSlot(
      config,
      String(snipe.venue_id),
      snipe.target_date,
      slot,
      snipe.party_size,
      dryRun
    );
  }

  return bookResySlot(config, slot, snipe.target_date, snipe.party_size, dryRun);
}

async function notifySuccess(snipe, result) {
  let body = `${result.bookedTime} on ${snipe.target_date}\n${result.message ?? ""}`;
  if (result.handoffUrl) {
    body += `\n\nBook now: ${result.handoffUrl}`;
  }
  await sendNotification(`Slot found — ${snipe.restaurant_name}!`, body);
}

async function runDropSnipe(platform, config, snipe) {
  const dropAt = new Date(snipe.drop_at).getTime();
  const wakeAt = dropAt - 30_000;
  const now = Date.now();

  if (now < wakeAt) {
    const waitMs = wakeAt - now;
    log(`${snipe.id}: sleeping ${Math.round(waitMs / 1000)}s until 30s before drop`);
    await sleep(waitMs);
  }

  log(`${snipe.id}: DROP SNIPE [${platform}] — ${snipe.restaurant_name}`);
  const pollEnd = dropAt + 3 * 60 * 1000;

  while (Date.now() < pollEnd) {
    const slots = await fetchSlots(platform, config, snipe);

    if (slots.length > 0) {
      log(`${snipe.id}: ${slots.length} slot(s): ${slots.map((s) => s.displayTime).join(", ")}`);
    }

    const match = findMatchingSlot(slots, snipe.preferred_times);
    if (match) {
      log(`${snipe.id}: MATCH ${match.displayTime} — booking`);
      const result = await attemptBook(platform, config, snipe, match);

      if (result.ok) {
        log(`${snipe.id}: SUCCESS — ${result.message}`);
        if (result.handoffUrl) log(`${snipe.id}: ${result.handoffUrl}`);
        await notifySuccess(snipe, result);
        return { success: true, snipe, result };
      }

      log(`${snipe.id}: BOOK FAILED — ${result.message}`);
    }

    await sleep(200);
  }

  log(`${snipe.id}: drop window ended with no booking`);
  return { success: false, snipe };
}

async function runPollSnipe(platform, config, snipe) {
  log(`${snipe.id}: poll [${platform}] — ${snipe.restaurant_name}`);

  const slots = await fetchSlots(platform, config, snipe);
  const match = findMatchingSlot(slots, snipe.preferred_times);

  if (!match) {
    log(`${snipe.id}: no matching slots (${slots.length} total)`);
    return { success: false, snipe };
  }

  log(`${snipe.id}: MATCH ${match.displayTime} — booking`);
  const result = await attemptBook(platform, config, snipe, match);

  if (result.ok) {
    log(`${snipe.id}: SUCCESS — ${result.message}`);
    if (result.handoffUrl) log(`${snipe.id}: ${result.handoffUrl}`);
    await notifySuccess(snipe, result);
    return { success: true, snipe, result };
  }

  log(`${snipe.id}: BOOK FAILED — ${result.message}`);
  return { success: false, snipe, result };
}

async function writeSummary(results) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const lines = ["## Reservation Sniper Results", ""];
  if (results.length === 0) {
    lines.push("_No snipes ran this cycle._");
  }
  for (const r of results) {
    const icon = r.success ? "✅" : r.error ? "❌" : "⏭️";
    lines.push(`- ${icon} **${r.snipe.restaurant_name}** (${r.snipe.id}, ${r.snipe.platform})`);
    if (r.result?.bookedTime) lines.push(`  - Time: ${r.result.bookedTime}`);
    if (r.result?.message) lines.push(`  - ${r.result.message}`);
    if (r.result?.handoffUrl) lines.push(`  - **[Complete booking →](${r.result.handoffUrl})**`);
    if (r.error) lines.push(`  - Error: ${r.error}`);
  }
  fs.appendFileSync(summaryPath, lines.join("\n") + "\n");
}

async function main() {
  const forceId = process.env.SNIPE_ID;
  const snipes = loadSnipes();
  const now = new Date();
  const results = [];

  const resySnipes = snipes.filter((s) => (s.platform ?? "resy") === "resy");
  const otSnipes = snipes.filter((s) => s.platform === "opentable");

  log(`Loaded ${snipes.length} enabled snipe(s) (${resySnipes.length} Resy, ${otSnipes.length} OpenTable)`);

  let resyConfig = null;
  let otConfig = null;

  if (resySnipes.length > 0) {
    try {
      resyConfig = await getResyConfigFromEnv();
      log("Resy auth OK");
    } catch (err) {
      log(`Resy auth skipped: ${err.message}`);
    }
  }

  if (otSnipes.length > 0) {
    otConfig = getOpenTableConfigFromEnv();
    const valid = await verifyOpenTableAuth(otConfig);
    if (!valid) {
      throw new Error("OpenTable cookies invalid or expired — update OPENTABLE_COOKIES secret");
    }
    log("OpenTable session OK");
  }

  for (const snipe of snipes) {
    if (forceId && snipe.id !== forceId) continue;

    const platform = snipe.platform ?? "resy";
    const config = platform === "opentable" ? otConfig : resyConfig;

    if (!config) {
      log(`${snipe.id}: skipped — no ${platform} credentials configured`);
      continue;
    }

    try {
      if (snipe.mode === "drop" && shouldRunDropSnipe(snipe, now)) {
        results.push(await runDropSnipe(platform, config, snipe));
      } else if (snipe.mode === "poll" && shouldRunPollSnipe(snipe)) {
        results.push(await runPollSnipe(platform, config, snipe));
      } else {
        log(`${snipe.id}: skipped (not scheduled for this cycle)`);
      }
    } catch (err) {
      log(`${snipe.id}: ERROR — ${err.message}`);
      results.push({ success: false, snipe, error: err.message });
    }
  }

  await writeSummary(results);
  log(results.some((r) => r.success) ? "At least one snipe succeeded!" : "No bookings this run.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
