# Start.gg Rate Limiting

## The Two Limits

Start.gg enforces **two separate limits** on the GraphQL API. You can hit either one.

### 1. Request-rate limit: 80 requests / 60 seconds

This is the hard rate limit. If you exceed it, the server returns HTTP **429**.

### 2. Query complexity limit (per-request)

Each query has a "complexity score" that depends on what fields you request and how much pagination you ask for. Queries that exceed the limit are rejected with a GraphQL error like "Query exceeds complexity limit." The exact limit isn't published, but empirically:

- `player.sets(perPage: 20)` is fine
- `player.sets(perPage: 50)` will sometimes blow up depending on what nested fields you also request

That's why the comment at `src/lib/startggApi.js:99` reads:

> `perPage - results per page (max ~20 to stay under complexity limit)`

## What the Code Currently Does

### On 429

`Client A` (`startggApi.request`, `src/lib/startgg.js:59`) maps 429 to:

```js
throw new Error("Rate limit exceeded. Please try again later.");
```

`Client B` (`startggGraphQL`) doesn't special-case 429 — it just throws the generic `HTTP 429: ...` error.

**There is no retry. There is no backoff. There is no queue.** The throw bubbles up to the calling component, which generally shows a generic error toast and stops. The user has to manually trigger the action again.

### On complexity error

Start.gg returns 200 OK with `errors[]` in the body. Both clients throw `"GraphQL Error: {message}"` (Client A) or the first error message verbatim (Client B). Same deal — no retry.

## Current Usage Patterns (what the app actually does)

| Source | Behavior | Rate cost |
|---|---|---|
| `TournamentTab` event polling | `getEventSets` every 30 seconds while viewing an event | 2 req/min — safe |
| `fetchMostPlayedAgainst` | Sequential page loop, up to 15 pages (300 sets / 20 per) | 15 req in a few seconds — well under 80/60s, but spiky |
| `RecentOpponentsCard` on mount | One `RecentSets` query | 1 req — trivial |
| `StatsTab` "Load More" | One `SetsPage` query per click | User-paced, safe |
| `useStartGGTournaments` search | One `SearchTournaments` per keystroke if you wire it that way | **Be careful — debounce your input!** |

## Guidance for New Features

### Cheap (no extra throttling needed)

- Single user action → single query
- Polling at 30s or slower
- Pagination on user click (one page per click)

### Needs care

- Multiple queries fanned out concurrently → check if total ≤ 80 in 60s
- Search-as-you-type → **debounce** input (200-300ms typical) before firing the query
- Background sync that runs while the user is doing something else

### Definitely add throttling

- Bulk import or backfill (more than ~30 sequential queries)
- Any feature that fans out a query per row in a list of unknown size
- Cron-like background sync

The app currently has **no throttling middleware**. If you write a bulk feature, you'll need to add either:

1. A simple sleep between requests (`await new Promise(r => setTimeout(r, 800))` keeps you well under the limit)
2. A bottleneck library (`p-throttle`, `bottleneck`, etc.) — these aren't currently installed; weigh the dep against just inserting sleeps

## Detecting You're About to Hit the Limit

There's no header that tells you remaining quota in the responses (as of last check). The only signal is the 429 itself. So:

- Be conservative by design
- Cache in component state — don't re-fetch the same query on every re-render
- Don't fetch in a `useEffect` without proper dependency arrays

## What to Tell the User on 429

Both clients already throw a reasonable message. Components catch it via try/catch around the query call. If you're adding a new component, follow the existing convention — set `error` state to the thrown message and display it. Don't auto-retry silently; that just compounds the rate-limit problem.

## Known Gap (honest call-out)

This app has **no production-grade throttling**. It works for a single user doing typical interactions because each user's normal click rate stays well under 80/60s. It would break under any of the following:

- A power user with hundreds of registered tournaments who scrolls fast
- Multiple users behind the same API token (the PAT is per-app, shared by all users)
- A future feature that backfills data on app launch

If any of those become real concerns, see `references/queries.md` for the query catalog and start by:

1. Tagging queries that get fanned out
2. Adding a simple in-memory rate-limit bucket in `src/utils/startggData.js`
3. Wrapping `makeAuthenticatedRequest` to consult the bucket before firing

But don't pre-emptively add throttling — that's untested code we don't need yet. Add it the first time something actually hits the limit.
