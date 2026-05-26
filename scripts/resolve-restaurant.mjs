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
const ALIASES_PATH = path.join(__dirname, "..", "config", "restaurant-aliases.yaml");

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
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  return 0;
}

function scoreMatch(query, candidateName) {
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const c = candidateName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  if (q === c) return 1;
  const qTokens = q.split(/\s+/).filter(Boolean);
  const cTokens = c.split(/\s+/).filter(Boolean);
  if (
    qTokens.length > 0 &&
    qTokens.every((token) =>
      cTokens.some((ct) => ct === token || ct.includes(token) || token.includes(ct))
    )
  ) {
    return 0.95;
  }
  return similarity(query, candidateName);
}

function loadAliases() {
  if (!fs.existsSync(ALIASES_PATH)) return {};
  const doc = yaml.load(fs.readFileSync(ALIASES_PATH, "utf-8")) ?? {};
  return doc.aliases ?? {};
}

function normalizeVenueId(result) {
  const id = result.venueId ?? result.venue_id;
  if (id == null) return "";
  if (typeof id === "object") {
    return String(id.resy_id ?? id.id ?? id.venue_id ?? "");
  }
  return String(id);
}

async function tryOpenTableSlugGuesses(name, config) {
  const base = slugify(name);
  const slugs = [`${base}-new-york`, `${base}-nyc`, base];
  for (const slug of slugs) {
    const resolved = await resolveOpenTableBySlug(slug, config);
    if (resolved && scoreMatch(name, resolved.name) >= 0.8) {
      return {
        platform: "opentable",
        venue_id: String(resolved.venueId),
        venueId: String(resolved.venueId),
        name: resolved.name,
        slug: resolved.slug ?? slug,
        url: resolved.url,
        location: resolved.location,
        confidence: "high",
      };
    }
  }
  return null;
}

async function resolveFromAlias(alias, name, config) {
  if (alias.venue_id) {
    return {
      platform: alias.platform ?? "opentable",
      venue_id: String(alias.venue_id),
      venueId: String(alias.venue_id),
      name: alias.name ?? name,
      slug: alias.slug,
      url: alias.slug ? `https://www.opentable.com/r/${alias.slug}` : undefined,
      confidence: "high",
    };
  }

  if (alias.slug && config) {
    try {
      const resolved = await resolveOpenTableBySlug(alias.slug, config);
      if (resolved) {
        return {
          platform: alias.platform ?? "opentable",
          venue_id: String(resolved.venueId),
          venueId: String(resolved.venueId),
          name: alias.name ?? resolved.name,
          slug: alias.slug ?? resolved.slug,
          url: resolved.url,
          location: resolved.location,
          confidence: "high",
        };
      }
    } catch (err) {
      console.warn(`OpenTable slug lookup failed for ${alias.slug}:`, err.message);
    }
  }

  if (alias.slug) {
    return {
      platform: alias.platform ?? "opentable",
      venue_id: "",
      venueId: "",
      name: alias.name ?? name,
      slug: alias.slug,
      url: `https://www.opentable.com/r/${alias.slug}`,
      confidence: "medium",
    };
  }

  return null;
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
  const aliases = loadAliases();
  const alias = aliases[name.toLowerCase()];
  let otConfig = null;

  try {
    otConfig = getOpenTableConfigFromEnv();
  } catch {
    // OpenTable optional for URL-only resolution
  }

  if (alias) {
    if (alias.venue_id) {
      return {
        platform: alias.platform ?? "opentable",
        venue_id: String(alias.venue_id),
        venueId: String(alias.venue_id),
        name: alias.name ?? name,
        slug: alias.slug,
        url: alias.slug ? `https://www.opentable.com/r/${alias.slug}` : undefined,
        confidence: "high",
      };
    }
    if (otConfig) {
      const fromAlias = await resolveFromAlias(alias, name, otConfig);
      if (fromAlias) return fromAlias;
    }
  }

  let otResults = [];
  let resyResults = [];

  if (otConfig) {
    try {
      const slugHit = await tryOpenTableSlugGuesses(name, otConfig);
      if (slugHit) return slugHit;
      otResults = await searchOpenTableRestaurants(otConfig, name, lat, lon);
    } catch (err) {
      console.warn("OpenTable search failed:", err.message);
    }
  }

  const preferOpenTable = Boolean(process.env.OPENTABLE_COOKIES?.trim());

  try {
    resyResults = await searchResyRestaurants(name, lat, lon);
  } catch {
    // Resy optional
  }

  const combined = [
    ...otResults.map((r) => ({
      ...r,
      platform: "opentable",
      score: scoreMatch(name, r.name) + 0.05,
    })),
    ...(preferOpenTable
      ? []
      : resyResults.map((r) => ({
          ...r,
          platform: "resy",
          score: scoreMatch(name, r.name),
        }))),
  ]
    .filter((r) => r.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  if (combined.length === 0) {
    const hint = preferOpenTable
      ? "OpenTable search returned nothing — refresh OPENTABLE_COOKIES or add an entry in config/restaurant-aliases.yaml"
      : "Try the exact name, an OpenTable URL, or add an alias in config/restaurant-aliases.yaml";
    throw new Error(`No restaurants found for "${name}". ${hint}`);
  }

  const best = combined[0];
  const runnerUp = combined[1];
  if (
    combined.length > 1 &&
    best.score < 0.9 &&
    (!runnerUp || best.score - runnerUp.score < 0.08)
  ) {
    const top = combined.slice(0, 5).map((r) => ({
      platform: r.platform,
      name: r.name,
      venue_id: normalizeVenueId(r),
      location: r.location,
      score: r.score,
    }));
    const err = new Error(`Ambiguous match for "${name}" — pick one explicitly`);
    err.matches = top;
    throw err;
  }

  return {
    platform: best.platform,
    venue_id: normalizeVenueId(best),
    venueId: normalizeVenueId(best),
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
