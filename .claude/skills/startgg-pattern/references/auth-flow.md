# Start.gg OAuth Flow

Everything related to logging the user in, persisting tokens, refreshing them, and detecting the platform. Source of truth: `src/lib/startggAuth.js`.

## The 4 Platform-Detection Cases (constructor, `src/lib/startggAuth.js:15-67`)

The `StartGGAuth` constructor inspects the platform on instantiation and picks a client ID + redirect URI accordingly. All four cases hit the same Start.gg endpoints; they differ only in which OAuth client they identify as.

| Case | Detection | `clientId` env var | Default | Redirect URI |
|---|---|---|---|---|
| **Native (iOS/Android via Expo)** | `Platform.OS !== 'web'` | `EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID` | `'450'` | `http://{lanIp}:3001/auth/native/callback` |
| **Desktop web (localhost)** | hostname is `localhost`/`127.0.0.1`/empty | `EXPO_PUBLIC_START_GG_CLIENT_ID` | `'442'` | `http://localhost:8081/auth/callback` |
| **Mobile web (LAN IP)** | hostname matches `\d+\.\d+\.\d+\.\d+` | `EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID` | `'450'` | `http://{hostname}:8081/auth/callback` |
| **Production (deployed)** | anything else (e.g. vercel.app) | `EXPO_PUBLIC_START_GG_PROD_CLIENT_ID` | `'455'` | `${window.location.origin}/auth/callback` |

The native case grabs the LAN IP via `Constants.expoConfig?.hostUri.split(':')[0]` and falls back to `192.168.1.55` if Expo's debugger host isn't available.

## Endpoints (top of `src/lib/startggAuth.js`)

```
START_GG_AUTH_ENDPOINT    = 'https://start.gg/oauth/authorize'
START_GG_TOKEN_ENDPOINT   = 'https://api.start.gg/oauth/access_token'
START_GG_REFRESH_ENDPOINT = 'https://api.start.gg/oauth/refresh'
```

Scopes requested: `['user.identity', 'user.email']`.

## PKCE

`expo-auth-session`'s `useAuthRequest` generates a `codeVerifier` automatically. The verifier is stored in **two places**:

1. `authService._lastCodeVerifier` — in-memory on the instance (lost on web full-page redirect)
2. `AsyncStorage` key `startgg_code_verifier` — persists across reloads

Both are set in the `useEffect` at `src/lib/startggAuth.js:264-269` whenever the request changes.

`exchangeCodeForToken` retrieves the verifier in this priority order:

```js
let codeVerifier = this._lastCodeVerifier || null;
if (!codeVerifier) {
  codeVerifier = await AsyncStorage.getItem('startgg_code_verifier');
}
```

After a successful exchange, `startgg_code_verifier` is removed.

## AsyncStorage Keys (the canonical list)

| Key | What it holds | Set by | Cleared by |
|---|---|---|---|
| `startgg_access_token` | OAuth access token | `exchangeCodeForToken`, `refreshAccessToken`, native polling | `logout()` |
| `startgg_refresh_token` | OAuth refresh token | same | `logout()` |
| `startgg_token_expires` | `Date.now() + (expires_in * 1000)` as a string | same | `logout()` |
| `startgg_user_info` | JSON of `currentUser { id, slug, email, name, discriminator, player { id, gamerTag } }` | `fetchUserInfo()` in the hook | `logout()` |
| `startgg_code_verifier` | PKCE verifier (temporary) | code-verifier `useEffect` | first successful `exchangeCodeForToken` |

If you're debugging "why doesn't my user info show up after login," the first thing to inspect is `startgg_user_info`. If it's missing, `fetchUserInfo` (lines 340-383) failed silently.

## The Six Methods of `StartGGAuth`

| Method | Line range | What it does |
|---|---|---|
| `getAuthRequestConfig()` | 70-77 | Returns `{ clientId, scopes, redirectUri, responseType: 'code' }` for `useAuthRequest` |
| `exchangeCodeForToken(code)` | 80-148 | Tries backend proxy first (`/api/startgg/exchange` or `/api/startgg-exchange` depending on deploy), falls back to direct Start.gg call. Stores tokens. |
| `refreshAccessToken()` | 151-190 | POSTs to refresh endpoint with `grant_type: 'refresh_token'`. Same scopes as original. |
| `getAccessToken()` | 193-219 | Reads from AsyncStorage. If token expires within 5 minutes (`Date.now() > (expiresAt - 300000)`), auto-calls `refreshAccessToken`. On refresh failure: calls `logout()` and returns `null`. |
| `logout()` | 222-231 | Removes all four `startgg_*` AsyncStorage keys. |
| `isAuthenticated()` | 234-237 | Convenience: returns `!!(await getAccessToken())`. |

## The Backend-Proxy-First Pattern (`exchangeCodeForToken`, lines 88-114)

The exchange endpoint URL is computed on every call:

```js
const backendHost = window?.location?.hostname || 'localhost';
const isDeployed = backendHost
  && backendHost !== 'localhost'
  && backendHost !== '127.0.0.1'
  && !/^\d+\.\d+\.\d+\.\d+$/.test(backendHost);
const exchangeUrl = isDeployed
  ? `${window.location.origin}/api/startgg-exchange`
  : `http://${backendHost}:3001/api/startgg/exchange`;
```

If the backend exchange fails for any reason (no proxy running, network error, server-side error), the code falls back to calling Start.gg directly. **This fallback only works if `this.clientSecret` is set on the instance, which it never is in the current code** — so the direct fallback will always fail with a missing-client-secret error from Start.gg. The fallback path exists more as a defense-in-depth log than a real recovery mechanism. The intended path is the proxy.

## The Native Polling Loop (`useStartGGAuth.login`, lines 385-434)

Native platforms can't use `expo-auth-session`'s redirect flow because they don't have a single-page-app URL. Instead:

1. `WebBrowser.openBrowserAsync(authUrl)` opens the system browser to Start.gg.
2. User grants → browser redirects to `http://{lanIp}:3001/auth/native/callback?code=...`.
3. The Express server exchanges the code, then stores the token in an in-memory variable `pendingNativeToken` with a 2-minute TTL (`server/server.js:62-104`).
4. The Express server responds with an HTML success page.
5. Back in the React Native app, after `openBrowserAsync` resolves (which happens when the user dismisses the browser), the login function polls `http://{serverHost}:3001/auth/native/token` every **5 seconds** for **up to 60 seconds** (12 attempts).
6. The server returns the token on the first poll after success and clears it from memory (one-time use).
7. On success: write to AsyncStorage, call `fetchUserInfo`, flip auth state.

If the user takes longer than 60 seconds in the browser, the poll times out and login fails silently (only a `console.warn`). Re-login required.

## The Web Redirect Path (`useStartGGAuth` mount effect, lines 271-289)

`expo-auth-session` does a full-page redirect on web. When the page reloads at `/auth/callback?code=...`, the React state from `useAuthRequest` is gone. The mount `useEffect` handles this manually:

```js
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
if (code) {
  window.history.replaceState({}, '', '/');  // clean URL
  handleAuthSuccess(code);
  return;  // skip normal checkAuthStatus
}
```

If you change the redirect path, also change this URL detection.

## Function-to-Location Cheat Sheet

| Need to find... | File:Line |
|---|---|
| Platform detection (native/desktop/LAN/prod) | `src/lib/startggAuth.js:15-67` |
| OAuth request config | `:70-77` |
| Backend-proxy-first exchange logic | `:88-130` |
| Token storage after exchange | `:132-140` |
| 5-min refresh buffer | `:202-211` |
| `logout()` key clearing | `:222-231` |
| `useStartGGAuth` hook body | `:241-458` |
| Web URL `?code=` rescue | `:271-289` |
| Native polling loop | `:385-434` |
| `currentUser` query | `:340-383` |

## Common Pitfalls

- **Don't try to read tokens directly from AsyncStorage in your component.** Use `useStartGGAuth()` so the 5-minute refresh logic stays in one place.
- **Don't forget the LAN IP fallback** — the native default `'192.168.1.55'` is hard-coded and probably wrong for any new dev machine. If native login fails, log `authService.lanIp` first.
- **Don't change the redirect path without updating the URL detection logic.** Both places need to agree.
- **Don't try to pass `accessToken` into the PAT client (`startggApi.request`).** That client doesn't accept it; it always uses the env var. Use `startggGraphQL` for OAuth queries.
