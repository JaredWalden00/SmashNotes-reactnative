# Start.gg HTTP Clients

There are two GraphQL clients. They both hit `https://api.start.gg/gql/alpha` but use different authentication, have different ergonomics, and serve different use cases. Don't confuse them.

## Client A — `startggApi.request()` (PAT-based singleton)

**File:** `src/lib/startgg.js`

**Auth:** Personal access token from `EXPO_PUBLIC_START_GG_API_TOKEN` (set at import time, read from `.env`).

**Signature:**
```js
import { startggApi } from "../lib/startgg";

const data = await startggApi.request(query, variables = {}, operationName = null);
```

**Headers it sends:**
```
Content-Type: application/json
Authorization: Bearer {EXPO_PUBLIC_START_GG_API_TOKEN}
User-Agent: SmashNotes-ReactNative/1.0.0   ← web only (Platform.select)
```

**Return value:** The `data.data` field of the GraphQL response (already unwrapped — you don't see the outer `data` envelope).

**Error mapping:**

| HTTP status / condition | Thrown error message |
|---|---|
| Token not configured | `"Start.gg API token not configured"` |
| 401 | `"Invalid Start.gg API token"` |
| 429 | `"Rate limit exceeded. Please try again later."` |
| Other non-2xx | `"HTTP {status}: {statusText}"` |
| GraphQL `errors[]` returned | `"GraphQL Error: {messages joined with ', '}"` |

**Use cases:** tournament search, public player profiles, character stats from public sets, anything where you don't need to be "the logged-in user."

**Health check:** `startggApi.healthCheck()` runs a trivial `currentUser { id }` query and returns `{ status, authenticated, data | error }`. Used by `useStartGGConnection`.

## Client B — `startggGraphQL()` (OAuth-based function)

**File:** `src/lib/startggApi.js`

**Auth:** OAuth access token passed in explicitly per call. Must come from `useStartGGAuth().accessToken` or `authService.getAccessToken()`.

**Signature:**
```js
import { startggGraphQL } from "../lib/startggApi";

const data = await startggGraphQL(query, variables, accessToken);
```

**Headers it sends:**
```
Content-Type: application/json
Authorization: Bearer {accessToken}
```

No User-Agent. No platform-specific headers.

**Return value:** The `data.data` field (same unwrap as Client A).

**Error handling:**

| Condition | Thrown error |
|---|---|
| Response body not JSON | `"Failed to parse response: {raw text}"` |
| Non-2xx | `"HTTP {status}: {first error message or raw text}"` |
| GraphQL `errors[]` returned | First error message verbatim |

**Use cases:** anything personalized — current user, user's registered tournaments, OAuth-scoped fields. Also used for "fetch this player's sets" because the OAuth token unlocks higher rate limits and lets the user see their own private events.

## Client C (kind of) — `makeAuthenticatedRequest()` Hybrid

**File:** `src/utils/startggData.js`

This isn't really a third client, more like a router:

```js
async function makeAuthenticatedRequest(query, variables) {
  const oauthToken = await getOAuthToken();
  if (oauthToken) {
    return startggGraphQL(query, variables, oauthToken);
  }
  return startggApi.request(query, variables);
}
```

**Use this when:** the same query could work via either auth method and you want the OAuth version (with its broader/personalized access) but don't want to fail if the user isn't logged in. `getUserRegisteredTournaments` is an exception — that one **requires** OAuth because it returns the logged-in user's tournaments.

## Decision Table

| You need... | Use |
|---|---|
| The logged-in user's identity, registered tournaments, or anything tied to "me" | **Client B** (`startggGraphQL`) |
| Anyone's public sets/profile, tournament listings, character stats | **Client A** (`startggApi.request`) — simpler |
| The above but want OAuth perks if logged in, PAT otherwise | **Client C** (`makeAuthenticatedRequest`) |
| One-off direct fetch you control entirely | Just `fetch('https://api.start.gg/gql/alpha', ...)` — but match Client B's auth header pattern, and you'll need to do your own error handling |

## Response Shape Reminder

Start.gg returns this:

```json
{
  "data": { "player": { ... } },
  "errors": [ ... ]   // only on failure
}
```

Both clients unwrap `data.data` for you. So:

```js
const result = await startggGraphQL(query, vars, token);
result.player.sets.nodes  // ← already inside `data`
```

If you accidentally write `result.data.player`, you'll get `undefined` — that's how you know you forgot which level you're at.

## Pagination Pattern

Start.gg's pagination is typically `perPage` + `page`, with no cursor. The standard idiom in this codebase:

```js
const rawSets = data?.player?.sets?.nodes || [];
const sets = filterSinglesOnly(rawSets);
return {
  sets,
  hasMore: rawSets.length === perPage,   // ← uses RAW length, before filtering
};
```

Important: `hasMore` is computed from the **raw** response length, not the filtered length. If you filter to singles and get 0 results out of 20 raw, you still have more pages to fetch.

## Where Each Client Is Currently Used

Reading the codebase to see what's calling what, before adding a new pattern:

| Caller | Client |
|---|---|
| `fetchRecentSets`, `fetchSetsPage`, `fetchRecentOpponents`, `fetchMostPlayedAgainst` (`src/lib/startggApi.js`) | Client B |
| `searchTournaments`, `getTournament`, `getTournamentEvents`, `searchPlayers`, `getEventSets`, `getPlayerSets` (`src/utils/startggData.js`) | Mixed — some via Client A, some via Client C |
| `getUserRegisteredTournaments` (`src/utils/startggData.js`) | Client C (requires OAuth, fails without) |
| `fetchUserInfo` (inline in `useStartGGAuth`, `src/lib/startggAuth.js:340-383`) | Direct `fetch` — bypasses both clients |
| `PlayerOpponentsTab` recent-sets fetch | Direct `fetch` via OAuth token |

The "direct fetch" cases above are existing tech debt. **New code should prefer Client A, B, or C** rather than adding a fourth one-off pattern.
