---
name: startgg-pattern
description: Use when adding, modifying, or debugging Start.gg API integrations in SmashNotes (OAuth, GraphQL queries, tournament/player/set data, rate limiting). Covers the existing auth flow, HTTP clients, server-side proxy endpoints, and React hooks so new code matches existing conventions.
---

# Start.gg Integration Pattern Guide

This skill documents the **existing** Start.gg integration patterns in SmashNotes. When you're adding a new feature that touches Start.gg, consult the appropriate reference below before writing code so the new code matches established conventions.

## Quick Decision Tree

| What you're doing | Where to look / what to use |
|---|---|
| Need authenticated user data (the logged-in player's sets, tournaments, etc.) | `useStartGGAuth()` hook + `startggGraphQL(query, vars, accessToken)` from `src/lib/startggApi.js` |
| Need public data (tournament search, any player profile, character stats) | `startggApi.request(query, vars)` singleton from `src/lib/startgg.js` (uses PAT) |
| Want both — try OAuth first, fall back to PAT | `makeAuthenticatedRequest(query, vars)` from `src/utils/startggData.js` |
| Adding a new GraphQL query | Put it in `src/utils/startggData.js` as an exported function |
| Adding a new React-level concern (state, loading, pagination) | Add a new `useStartGG*` hook in `src/hooks/useStartGG.js` |
| OAuth login/refresh issue | Start in `src/lib/startggAuth.js`, then check `server/server.js` proxy endpoints |

## The Two-Client Rule

There are **two** GraphQL clients in this codebase. They are not interchangeable. Picking the wrong one will either fail or expose private data inappropriately:

- **`startggApi.request()` (PAT-based)** — uses the personal access token from `EXPO_PUBLIC_START_GG_API_TOKEN`. Works for any **public** query (tournaments, players by ID, public sets). Cannot fetch the currently-logged-in user's own data.
- **`startggGraphQL()` (OAuth-based)** — requires an OAuth access token, which the user gets by logging in. Use this for queries that touch `currentUser`, the user's registered tournaments, or anything personalized.

If your new feature needs the logged-in user's perspective, use the OAuth client. Otherwise use the PAT client.

## Critical Gotchas

These are the things that have actually bitten this codebase. One-liners here; full detail in the references.

- **Rate limit: 80 requests per 60 seconds.** No retry, no backoff, no queue is currently implemented. If you fan out queries, add throttling. See `references/rate-limiting.md`.
- **`perPage: 20` is the ceiling for `sets` queries.** Higher values blow Start.gg's per-query complexity limit. Comment in `src/lib/startggApi.js:99` confirms this.
- **Three OAuth client IDs, three client secrets, one bug magnet.** Desktop=442, mobile=450, production=455. Each has its own `START_GG_*_CLIENT_SECRET`. The Express server picks the right secret based on the incoming `client_id`. See `references/env-vars.md` and `references/server-endpoints.md`.
- **PKCE code verifier is stored in AsyncStorage** (`startgg_code_verifier`) because expo-auth-session's full-page redirect on web wipes React state. Don't try to keep it in memory only. See `references/auth-flow.md`.
- **Native OAuth uses a 2-minute in-memory token cache on the Express server.** The mobile app polls `GET /auth/native/token` every 5 seconds for up to 60 seconds after the browser callback. See `references/server-endpoints.md`.
- **Token auto-refresh has a 5-minute pre-expiry buffer.** `getAccessToken()` refreshes if the token expires within 5 minutes. Don't try to manage expiry yourself.
- **Singles-only filter is client-side.** `filterSinglesOnly()` in `src/lib/startggApi.js` excludes doubles/crews/non-Ultimate by event name. Apply it to set-listing queries.

## When NOT to Use This Skill

- User-facing setup instructions (how to create a Start.gg token, where to put env vars) live in `README.md` already. Don't duplicate them here.
- Generic GraphQL questions unrelated to Start.gg.
- Anything outside the Start.gg integration (Supabase, Claude API, Ollama — separate concerns).

## References — Open These

Open whichever reference matches the question. They're separated so you only load what you need.

| Open this | When you're working on |
|---|---|
| `references/auth-flow.md` | OAuth flow, PKCE, token refresh, AsyncStorage keys, the native polling loop, platform detection (desktop / LAN / native / production) |
| `references/http-client.md` | Deciding which GraphQL client to use, headers, error handling, response shape (`data.data` unwrap) |
| `references/queries.md` | Cataloging existing queries, choosing `perPage` values, adding a new query, `VIDEOGAME_IDS` constants, pagination patterns |
| `references/rate-limiting.md` | Start.gg's rate limit, query complexity, what the code does on 429, polling intervals, recommended patterns for new bulk-fetch features |
| `references/server-endpoints.md` | Express dev server routes, Vercel serverless routes, OAuth exchange flow, native callback mechanics, why the proxy exists |
| `references/hooks.md` | The 7 `useStartGG*` hooks, what each owns, when to use one vs writing a custom fetch in a component |
| `references/env-vars.md` | The 7 Start.gg env vars, where each is set, where each is consumed, what breaks when one is missing |

## Important: This Skill Describes Existing Code

The point of this skill is to help match existing conventions. If you find yourself wanting to invent a third HTTP client, a fourth client ID, or a parallel auth flow, **stop and ask the user** — there's probably a reason the current shape exists, and adding a parallel path tends to create silent inconsistencies.
