# Reservation Bot

A web app to snipe restaurant reservations on **Resy** and **OpenTable** — inspired by [0xLoris's reservation bots](https://x.com/0xLoris/status/1749493887113028036).

Enter a restaurant, set your preferred times, and the bot polls at drop time (or continuously) to grab a slot the instant it appears.

## Features

- **Unified search** — find restaurants on Resy and OpenTable from one search box
- **Drop snipe** — wake 30s before release time, poll every 200ms, book instantly
- **Poll snipe** — watch for cancellations on an interval
- **Resy auto-booking** — full headless booking via Resy API
- **OpenTable handoff** — detects slots and opens a pre-filled booking URL
- **Dry run mode** — test timing without actually booking
- **Live job logs** — monitor snipes in real time
- **Cloud-ready** — Docker + Render deploy with persistent storage

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to the cloud (Render)

> **Note:** GitHub Pages only hosts static sites and cannot run this app (it needs a server, SQLite, and a background sniper). Use **Render** for a always-on cloud URL.

### One-click deploy

1. Push this repo to GitHub (see below)
2. Go to [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
3. Connect your GitHub repo — Render reads `render.yaml` automatically
4. Set secret env vars when prompted:
   - `APP_PASSWORD` — password to protect your public URL (**required**)
   - `RESY_EMAIL` + `RESY_PASSWORD` — optional, pre-seed Resy login
   - `OPENTABLE_COOKIES` — optional, pre-seed OpenTable session
5. Deploy — you'll get a URL like `https://reservation-bot-xxxx.onrender.com`

The Render blueprint mounts a **1 GB persistent disk** at `/data` so jobs and credentials survive restarts.

### Manual Docker deploy

Works on Railway, Fly.io, or any VPS:

```bash
docker build -t reservation-bot .
docker run -p 3000:3000 \
  -e APP_PASSWORD=your-secret \
  -e RESY_EMAIL=you@example.com \
  -e RESY_PASSWORD=your-password \
  -v reservation-bot-data:/data \
  reservation-bot
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `APP_PASSWORD` | **Yes (cloud)** | Basic-auth password for the whole app |
| `DATA_DIR` | No | Data directory (default `./data`, use `/data` in Docker) |
| `RESY_EMAIL` | No | Pre-seed Resy login |
| `RESY_PASSWORD` | No | Pre-seed Resy login |
| `RESY_AUTH_TOKEN` | No | Skip login if you have a token already |
| `OPENTABLE_COOKIES` | No | Pre-seed OpenTable browser cookies |
| `PORT` | No | Server port (set automatically on Render) |

## Usage

1. Go to **Settings** and connect your Resy account (or set env vars)
2. Optionally connect OpenTable (paste browser cookies)
3. Create a **New Snipe** with restaurant, date, times, and drop time
4. Monitor progress on the **Jobs** page

## Snipe modes

### Drop snipe

For restaurants that release reservations on a schedule (typically 30 days out at 9:00 AM ET):

- Set your target dinner date and preferred times
- Set the drop datetime (auto-suggested as 30 days prior at 9am)
- Bot wakes 30 seconds early, polls every 200ms for 2 minutes, books first match

### Poll snipe

For catching cancellations:

- Set poll interval (5s–60s)
- Bot runs up to 24 hours until a matching slot appears

## Disclaimer

For personal use only. Automation may violate platform Terms of Service. Use responsibly.
