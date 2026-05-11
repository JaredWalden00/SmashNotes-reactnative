# Start.gg Environment Variables

Seven Start.gg-related env vars. Three are "public" (shipped in the bundle, prefixed `EXPO_PUBLIC_*`) and four are secrets that must only live on the server side.

## The Table

| Var | Type | Purpose | Where it lives | Where it's consumed | What breaks if missing |
|---|---|---|---|---|---|
| `EXPO_PUBLIC_START_GG_API_TOKEN` | Public PAT | Bearer token for the PAT-based singleton client | `.env` | `src/lib/startgg.js:4` | All Client A queries fail with `"Start.gg API token not configured"` |
| `EXPO_PUBLIC_START_GG_CLIENT_ID` | Public OAuth client ID | Desktop/localhost OAuth client (442) | `.env`, `server/.env` | `src/lib/startggAuth.js:47`, `server/server.js:31`, `api/startgg-exchange.js` | Desktop web login uses fallback `'442'`. If 442 is wrong for your Start.gg app, login fails with `invalid_client` |
| `EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID` | Public OAuth client ID | Native + LAN mobile web OAuth (450) | `.env`, `server/.env` | `src/lib/startggAuth.js:26,51`, `server/server.js:27,71`, `api/startgg-exchange.js` | Native/mobile login uses fallback `'450'`. Wrong value → `invalid_client` |
| `EXPO_PUBLIC_START_GG_PROD_CLIENT_ID` | Public OAuth client ID | Production OAuth (455) | Vercel env (and locally for completeness) | `src/lib/startggAuth.js:55`, `api/startgg-exchange.js` | Deployed app login uses fallback `'455'`. Wrong value → `invalid_client` |
| `START_GG_CLIENT_SECRET` | **Secret** | Desktop OAuth client secret | `server/.env`, Vercel env | `server/server.js:34`, `api/startgg-exchange.js` | OAuth code exchange fails on desktop with `invalid_client` |
| `START_GG_MOBILE_CLIENT_SECRET` | **Secret** | Native + mobile OAuth client secret | `server/.env`, Vercel env | `server/server.js:33,72`, `api/startgg-exchange.js` | OAuth code exchange fails on native/mobile-LAN with `invalid_client` |
| `START_GG_PROD_CLIENT_SECRET` | **Secret** | Production OAuth client secret | Vercel env only (not in local `.env`) | `api/startgg-exchange.js` | Production OAuth fails. Doesn't affect local dev. |

## Public vs Secret

Everything prefixed with `EXPO_PUBLIC_` gets inlined into the JavaScript bundle at build time. Anything **without** that prefix is server-only and must never be read in a file that ships to the client.

Rule of thumb:

- If a `process.env.XYZ` reference is in a file under `src/` → it must be `EXPO_PUBLIC_*` or it'll be `undefined` in the bundle.
- If a `process.env.XYZ` reference is in `server/` or `api/` → it should NOT be public (the secret version).

## The Client ID / Secret Pairing

| Client ID env | Client Secret env | Which login flow |
|---|---|---|
| `EXPO_PUBLIC_START_GG_CLIENT_ID` (442) | `START_GG_CLIENT_SECRET` | Desktop browser → localhost |
| `EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID` (450) | `START_GG_MOBILE_CLIENT_SECRET` | Native iOS/Android, OR mobile browser on LAN IP |
| `EXPO_PUBLIC_START_GG_PROD_CLIENT_ID` (455) | `START_GG_PROD_CLIENT_SECRET` | Vercel-deployed production |

Each Start.gg OAuth application has a different ID + secret pair because the redirect URI is different (and Start.gg's OAuth admin won't let you mix redirect URIs across one client).

## Where to Set Them

### Local dev

Two `.env` files:

- **Project root `.env`** — read by Expo at build time. Contains `EXPO_PUBLIC_*` vars (technically the secrets too if you want, but they're only read by the dev server).
- **`server/.env`** — read by `server/server.js` at startup via `require('dotenv').config({ override: true })` at `server/server.js:4`. Contains both public vars (because the server picks client IDs based on incoming requests) AND the secrets.

In practice, the two files end up with the same contents during dev because:
- `EXPO_PUBLIC_*` vars need to be in `.env` for the bundle
- The server-only `START_GG_*_CLIENT_SECRET` vars need to be in `server/.env`
- It's easier to have both vars in both files than to track which lives where

### Production (Vercel)

Set every var in the Vercel dashboard under Project → Settings → Environment Variables. Public vars need the `EXPO_PUBLIC_` prefix preserved.

**Critical:** Both `.env` files are gitignored (see `.gitignore`). If they ever get committed, the API tokens auto-revoke (GitHub secret scanning notifies Anthropic/Start.gg). Don't commit them.

## What Each Env Var Defaults To

The code has hard-coded fallbacks when env vars are missing. This is a convenience for local dev (Start.gg's official sample client IDs work for local testing) but a footgun in production:

```js
this.clientId = process.env.EXPO_PUBLIC_START_GG_CLIENT_ID || '442';        // desktop
this.clientId = process.env.EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID || '450'; // mobile
this.clientId = process.env.EXPO_PUBLIC_START_GG_PROD_CLIENT_ID || '455';   // prod
```

If you deploy and forget to set `EXPO_PUBLIC_START_GG_PROD_CLIENT_ID`, the app will silently use 455 — which is your dev's prod client. That MIGHT actually work or it might point to the wrong redirect URI. There's no defensive check. Watch the console for the `OAuth Config (Web Deployed):` log line that prints the client ID being used (see `src/lib/startggAuth.js:59-66`).

## Other Env Vars Touched By Start.gg Code (For Completeness)

These aren't Start.gg-specific but show up in the same files:

| Var | Used by | Purpose |
|---|---|---|
| `PORT` | `server/server.js` | Dev server port (default 3001) |
| `ANTHROPIC_API_KEY` | `server/server.js` | Unrelated — for the Claude AI assistant |
| `OLLAMA_URL`, `OLLAMA_MODEL` | `server/server.js` | Unrelated — for Ollama fallback in the Ask AI feature |

## Quick Troubleshooting Map

| Symptom | First env var to check |
|---|---|
| All Start.gg queries fail with `"Invalid Start.gg API token"` | `EXPO_PUBLIC_START_GG_API_TOKEN` — likely expired or revoked |
| Login button does nothing on desktop | `EXPO_PUBLIC_START_GG_CLIENT_ID` and `START_GG_CLIENT_SECRET` in `server/.env` |
| Login fails on mobile only | `EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID` + matching secret |
| Login fails only after deploy | `EXPO_PUBLIC_START_GG_PROD_CLIENT_ID` + matching secret in Vercel env |
| Server crashes on startup | The dotenv `override: true` issue from earlier in the project — make sure `server/.env` doesn't have stale system-env vars overriding it |
| OAuth says `invalid_client` | The client ID + redirect URI combo doesn't match what's configured in start.gg's OAuth admin — fix the OAuth app config, not the code |
