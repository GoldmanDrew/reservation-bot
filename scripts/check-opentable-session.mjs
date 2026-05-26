#!/usr/bin/env node
import { getOpenTableConfigFromEnv, verifyOpenTableAuth } from "./lib/opentable.mjs";
import { loadEnabledSnipes } from "./lib/snipes-config.mjs";
import { sendNotification } from "./lib/notify.mjs";

async function main() {
  const otSnipes = loadEnabledSnipes().filter((s) => s.platform === "opentable");
  if (otSnipes.length === 0) {
    console.log("No enabled OpenTable snipes — skipping cookie check");
    return;
  }

  let config;
  try {
    config = getOpenTableConfigFromEnv();
  } catch (err) {
    await sendNotification(
      "OpenTable cookies missing",
      "Set OPENTABLE_COOKIES in GitHub Secrets before sniping."
    );
    throw err;
  }

  const valid = await verifyOpenTableAuth(config);
  if (!valid) {
    await sendNotification(
      "OpenTable cookies expired",
      "Refresh OPENTABLE_COOKIES in GitHub Secrets. Copy Cookie header from logged-in opentable.com."
    );
    throw new Error("OpenTable session invalid — update OPENTABLE_COOKIES");
  }

  console.log("OpenTable session OK");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
