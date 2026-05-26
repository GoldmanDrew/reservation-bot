#!/usr/bin/env node
import { sendNotification } from "./lib/notify.mjs";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set in GitHub Secrets");
  }
  if (!chatId) {
    throw new Error(
      "TELEGRAM_CHAT_ID is not set. Message your bot /start — the reply includes your chat ID."
    );
  }

  await sendNotification(
    "Reservation Bot test",
    "Telegram alerts are working. Snipe notifications will arrive here."
  );
  console.log(`Test message sent to chat ${chatId}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
