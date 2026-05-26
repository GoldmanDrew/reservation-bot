# Reservation Bot OAuth proxy (Cloudflare Worker)

GitHub Pages cannot call `github.com/login/oauth/access_token` from the browser (CORS). This worker forwards OAuth requests server-side.

## One-time deploy (~2 min)

1. [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
2. `npx wrangler login`
3. Deploy:

```powershell
cd docs/oauth-proxy
npx wrangler deploy
```

4. Copy the worker URL (e.g. `https://reservation-oauth-proxy.yourname.workers.dev`)
5. Set GitHub repo variable **`OAUTH_PROXY_URL`** (no trailing slash)
6. Redeploy Pages (push to `main` or run **Deploy GitHub Pages** workflow)

## OAuth App

Create a GitHub OAuth App at [github.com/settings/developers](https://github.com/settings/developers):

- Enable **Device Flow**
- Callback URL: `https://goldmandrew.github.io/reservation-bot/oauth/callback.html`
- Set repo variable **`OAUTH_CLIENT_ID`** to the Client ID

## Repo variables

| Variable | Example |
|----------|---------|
| `OAUTH_CLIENT_ID` | `Ov23li...` |
| `OAUTH_PROXY_URL` | `https://reservation-oauth-proxy.yourname.workers.dev` |

Optional secret **`SNIPE_DISPATCH_TOKEN`** — if set, Pages must send matching token in dispatch payload (extra validation).
