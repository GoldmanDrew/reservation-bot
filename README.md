# Reservation Bot

**4 inputs → fully automated OpenTable sniper** (GitHub Actions + Telegram). $0.

| | |
|---|---|
| **UI** | [goldmandrew.github.io/reservation-bot](https://goldmandrew.github.io/reservation-bot/) |
| **Create snipe** | Sign in on Pages → fill form → **Create snipe** (or [Actions → Create Snipe](https://github.com/GoldmanDrew/reservation-bot/actions/workflows/create-snipe.yml)) |
| **Sniper runs** | Every 5 minutes automatically |

---

## Quick start

### 1. One-time OAuth setup (like [single-stock-investments](https://github.com/GoldmanDrew/single-stock-investments))

1. Create a [GitHub OAuth App](https://github.com/settings/developers) with **Device Flow** enabled  
   Callback URL: `https://goldmandrew.github.io/reservation-bot/oauth/callback.html`
2. Deploy the free Cloudflare proxy — see [`docs/oauth-proxy/README.md`](docs/oauth-proxy/README.md)
3. Set repo **Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose |
|---|---|
| `OAUTH_CLIENT_ID` | OAuth App Client ID |
| `OAUTH_PROXY_URL` | Cloudflare worker URL (no trailing slash) |

4. Redeploy Pages (push to `main` or run **Deploy GitHub Pages**)

### 2. Connect accounts on Pages

Open **[goldmandrew.github.io/reservation-bot](https://goldmandrew.github.io/reservation-bot/)**

1. **Sign in with GitHub** — token stays in your browser (no PAT in Settings)
2. **Connect OpenTable** — paste cookies once; saved to `OPENTABLE_COOKIES` secret via GitHub API
3. **Connect Telegram** — message your bot **`/start`** (bot replies with chat ID within ~5 min, or click **Test Telegram**), then save token + chat ID on Pages

Or set secrets manually: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### 3. Create a snipe (4 fields)

| Input | Example |
|---|---|
| restaurant_name | `San Sabino` |
| target_date | `2026-06-26` |
| party_size | `4` |
| preferred_times | `19:00,19:30,20:00` |
| dry_run | `true` (first test) |

Click **Create snipe** on Pages (or run the workflow manually in Actions).

**The workflow automatically:**
- Resolves OpenTable `rid`
- Calculates `drop_at` (30 days @ 9am ET for known restaurants)
- Writes `config/snipes.yaml`
- Sends Telegram: "Snipe armed"

### 4. On drop day

Sniper polls at 200ms when drop time hits → Telegram sends **booking link** → tap to confirm on OpenTable (~5 sec).

---

## What you never do manually

- Look up `rid`
- Calculate drop time
- Edit YAML by hand
- Paste cookies into GitHub Settings (use Pages Connect OpenTable instead)
- Disable snipe after success (auto-disabled)

---

## Secrets & variables reference

| Name | Type | Purpose |
|---|---|---|
| `OAUTH_CLIENT_ID` | Variable | GitHub OAuth App |
| `OAUTH_PROXY_URL` | Variable | Cloudflare OAuth proxy |
| `OPENTABLE_COOKIES` | Secret | Browser session (save from Pages or Settings) |
| `OPENTABLE_CSRF_TOKEN` | Secret | Optional |
| `TELEGRAM_BOT_TOKEN` | Secret | Alert bot |
| `TELEGRAM_CHAT_ID` | Secret | Your chat ID |
| `SNIPE_DISPATCH_TOKEN` | Secret | Optional extra validation for Pages dispatch |
| `RESY_EMAIL` / `RESY_PASSWORD` | Secret | Optional — only if using Resy snipes |

---

## Local commands

```bash
npm install
npm run test:drop-time          # verify San Sabino drop calculation
npm run search:opentable -- "San Sabino"   # needs OPENTABLE_COOKIES env
RESTAURANT_NAME="San Sabino" TARGET_DATE=2026-06-26 PARTY_SIZE=4 PREFERRED_TIMES="19:00" DRY_RUN=true node scripts/create-snipe.mjs
```

---

## Drop rules

Known restaurants: `config/drop-rules.yaml` (San Sabino = 30 days @ 9am ET).

Unknown restaurants default to same heuristic. Add entries to improve accuracy.

---

## Disclaimer

Personal use only. May violate platform Terms of Service.
