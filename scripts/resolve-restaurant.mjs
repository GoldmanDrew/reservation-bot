#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { subDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import {
  getOpenTableConfigFromEnv,
  resolveOpenTableBySlug,
  searchOpenTableRestaurants,
} from "./lib/opentable.mjs";
import { searchResyRestaurants } from "./lib/resy.mjs";
import { slugify } from "./lib/snipes-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DROP_RULES_PATH = path.join(__dirname, "..", "config", "drop-rules.yaml");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      out[key] = argv[i + 1] ?? "true";
      i++;
    }
  }
  return out;
}

function similarity(a, b) {
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  return 0;
}

function parseUrl(input) {
  try {
    const u = new URL(input);
    if (u.hostname.includes("opentable.com")) {
      const rid = u.searchParams.get("rid");
      const slugMatch = u.pathname.match(/\/r\/([^/?]+)/);
      return {
        platform: "opentable",
        venue_id: rid ?? undefined,
        slug: slugMatch?.[1],
      };
    }
    if (u.hostname.includes("resy.com")) {
      const match = u.pathname.match(/\/cities\/([^/]+)\/venues\/([^/?]+)/);
      if (match) return { platform: "resy", slug: match[2], city: match[1] };
    }
  } catch {
    return null;
  }
  return null;
}

export async function resolveRestaurant(input, options = {}) {
  const city = options.city ?? "New York";
  const lat = options.lat ?? 40.7128;
  const lon = options.lon ?? -74.006;

  if (input.startsWith("http")) {
    const parsed = parseUrl(input);
    if (!parsed) throw new Error("Unrecognized restaurant URL");

    if (parsed.platform === "opentable") {
      if (parsed.venue_id) {
        return {
          platform: "opentable",
          venue_id: parsed.venue_id,
          name: parsed.slug?.replace(/-/g, " ") ?? `Restaurant ${parsed.venue_id}`,
          slug: parsed.slug,
          url: input,
          confidence: "high",
        };
      }
      if (parsed.slug) {
        const config = getOpenTableConfigFromEnv();
        const resolved = await resolveOpenTableBySlug(parsed.slug, config);
        if (resolved) {
          return { ...resolved, venue_id: resolved.venueId, confidence: "high" };
        }
      }
    }
  }

  const name = input.trim();
  let otResults = [];
  let resyResults = [];

  try {
    const config = getOpenTableConfigFromEnv();
    otResults = await searchOpenTableRestaurants(config, name, lat, lon);
  } catch {
    // OpenTable search optional if no cookies
  }

  try {
    resyResults = await searchResyRestaurants(name, lat, lon);
  } catch {
    // Resy optional
  }

  const combined = [
    ...otResults.map((r) => ({ ...r, platform: "opentable", score: similarity(name, r.name) + 0.05 })),
    ...resyResults.map((r) => ({ ...r, platform: "resy", score: similarity(name, r.name) })),
  ].sort((a, b) => b.score - a.score);

  if (combined.length === 0) {
    throw new Error(`No restaurants found for "${name}"`);
  }

  const best = combined[0];
  if (combined.length > 1 && best.score < 0.8) {
    const top = combined.slice(0, 5).map((r) => ({
      platform: r.platform,
      name: r.name,
      venue_id: r.venueId ?? r.venue_id,
      location: r.location,
    }));
    const err = new Error(`Ambiguous match for "${name}" — pick one explicitly`);
    err.matches = top;
    throw err;
  }

  return {
    platform: best.platform,
    venue_id: String(best.venueId ?? best.venue_id),
    venueId: String(best.venueId ?? best.venue_id),
    name: best.name,
    slug: best.slug,
    url: best.url,
    location: best.location,
    confidence: best.score >= 0.9 ? "high" : "medium",
  };
}

export function loadDropRules() {
  if (!fs.existsSync(DROP_RULES_PATH)) return {};
  return yaml.load(fs.readFileSync(DROP_RULES_PATH, "utf-8")) ?? {};
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function researchDropTime({ platform, venue_id, slug, name, target_date }) {
  const rules = loadDropRules();
  const keys = [slug, venue_id, slugify(name)].filter(Boolean);

  let rule = null;
  for (const key of keys) {
    if (rules[key]) {
      rule = rules[key];
      break;
    }
  }
  if (!rule) {
    rule = rules._defaults?.[platform] ?? rules._defaults?.opentable ?? {
      days_before: 30,
      hour: 9,
      minute: 0,
      timezone: "America/New_York",
      source: "default_heuristic",
    };
  }

  const [y, m, d] = target_date.split("-").map(Number);
  const dropLocalDate = subDays(new Date(y, m - 1, d), rule.days_before);
  const dropDateStr = `${dropLocalDate.getFullYear()}-${pad(dropLocalDate.getMonth() + 1)}-${pad(dropLocalDate.getDate())}`;
  const localIso = `${dropDateStr}T${pad(rule.hour)}:${pad(rule.minute)}:00`;
  const drop_at = fromZonedTime(localIso, rule.timezone).toISOString();

  return {
    drop_at,
    days_before: rule.days_before,
    local_time: `${pad(rule.hour)}:${pad(rule.minute)}`,
    timezone: rule.timezone,
    source: rule.source ?? "default_heuristic",
    confidence: rule.source === "restaurant_website" ? "high" : "medium",
  };
}

async function main() {
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
    return;
  }

  if (args.mode === "drop-only") {
    const drop = researchDropTime({
      platform: args.platform,
      venue_id: args.venue_id,
      slug: args.slug,
      name: args.name,
      target_date: args.date,
    });
    console.log(JSON.stringify(drop));
    return;
  }

  const resolved = await resolveRestaurant(args.name ?? args.input, { city: args.city });
  console.log(JSON.stringify(resolved, null, 2));
}

if (process.argv[1]?.includes("resolve-restaurant")) {
  main().catch((err) => {
    if (err.matches) {
      console.error(err.message);
      console.error(JSON.stringify(err.matches, null, 2));
    } else {
      console.error(err.message);
    }
    process.exit(1);
  });
}
