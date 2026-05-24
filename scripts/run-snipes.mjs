#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
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
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function loadSnipes() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing ${CONFIG_PATH} — copy config/snipes.example.yaml`);
  }
  const doc = yaml.load(fs.readFileSync(CONFIG_PATH, "utf-8"));
  return doc?.snipes ?? [];
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
  // Wake if drop is within next 6 minutes, or we're in the 3-minute post-drop window
  return msUntilDrop <= 6 * 60 * 1000 && msUntilDrop >= -3 * 60 * 1000;
}

function shouldRunPollSnipe(snipe) {
  return snipe.mode === "poll";
}

async function runDropSnipe(config, snipe) {
  const dropAt = new Date(snipe.drop_at).getTime();
  const wakeAt = dropAt - 30_000;
  const now = Date.now();

  if (now < wakeAt) {
    const waitMs = wakeAt - now;
    log(`${snipe.id}: sleeping ${Math.round(waitMs / 1000)}s until 30s before drop`);
    await sleep(waitMs);
  }

  log(`${snipe.id}: DROP SNIPE START — ${snipe.restaurant_name}`);
  const pollEnd = dropAt + 3 * 60 * 1000;
  const dryRun = Boolean(snipe.dry_run);

  while (Date.now() < pollEnd) {
    const slots = await checkResyAvailability(
      config,
      String(snipe.venue_id),
      snipe.target_date,
      snipe.party_size
    );

    if (slots.length > 0) {
      log(`${snipe.id}: ${slots.length} slot(s): ${slots.map((s) => s.displayTime).join(", ")}`);
    }

    const match = findMatchingSlot(slots, snipe.preferred_times);
    if (match) {
      log(`${snipe.id}: MATCH ${match.displayTime} — booking`);
      const result = await bookResySlot(
        config,
        match,
        snipe.target_date,
        snipe.party_size,
        dryRun
      );

      if (result.ok) {
        log(`${snipe.id}: SUCCESS — ${result.message}`);
        await sendNotification(
          `Booked ${snipe.restaurant_name}!`,
          `${result.bookedTime} on ${snipe.target_date}\n${result.message}`
        );
        return { success: true, snipe, result };
      }

      log(`${snipe.id}: BOOK FAILED — ${result.message}`);
    }

    await sleep(200);
  }

  log(`${snipe.id}: drop window ended with no booking`);
  return { success: false, snipe };
}

async function runPollSnipe(config, snipe) {
  log(`${snipe.id}: poll check — ${snipe.restaurant_name}`);
  const dryRun = Boolean(snipe.dry_run);

  const slots = await checkResyAvailability(
    config,
    String(snipe.venue_id),
    snipe.target_date,
    snipe.party_size
  );

  const match = findMatchingSlot(slots, snipe.preferred_times);
  if (!match) {
    log(`${snipe.id}: no matching slots (${slots.length} total)`);
    return { success: false, snipe };
  }

  log(`${snipe.id}: MATCH ${match.displayTime} — booking`);
  const result = await bookResySlot(
    config,
    match,
    snipe.target_date,
    snipe.party_size,
    dryRun
  );

  if (result.ok) {
    log(`${snipe.id}: SUCCESS — ${result.message}`);
    await sendNotification(
      `Booked ${snipe.restaurant_name}!`,
      `${result.bookedTime} on ${snipe.target_date}`
    );
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
    const icon = r.success ? "✅" : "⏭️";
    lines.push(`- ${icon} **${r.snipe.restaurant_name}** (${r.snipe.id})`);
    if (r.result?.bookedTime) lines.push(`  - Booked: ${r.result.bookedTime}`);
    if (r.result?.message) lines.push(`  - ${r.result.message}`);
  }
  fs.appendFileSync(summaryPath, lines.join("\n") + "\n");
}

async function main() {
  const forceId = process.env.SNIPE_ID;
  const snipes = loadSnipes().filter((s) => s.enabled !== false && s.platform === "resy");
  const now = new Date();
  const results = [];

  log(`Loaded ${snipes.length} enabled Resy snipe(s)`);

  const config = await getResyConfigFromEnv();
  log("Resy auth OK");

  for (const snipe of snipes) {
    if (forceId && snipe.id !== forceId) continue;

    try {
      if (snipe.mode === "drop" && shouldRunDropSnipe(snipe, now)) {
        const result = await runDropSnipe(config, snipe);
        results.push(result);
      } else if (snipe.mode === "poll" && shouldRunPollSnipe(snipe)) {
        const result = await runPollSnipe(config, snipe);
        results.push(result);
      } else {
        log(`${snipe.id}: skipped (not scheduled for this cycle)`);
      }
    } catch (err) {
      log(`${snipe.id}: ERROR — ${err.message}`);
      results.push({ success: false, snipe, error: err.message });
    }
  }

  await writeSummary(results);

  const anySuccess = results.some((r) => r.success);
  if (anySuccess) {
    log("At least one snipe succeeded!");
  } else {
    log("No bookings this run.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
