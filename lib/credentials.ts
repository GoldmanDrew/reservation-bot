import fs from "fs";
import path from "path";
import { getDataDir } from "./data-dir";
import type { OpenTableCredentials, ResyCredentials } from "./types";

interface StoredCredentials {
  resy?: ResyCredentials;
  opentable?: OpenTableCredentials;
}

function credentialsPath(): string {
  return path.join(getDataDir(), "credentials.json");
}

function readCredentials(): StoredCredentials {
  const credPath = credentialsPath();
  if (!fs.existsSync(credPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(credPath, "utf-8")) as StoredCredentials;
  } catch {
    return {};
  }
}

function writeCredentials(creds: StoredCredentials) {
  fs.writeFileSync(credentialsPath(), JSON.stringify(creds, null, 2), "utf-8");
}

function envResyCredentials(): ResyCredentials | null {
  const authToken = process.env.RESY_AUTH_TOKEN;
  const email = process.env.RESY_EMAIL;
  const password = process.env.RESY_PASSWORD;

  if (authToken) {
    return {
      apiKey: process.env.RESY_API_KEY || DEFAULT_RESY_API_KEY,
      authToken,
      email,
    };
  }

  if (email && password) {
    return {
      apiKey: process.env.RESY_API_KEY || DEFAULT_RESY_API_KEY,
      authToken: "",
      email,
    };
  }

  return null;
}

function envOpenTableCredentials(): OpenTableCredentials | null {
  const cookies = process.env.OPENTABLE_COOKIES;
  if (!cookies) return null;
  return {
    cookies,
    csrfToken: process.env.OPENTABLE_CSRF_TOKEN,
    email: process.env.OPENTABLE_EMAIL,
  };
}

export function getResyCredentials(): ResyCredentials | null {
  return readCredentials().resy ?? envResyCredentials();
}

export function setResyCredentials(creds: ResyCredentials) {
  const all = readCredentials();
  all.resy = creds;
  writeCredentials(all);
}

export function clearResyCredentials() {
  const all = readCredentials();
  delete all.resy;
  writeCredentials(all);
}

export function getOpenTableCredentials(): OpenTableCredentials | null {
  return readCredentials().opentable ?? envOpenTableCredentials();
}

export function setOpenTableCredentials(creds: OpenTableCredentials) {
  const all = readCredentials();
  all.opentable = creds;
  writeCredentials(all);
}

export function clearOpenTableCredentials() {
  const all = readCredentials();
  delete all.opentable;
  writeCredentials(all);
}

export function getAuthStatus() {
  const resy = getResyCredentials();
  const opentable = getOpenTableCredentials();
  return {
    resy: {
      connected: Boolean(resy?.authToken && resy?.apiKey),
      email: resy?.email,
      fromEnv: Boolean(process.env.RESY_AUTH_TOKEN || process.env.RESY_EMAIL),
    },
    opentable: {
      connected: Boolean(opentable?.cookies),
      email: opentable?.email,
      fromEnv: Boolean(process.env.OPENTABLE_COOKIES),
    },
  };
}

export async function seedCredentialsFromEnv() {
  const email = process.env.RESY_EMAIL;
  const password = process.env.RESY_PASSWORD;
  const stored = readCredentials();

  if (email && password && !stored.resy?.authToken && !process.env.RESY_AUTH_TOKEN) {
    try {
      const { loginResy } = await import("./platforms/resy");
      await loginResy(email, password, process.env.RESY_API_KEY);
      console.log("[credentials] Resy login from env succeeded");
    } catch (err) {
      console.error("[credentials] Resy env login failed:", err);
    }
  }

  const otCookies = process.env.OPENTABLE_COOKIES;
  if (otCookies && !stored.opentable?.cookies) {
    setOpenTableCredentials({
      cookies: otCookies,
      csrfToken: process.env.OPENTABLE_CSRF_TOKEN,
      email: process.env.OPENTABLE_EMAIL,
    });
    console.log("[credentials] OpenTable session seeded from env");
  }
}

export const DEFAULT_RESY_API_KEY = "VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5";
