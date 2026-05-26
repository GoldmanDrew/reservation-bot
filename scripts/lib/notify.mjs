export async function sendTelegram(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram send failed (${res.status}): ${err.slice(0, 200)}`);
  }
}

export async function sendNotification(title, body) {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (telegramToken && telegramChatId) {
    try {
      const text = `*${escapeMarkdown(title)}*\n\n${escapeMarkdown(body)}`;
      await sendTelegram(telegramToken, telegramChatId, text);
      return;
    } catch (err) {
      console.warn("Telegram notification failed:", err.message);
    }
  }

  const webhook = process.env.WEBHOOK_URL;
  if (!webhook) return;

  try {
    if (webhook.includes("discord.com/api/webhooks")) {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{ title, description: body, color: 0x22c55e }],
        }),
      });
    } else {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `**${title}**\n${body}` }),
      });
    }
  } catch (err) {
    console.warn("Webhook notification failed:", err.message);
  }
}

function escapeMarkdown(text) {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
