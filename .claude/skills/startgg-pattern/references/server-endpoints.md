# Start.gg Server-Side Endpoints

The OAuth client secret cannot ship in the React Native bundle, so token exchange happens server-side. There are **two** server implementations:

- **Express dev server** at `server/server.js` (port 3001) — used during local development
- **Vercel serverless function** at `api/startgg-exchange.js` — used in production deploys

Both implement the same exchange logic. They diverge slightly because Vercel doesn't support stateful endpoints, so the native-callback flow is dev-only.

## Why a Proxy Exists at All

Start.gg's OAuth `access_token` endpoint requires both `client_id` and `client_secret` in the body. Shipping the secret to the client would be a credential leak. So:

1. The native/web app sends `{ code, redirect_uri, code_verifier, client_id }` to **our** server
2. Our server looks up the matching `client_secret` from env
3. Our server POSTs to Start.gg with the full payload
4. Our server returns the token response to the client

The client never sees the secret.

## Express Dev Server (`server/server.js`)

Port: `3001` (configurable via `process.env.PORT`).

### `POST /api/startgg/exchange` (lines 22-59)

**Purpose:** Web OAuth code-for-token exchange.

**Request body:**
```js
{ code, redirect_uri, code_verifier, client_id }
```

**Client ID → Secret selection (lines 26-35):**

```js
const mobileClientId = process.env.EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID;
const isMobile = client_id === mobileClientId
              || (redirect_uri && !redirect_uri.includes('localhost'));

const useClientId = isMobile
  ? (process.env.EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID || process.env.EXPO_PUBLIC_START_GG_CLIENT_ID)
  : process.env.EXPO_PUBLIC_START_GG_CLIENT_ID;

const useClientSecret = isMobile
  ? (process.env.START_GG_MOBILE_CLIENT_SECRET || process.env.START_GG_CLIENT_SECRET)
  : process.env.START_GG_CLIENT_SECRET;
```

Decision rule: if the incoming `client_id` matches the mobile env, OR the redirect URI is non-localhost, use mobile creds. Otherwise desktop creds. This is fine for local dev (only two cases) but doesn't handle production at all — that's what the Vercel function exists for.

**Response:** Whatever Start.gg returns from `https://api.start.gg/oauth/access_token`. Success shape:
```js
{ access_token, refresh_token, expires_in, token_type, scope }
```

### `GET /auth/native/callback` (lines 66-104)

**Purpose:** The redirect target for the **native** OAuth flow. The browser hits this directly after the user grants permission.

**Flow:**
1. Browser arrives with `?code=...`
2. Server pulls mobile client ID + secret from env
3. Server computes `redirect_uri` from the incoming `Host` header to match exactly what the browser used
4. Server exchanges with Start.gg
5. On success, stores token in `pendingNativeToken` in-memory (variable declared at line 63) with `pendingNativeTokenExpiry = Date.now() + 120000` (2 minutes)
6. Server returns an HTML success page that tells the user "You can close this window"

The 2-minute TTL exists because the React Native app polls every 5 seconds and gives up after 60 seconds. If the user wanders off and comes back later, the token is gone and they have to log in again.

### `GET /auth/native/token` (lines 107-115)

**Purpose:** Polled by the native app after the browser callback to retrieve the token.

**Behavior:**
- If `pendingNativeToken` is set and not expired: returns the token AND clears it (one-time use)
- Otherwise: returns `{ pending: true }`

**Why one-time use:** so leaving the dev server running doesn't accumulate tokens, and so two simultaneous logins can't accidentally share state.

### `GET /api/health` (lines 17-19)

Trivial health check. Returns `{ status: 'ok', timestamp }`. Used by `useStartGGConnection` (which actually calls Client A's `healthCheck()`, not this — they're independent).

## Vercel Serverless (`api/startgg-exchange.js`)

**Purpose:** Production-deployed OAuth exchange. Same shape as `/api/startgg/exchange` on Express.

Key differences from the Express version:

- **CORS headers** are set explicitly (the Express version uses the `cors` middleware globally)
- **3-way client mapping** instead of 2-way:
  - `442` → `START_GG_CLIENT_SECRET`
  - `450` → `START_GG_MOBILE_CLIENT_SECRET`
  - `455` → `START_GG_PROD_CLIENT_SECRET`
- **No native callback flow.** Mobile apps in production still hit the dev server during local mobile testing; the production native build would need additional infra (Universal Links / App Links) that isn't currently set up.

## The Client-Side Exchange Path

For context, here's how the client picks which exchange endpoint to call (`src/lib/startggAuth.js:88-114`):

```js
const backendHost = window?.location?.hostname || 'localhost';
const isDeployed = backendHost
  && backendHost !== 'localhost'
  && backendHost !== '127.0.0.1'
  && !/^\d+\.\d+\.\d+\.\d+$/.test(backendHost);

const exchangeUrl = isDeployed
  ? `${window.location.origin}/api/startgg-exchange`  // Vercel
  : `http://${backendHost}:3001/api/startgg/exchange`;  // Express dev
```

The Express path is also LAN-IP-aware (`backendHost` may be `192.168.1.x` if you're loading the web app from your phone), which is why it uses the hostname rather than hard-coding `localhost`.

## Env Vars These Endpoints Need

See `references/env-vars.md` for the full table, but for the server side specifically:

| Var | Used by | Required? |
|---|---|---|
| `EXPO_PUBLIC_START_GG_CLIENT_ID` | both | Yes |
| `EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID` | both | Yes (for native/LAN) |
| `EXPO_PUBLIC_START_GG_PROD_CLIENT_ID` | Vercel only | Yes in prod |
| `START_GG_CLIENT_SECRET` | both | Yes |
| `START_GG_MOBILE_CLIENT_SECRET` | both | Yes (for native) |
| `START_GG_PROD_CLIENT_SECRET` | Vercel only | Yes in prod |
| `PORT` | Express | No (default 3001) |

If you forget a secret in `server/.env`, the exchange endpoint will still respond but Start.gg will reject the request with an OAuth error like `invalid_client`. Check `server/.env` first when login fails.

## Things to Watch Out For

- **Don't add a new client ID without adding the matching secret to BOTH** `server/.env` AND Vercel env. Forgetting one half is a common failure.
- **The native callback HTML page** at `server/server.js:97` styles itself for the app's dark theme. If you change it, keep it minimal — the user is briefly seeing this in their system browser, not the app.
- **`pendingNativeToken` is a global module variable.** It's fine for single-developer use; if you ever ran multiple Express instances behind a load balancer, the polling would only work for the instance that handled the callback. (Not a concern today.)
- **Don't log token values.** The existing `console.log` calls log presence/absence and the first error message, never the actual token. Match this convention.
- **CORS is wide-open on dev** (`origin: true` in `server/server.js:11`). That's intentional for local dev across LAN. Don't carry that pattern into production.
