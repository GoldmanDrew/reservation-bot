# Reservation Bot

**Free** GitHub Pages UI + GitHub Actions sniper for **OpenTable** and Resy.

| | |
|---|---|
| **UI** | [goldmandrew.github.io/reservation-bot](https://goldmandrew.github.io/reservation-bot/) |
| **Repo** | [github.com/GoldmanDrew/reservation-bot](https://github.com/GoldmanDrew/reservation-bot) |
| **Actions** | [View workflow runs](https://github.com/GoldmanDrew/reservation-bot/actions) |

---

## Quick setup — OpenTable ($0)

### 1. Get browser cookies

1. Log into [opentable.com](https://www.opentable.com) in Chrome
2. F12 → **Network** → refresh
3. Click any `opentable.com` request → copy **Cookie** header (full value)
4. Optional: copy **x-csrf-token** header

### 2. Add GitHub Secrets

[Settings → Secrets → Actions](https://github.com/GoldmanDrew/reservation-bot/settings/secrets/actions)

| Secret | Required | Description |
|---|---|---|
| `OPENTABLE_COOKIES` | **Yes** | Full Cookie header from step 1 |
| `OPENTABLE_CSRF_TOKEN` | No | x-csrf-token if present |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | No | Your chat ID — bot DMs you when a slot is found |
| `WEBHOOK_URL` | No | Discord webhook (alternative to Telegram) |
| `RESY_EMAIL` / `RESY_PASSWORD` | No | Only if using Resy snipes |

### 3. Create a snipe

1. Open the [Pages UI](https://goldmandrew.github.io/reservation-bot/) → select **OpenTable**
2. Enter restaurant ID (`rid` from OpenTable URL, e.g. `8033`)
3. Generate YAML → paste into [`config/snipes.yaml`](https://github.com/GoldmanDrew/reservation-bot/edit/main/config/snipes.yaml)
4. Push to `main`

### Telegram alerts (recommended)

Telegram does **not** use `WEBHOOK_URL`. Add these two secrets instead:

1. Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` → copy the **bot token**
2. Message your new bot once (say "hi")
3. Open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser
4. Find `"chat":{"id":123456789}` — that number is your **chat ID**
5. Add GitHub Secrets:
   - `TELEGRAM_BOT_TOKEN` = token from BotFather
   - `TELEGRAM_CHAT_ID` = your chat id

When a slot is found, you'll get a Telegram message with the OpenTable booking link.

---

- Check the [Actions run summary](https://github.com/GoldmanDrew/reservation-bot/actions) for **Complete booking →** link
- Or get the link via Discord/Telegram if `WEBHOOK_URL` is set
- Click to confirm on OpenTable (~5 seconds)

---

## Example OpenTable snipe

```yaml
snipes:
  - id: carbone-june-15
    enabled: true
    platform: opentable
    venue_id: "8033"
    restaurant_name: Carbone
    target_date: "2026-06-15"
    party_size: 2
    preferred_times: ["19:00", "19:30", "20:00"]
    mode: drop
    drop_at: "2026-05-16T13:00:00.000Z"
    dry_run: false
```

Find `venue_id`: open restaurant on OpenTable → URL contains `rid=8033`, or:

```bash
set OPENTABLE_COOKIES=paste-your-cookies-here
npm run search:opentable -- "Carbone"
```

---

## How it works

| Mode | Behavior |
|---|---|
| **Drop snipe** | When `drop_at` is within 6 min, polls every **200ms** for 3 minutes |
| **Poll snipe** | Checks once per Actions run (every 5 min) |

**OpenTable:** Finds slot → sends pre-filled booking URL (auto-book attempted, handoff is fallback).

**Resy:** Full auto-book if `RESY_EMAIL` + `RESY_PASSWORD` secrets are set.

---

## Cookie refresh

OpenTable cookies expire. When Actions fail with auth errors:

1. Re-copy cookies from Chrome
2. Update `OPENTABLE_COOKIES` secret
3. Re-run workflow manually

---

## Local dev (optional)

```bash
npm install
set OPENTABLE_COOKIES=...
npm run snipe              # run from config/snipes.yaml
npm run search:opentable -- "Carbone"
npm run dev                # full Next.js UI
```

---

## Disclaimer

Personal use only. May violate platform Terms of Service.
