#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { sendTelegram } from "./lib/notify.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(__dirname, "..", "config", "telegram-state.yaml");

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { update_offset: 0 };
  try {
    return yaml.load(fs.readFileSync(STATE_PATH, "utf-8")) ?? { update_offset: 0 };
  } catch {
    return { update_offset: 0 };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, yaml.dump(state), "utf-8");
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not set — skipping inbox");
    return;
  }

  const state = loadState();
  const params = new URLSearchParams({ timeout: "0", limit: "20" });
  if (state.update_offset) params.set("offset", String(state.update_offset));

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?${params}`);
  if (!res.ok) {
    throw new Error(`Telegram getUpdates failed (${res.status})`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || "Telegram getUpdates error");
  }

  const updates = data.result ?? [];
  if (updates.length === 0) {
    console.log("No new Telegram messages");
    return;
  }

  let nextOffset = state.update_offset ?? 0;

  for (const update of updates) {
    nextOffset = Math.max(nextOffset, update.update_id + 1);
    const message = update.message;
    if (!message?.text || !message.chat?.id) continue;

    const text = message.text.trim();
    const chatId = message.chat.id;

    if (text === "/start" || text.startsWith("/start ")) {
      await sendTelegram(
        token,
        chatId,
        [
          "Reservation Bot connected!",
          "",
          `Your chat ID: ${chatId}`,
          "",
          "Add it to GitHub Secret TELEGRAM_CHAT_ID (or save from the Pages dashboard).",
          "",
          "Send /test to verify alerts.",
        ].join("\n")
      );
      console.log(`Replied to /start for chat ${chatId}`);
    } else if (text === "/test" || text.startsWith("/test ")) {
      await sendTelegram(token, chatId, "Reservation Bot test OK");
      console.log(`Replied to /test for chat ${chatId}`);
    }
  }

  if (nextOffset !== state.update_offset) {
    saveState({ update_offset: nextOffset });
    console.log(`Telegram inbox offset → ${nextOffset}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
