# Reservation Bot

**4 inputs → fully automated OpenTable sniper** (GitHub Actions + Telegram). $0.

| | |
|---|---|
| **UI** | [goldmandrew.github.io/reservation-bot](https://goldmandrew.github.io/reservation-bot/) |
| **Create snipe** | [Actions → Create Snipe](https://github.com/GoldmanDrew/reservation-bot/actions/workflows/create-snipe.yml) |
| **Sniper runs** | Every 5 minutes automatically |

---

## Quick start

### 1. GitHub Secrets (one time)

[Settings → Secrets → Actions](https://github.com/GoldmanDrew/reservation-bot/settings/secrets/actions)

| Secret | Required |
|---|---|
| `OPENTABLE_COOKIES` | Yes — Cookie header from logged-in opentable.com |
| `TELEGRAM_BOT_TOKEN` | Yes — from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes — from getUpdates |

### 2. Create a snipe (4 fields only)

Go to **[Actions → Create Snipe → Run workflow](https://github.com/GoldmanDrew/reservation-bot/actions/workflows/create-snipe.yml)**

| Input | Example |
|---|---|
| restaurant_name | `San Sabino` |
| target_date | `2026-06-26` |
| party_size | `4` |
| preferred_times | `19:00,19:30,20:00` |
| dry_run | `true` (first test) |

**The workflow automatically:**
- Resolves OpenTable `rid`
- Calculates `drop_at` (30 days @ 9am ET for known restaurants)
- Writes `config/snipes.yaml`
- Sends Telegram: "Snipe armed"

### 3. On drop day

Sniper polls at 200ms when drop time hits → Telegram sends **booking link** → tap to confirm on OpenTable (~5 sec).

---

## What you never do manually

- Look up `rid`
- Calculate drop time
- Edit YAML by hand
- Disable snipe after success (auto-disabled)

---

## Secrets reference

| Secret | Purpose |
|---|---|
| `OPENTABLE_COOKIES` | Browser session (refresh when expired) |
| `OPENTABLE_CSRF_TOKEN` | Optional |
| `TELEGRAM_BOT_TOKEN` | Alert bot |
| `TELEGRAM_CHAT_ID` | Your chat ID |
| `RESY_EMAIL` / `RESY_PASSWORD` | Optional — only if using Resy snipes |

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
