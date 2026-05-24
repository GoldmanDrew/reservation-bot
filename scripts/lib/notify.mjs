export async function sendNotification(title, body) {
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
    console.warn("Notification failed:", err.message);
  }
}

export function appendSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  import("fs").then((fs) => {
    fs.appendFileSync(summaryPath, lines.join("\n") + "\n");
  });
}
