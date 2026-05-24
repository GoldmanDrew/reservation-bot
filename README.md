# Reservation Bot

**Free** GitHub Pages UI + GitHub Actions sniper for Resy reservations.

Inspired by [0xLoris's reservation bots](https://x.com/0xLoris/status/1749493887113028036).

| | |
|---|---|
| **UI (GitHub Pages)** | [goldmandrew.github.io/reservation-bot](https://goldmandrew.github.io/reservation-bot/) |
| **Repo** | [github.com/GoldmanDrew/reservation-bot](https://github.com/GoldmanDrew/reservation-bot) |
| **Actions** | [View workflow runs](https://github.com/GoldmanDrew/reservation-bot/actions) |

---

## Quick setup (5 minutes, $0)

### 1. Add GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Required | Description |
|---|---|---|
| `RESY_EMAIL` | Yes | Your Resy login email |
| `RESY_PASSWORD` | Yes | Your Resy login password |
| `WEBHOOK_URL` | No | Discord/Telegram webhook for success notifications |

### 2. Enable GitHub Pages

Go to **Settings → Pages → Build and deployment**:
- Source: **GitHub Actions**

(Pages deploys automatically when you push to `main`.)

### 3. Create a snipe

1. Open the [GitHub Pages UI](https://goldmandrew.github.io/reservation-bot/)
2. Fill in restaurant details and click **Generate YAML**
3. Paste the YAML into [`config/snipes.yaml`](https://github.com/GoldmanDrew/reservation-bot/edit/main/config/snipes.yaml)
4. Push to `main`

### 4. Find venue ID (one-time)

Clone locally to search Resy:

```bash
git clone https://github.com/GoldmanDrew/reservation-bot.git
cd reservation-bot
npm install
npm run search -- "Carbone"
```

Copy the `venue_id` into your snipe config.

---

## How the sniper works

GitHub Actions runs **every 5 minutes** (free tier minimum):

| Mode | Behavior |
|---|---|
| **Drop snipe** | If `drop_at` is within 6 minutes, the job sleeps until 30s before drop, then polls every **200ms** for 3 minutes |
| **Poll snipe** | Checks availability once per workflow run (every 5 min) |

### Example `config/snipes.yaml`

```yaml
snipes:
  - id: carbone-june-15
    enabled: true
    platform: resy
    venue_id: "6194"
    restaurant_name: Carbone
    target_date: "2026-06-15"
    party_size: 2
    preferred_times: ["19:00", "19:30", "20:00"]
    mode: drop
    drop_at: "2026-05-16T13:00:00.000Z"
    dry_run: true
```

Set `dry_run: false` when ready to book for real. Set `enabled: false` after a successful booking.

### Manual run

Go to **Actions → Reservation Sniper → Run workflow** to trigger immediately.

---

## Run locally (optional)

The repo also includes a full Next.js app for local sniping with a live UI:

```bash
npm install
npm run dev          # Web UI at localhost:3000
npm run snipe        # Run sniper from config/snipes.yaml
npm run search -- "Carbone"
```

---

## Limitations

- **5-minute cron minimum** — drop snipes compensate by polling aggressively once the workflow starts near `drop_at`
- **Resy only** in Actions mode (OpenTable needs browser cookies)
- **GitHub Actions free tier**: 2,000 min/month for private repos, unlimited for public
- No payment info required anywhere

---

## Disclaimer

For personal use only. Automation may violate platform Terms of Service.
