---
name: oauth-platform-detection
description: Use when adding a new OAuth provider (Discord, Twitch, Google, etc.) or modifying the existing Start.gg OAuth flow. Documents the four-case platform detection pattern (desktop / mobile LAN / native Expo / production) and the proxy-server architecture for keeping client secrets off the device.
---

# OAuth Platform-Detection Pattern

This codebase has a well-tested OAuth pattern for a React Native (Expo) + web app that runs in **four different environments**:

1. **Desktop web** (localhost)
2. **Mobile web via LAN IP** (your phone hitting your computer's IP)
3. **Native iOS/Android** (Expo Go or built app)
4. **Production deployed web** (Vercel)

Each environment needs a different OAuth client ID + redirect URI. The reference implementation is `src/lib/startggAuth.js` — copy this pattern for any new OAuth provider.

## When to Use This Skill

- Adding Discord, Twitch, Google, GitHub, or any new OAuth provider to the app
- Debugging "OAuth works on desktop but not mobile" issues
- Adding production deployment after dev-only OAuth setup

## When NOT to Use This Skill

- Modifying Start.gg-specific behavior (use `startgg-pattern` skill instead)
- Adding API-key-based integrations (no OAuth needed)
- Adding Supabase Auth flows (those use Supabase's hooks, different pattern)

## The Four Detection Cases

```js
// In the OAuth class constructor:
const isNative = Platform.OS !== 'web';

if (isNative) {
  // CASE 1: Native iOS/Android
  const debuggerHost = Constants.expoConfig?.hostUri || '';
  this.lanIp = debuggerHost.split(':')[0] || '192.168.1.55';  // fallback
  this.clientId = process.env.EXPO_PUBLIC_FOO_MOBILE_CLIENT_ID || 'default';
  this.redirectUri = `http://${this.lanIp}:3001/auth/native/callback`;
  this.isNative = true;

} else {
  // Web — three sub-cases based on hostname
  const hostname = window?.location?.hostname || null;
  const isLocalhost = !hostname || hostname === 'localhost' || hostname === '127.0.0.1';
  const isLAN = hostname && /^\d+\.\d+\.\d+\.\d+$/.test(hostname);

  if (isLocalhost) {
    // CASE 2: Desktop web (developer's machine)
    this.clientId = process.env.EXPO_PUBLIC_FOO_CLIENT_ID || 'default';
    this.redirectUri = 'http://localhost:8081/auth/callback';

  } else if (isLAN) {
    // CASE 3: Mobile web via LAN
    this.clientId = process.env.EXPO_PUBLIC_FOO_MOBILE_CLIENT_ID || 'default';
    this.redirectUri = `http://${hostname}:8081/auth/callback`;

  } else {
    // CASE 4: Production (deployed)
    this.clientId = process.env.EXPO_PUBLIC_FOO_PROD_CLIENT_ID || 'default';
    this.redirectUri = `${window.location.origin}/auth/callback`;
  }
}
```

## Why Four OAuth Apps

Most OAuth providers (including Start.gg) bind an OAuth app to a **specific redirect URI**. You can usually configure multiple, but it's cleaner to use separate apps for each environment because:

- Localhost OAuth needs `http://localhost:8081/auth/callback` — fine for dev only
- Mobile-LAN needs `http://192.168.1.x:8081/auth/callback` — varies per developer
- Native uses `http://{lanIp}:3001/auth/native/callback` — Express server hosts the callback
- Production uses `https://your-app.vercel.app/auth/callback` — HTTPS, fixed domain

If your provider supports wildcard redirect URIs, you can collapse this to 1-2 apps. Most don't.

## The Server Proxy

The OAuth `client_secret` cannot ship in the app bundle. So the app POSTs the authorization code to **our** server, which:

1. Receives `{ code, redirect_uri, client_id, code_verifier }`
2. Looks up the matching `client_secret` from env
3. POSTs to the OAuth provider's token endpoint
4. Returns the token response to the app

Two implementations:

- **Express dev:** `server/server.js` — `/api/oauth-name/exchange` route
- **Vercel prod:** `api/oauth-name-exchange.js` — same logic, serverless

### Pattern for the Exchange Endpoint

```js
// server/server.js
app.post('/api/foo/exchange', async (req, res) => {
  const { code, redirect_uri, code_verifier, client_id } = req.body;

  // Decide which secret to use based on incoming client_id
  const mobileClientId = process.env.EXPO_PUBLIC_FOO_MOBILE_CLIENT_ID;
  const isMobile = client_id === mobileClientId
                || (redirect_uri && !redirect_uri.includes('localhost'));

  const secret = isMobile
    ? process.env.FOO_MOBILE_CLIENT_SECRET
    : process.env.FOO_CLIENT_SECRET;

  const response = await fetch('https://provider.example/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id, client_secret: secret,
      code, redirect_uri, code_verifier,
    }),
  });

  res.json(await response.json());
});
```

## PKCE

Always use PKCE for OAuth. `expo-auth-session`'s `useAuthRequest` handles it automatically. The `code_verifier` it generates must be stored across page reloads on web:

```js
useEffect(() => {
  if (request?.codeVerifier) {
    authService._lastCodeVerifier = request.codeVerifier;  // memory
    AsyncStorage.setItem('foo_code_verifier', request.codeVerifier);  // disk fallback
  }
}, [request]);
```

On full-page redirect, the in-memory copy is gone, so `exchangeCodeForToken` reads from AsyncStorage:

```js
let codeVerifier = this._lastCodeVerifier
                || await AsyncStorage.getItem('foo_code_verifier');
```

Clean up after successful exchange.

## The Native Callback Polling Loop

Native apps can't use redirect-based OAuth (no URL bar). Instead:

1. App calls `WebBrowser.openBrowserAsync(authUrl)` — system browser opens
2. User grants → browser redirects to `http://{lanIp}:3001/auth/native/callback?code=...`
3. Express server exchanges the code, **stashes the token in memory** with a 2-min TTL
4. Express returns an HTML "done" page
5. Back in the app, `openBrowserAsync` resolves
6. App **polls** `GET /auth/native/token` every 5 seconds for up to 60 seconds
7. Server returns the token on first successful poll, **clears it from memory** (one-time use)

This is in `useStartGGAuth.login()` lines 385-434. Copy the structure for a new provider.

Server side:

```js
let pendingNativeToken = null;
let pendingNativeTokenExpiry = 0;

app.get('/auth/foo/native/callback', async (req, res) => {
  const { code } = req.query;
  // ... exchange ...
  if (tokenData.access_token) {
    pendingNativeToken = tokenData;
    pendingNativeTokenExpiry = Date.now() + 120000;  // 2 min
    res.send('<html><body>Connected! You can close this window.</body></html>');
  }
});

app.get('/auth/foo/native/token', (req, res) => {
  if (pendingNativeToken && Date.now() < pendingNativeTokenExpiry) {
    const token = pendingNativeToken;
    pendingNativeToken = null;  // one-time use
    res.json(token);
  } else {
    res.json({ pending: true });
  }
});
```

## Token Storage

After successful exchange, store in AsyncStorage:

```js
await AsyncStorage.setItem('foo_access_token', data.access_token);
await AsyncStorage.setItem('foo_refresh_token', data.refresh_token || '');
await AsyncStorage.setItem('foo_token_expires', String(Date.now() + data.expires_in * 1000));
await AsyncStorage.setItem('foo_user_info', JSON.stringify(userInfo));
```

Use a per-provider prefix (`foo_`) so multiple providers don't collide.

## Token Refresh with 5-Minute Buffer

```js
async getAccessToken() {
  const token = await AsyncStorage.getItem('foo_access_token');
  const expiresAt = await AsyncStorage.getItem('foo_token_expires');

  if (!token) return null;

  // Refresh if expiring within 5 minutes
  if (expiresAt && Date.now() > (parseInt(expiresAt) - 300000)) {
    try {
      return await this.refreshAccessToken();
    } catch {
      await this.logout();
      return null;
    }
  }

  return token;
}
```

5-minute buffer prevents using a token that'll expire mid-request.

## Env Var Naming Convention

For provider `foo`:

| Var | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_FOO_API_TOKEN` | `.env` | PAT for public queries (if provider supports it) |
| `EXPO_PUBLIC_FOO_CLIENT_ID` | `.env` | Desktop OAuth |
| `EXPO_PUBLIC_FOO_MOBILE_CLIENT_ID` | `.env` | Mobile/LAN OAuth |
| `EXPO_PUBLIC_FOO_PROD_CLIENT_ID` | `.env` (prod) | Production OAuth |
| `FOO_CLIENT_SECRET` | `server/.env`, Vercel | Desktop secret |
| `FOO_MOBILE_CLIENT_SECRET` | `server/.env`, Vercel | Mobile secret |
| `FOO_PROD_CLIENT_SECRET` | Vercel only | Production secret |

`EXPO_PUBLIC_*` ships to the client. Anything without that prefix is server-only.

## Common Failure Modes

| Symptom | Likely cause |
|---|---|
| Login fails with `invalid_client` | Client ID + redirect URI don't match what's configured in the OAuth admin UI |
| Login fails with `invalid_grant` | code_verifier mismatch (PKCE bug). Check AsyncStorage write timing |
| Web works, native doesn't | Native uses different client ID + needs server proxy running on the LAN IP |
| Native times out after 60s | Browser redirected somewhere unexpected. Check `lanIp` resolution (`Constants.expoConfig.hostUri`) |
| First load works, refresh breaks | Refresh token not being saved, or 5-min buffer logic off-by-one |
| Production OAuth fails after deploy | Forgot to set the secret in Vercel env vars |

## Checklist for Adding a New OAuth Provider

1. Register OAuth app(s) with the provider — get client IDs + secrets for each redirect URI you need
2. Add env vars to `.env` and `server/.env` following the naming convention
3. Create `src/lib/fooAuth.js` (copy `startggAuth.js` as template)
4. Adjust:
   - Endpoint URLs (`AUTH_ENDPOINT`, `TOKEN_ENDPOINT`, `REFRESH_ENDPOINT`)
   - Scopes
   - AsyncStorage prefix (`foo_*`)
   - User-info query (provider-specific GraphQL or REST call)
5. Add exchange endpoint to `server/server.js` (copy `/api/startgg/exchange`)
6. Add native callback + polling endpoint if needed (copy `/auth/native/*`)
7. Add Vercel function `api/foo-exchange.js`
8. Optionally: add `useFooAuth()` hook (the bottom of `fooAuth.js`)
9. Wire into UI: settings screen with login/logout buttons, status indicator

Don't skip steps 5-7 if your provider has a `client_secret`. Without the proxy, the secret would leak into the bundle.
