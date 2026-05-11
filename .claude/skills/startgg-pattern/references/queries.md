# Start.gg GraphQL Query Catalog

Every named query the app currently sends, with its `perPage` choice, auth requirement, and location. Use this when:

- Adding a new query (pick a `perPage` that won't blow the complexity limit)
- Debugging "why is this query returning 0 results" (often a filter issue)
- Wondering "is there already a query for this?"

## Pagination Idioms

- **Default page size for set listings:** `20`. Bigger values blow Start.gg's per-query complexity limit. Hard-coded comment at `src/lib/startggApi.js:99`: *"max ~20 to stay under complexity limit"*.
- **Default page size for entrants:** `100` (in `getTournamentEvents`).
- **Default page size for event sets:** `50` (in `getEventSets`, with `sortType: 'RECENT'`).
- **`hasMore`** is calculated from RAW response length, not the filtered length: `hasMore: rawSets.length === perPage`.
- **Page numbers are 1-indexed.**

## VIDEOGAME_IDS Constants

In `src/utils/startggData.js`. Always pass `videogameId: 1386` to filter to Smash Ultimate when the query supports it.

```js
export const VIDEOGAME_IDS = {
  SMASH_ULTIMATE: 1386,    // ← default
  SMASH_MELEE: 1,
  SMASH_64: 4,
  SMASH_BRAWL: 5,
  SMASH_4: 3,
  TEKKEN_7: 23,
  STREET_FIGHTER_6: 43868,
  GUILTY_GEAR_STRIVE: 33945,
};
```

## Singles-Only Filter

`filterSinglesOnly(sets)` in `src/lib/startggApi.js:46-54` excludes by event-name pattern:

```js
/doubles|crew|squad|brawl|melee|64|smash\s*4|side\s*event|redemption/i
```

Apply this **after** fetching, before counting/displaying, on any query that returns mixed-format sets. The filter is conservative — it can over-include (an event named just "Bracket" without "Singles" won't be excluded) but rarely over-excludes.

## The Catalog

### `RecentSets` — `fetchRecentSets`, `fetchRecentOpponents`

- **File:** `src/lib/startggApi.js:56-92` and `:155-187`
- **Auth:** Client B (OAuth)
- **perPage:** 20, page 1
- **Variables:** `playerId: ID!`
- **Returns:** `player.gamerTag`, `player.sets.nodes[]` with `slots.entrant.participants` and `games.selections.character`
- **Why two callers:** `fetchRecentSets` returns the sets directly; `fetchRecentOpponents` aggregates them into a per-opponent map.

### `SetsPage` — `fetchSetsPage`

- **File:** `src/lib/startggApi.js:102-141`
- **Auth:** Client B
- **perPage:** parameterized (default 20). **Do not exceed 20.**
- **Variables:** `playerId: ID!, perPage: Int!, page: Int!`
- **Returns:** `{ sets, gamerTag, hasMore }`. Used by `StatsTab` for paginated loading.

### `MostPlayedAgainst` — `fetchMostPlayedAgainst`

- **File:** `src/lib/startggApi.js:273-366`
- **Auth:** Client B
- **perPage:** 20 (constant `PAGE_SIZE`), caps at `MAX_SETS = 300`
- **Returns:** Array of `{ name, sets }` sorted by frequency descending. Dedupes per set so one set = one count per character.

### `SearchTournaments` — `searchTournaments`

- **File:** `src/utils/startggData.js:70-123`
- **Auth:** Client A (PAT) via singleton, or Client C if `makeAuthenticatedRequest` is used
- **Variables:** `name: String, perPage: Int, page: Int`
- **Returns:** Tournament nodes with `events[]`.

### `GetTournament` — `getTournament`

- **File:** `src/utils/startggData.js:130-216`
- **Auth:** Client A / Client C
- **Variables:** `slug: String!`
- **Returns:** Full tournament including images, streams, events with participants. Heavyweight query — don't call on every render.

### `GetTournamentEvents` — `getTournamentEvents`

- **File:** `src/utils/startggData.js:224-276`
- **Auth:** Client A / Client C
- **Variables:** `slug: String!, videogameId: ID!` (default 1386 = Ultimate)
- **perPage for entrants:** **100** (highest in the codebase). Phases also included.

### `SearchPlayers` + `generalPlayerSearch` fallback — `searchPlayers`

- **File:** `src/utils/startggData.js:283-333`
- **Auth:** Client A / Client C
- **Variables:** `gamerTag: String!`
- **Fallback:** On error, falls through to a more permissive `generalPlayerSearch`. Both are in the same file.

### `GetEventSets` — `getEventSets`

- **File:** `src/utils/startggData.js:354-439`
- **Auth:** Client A / Client C
- **Variables:** `eventId: ID!, perPage: Int (default 50), page: Int (default 1), sortType: String (default 'RECENT')`
- **Returns:** Sets with `entrant1`, `entrant2`, `games.selections`. Used by `TournamentTab` for the live-bracket view.
- **Polling:** `TournamentTab` polls this every **30 seconds** (`POLL_INTERVAL`) while viewing an event. See `references/rate-limiting.md`.

### `GetPlayerSets` — `getPlayerSets`

- **File:** `src/utils/startggData.js:447-520`
- **Auth:** Client A / Client C
- **Variables:** `userSlug: String!, perPage: Int, videogameId: ID! (default 1386)`
- **Use case:** Listing sets for a player when you have their slug (not just numeric ID).

### `UserTournaments` — `getUserRegisteredTournaments`

- **File:** `src/utils/startggData.js:595-650`
- **Auth:** **OAuth-required** (Client C, but errors out if no OAuth token)
- **Variables:** `perPage: Int (default 50)`
- **Returns:** Tournaments where the logged-in user is registered, including their Smash events. Powers the dashboard tournament list.

### `CurrentUser` — `fetchUserInfo` (inline in auth hook)

- **File:** `src/lib/startggAuth.js:340-383` (direct fetch, doesn't go through Client A/B/C)
- **Auth:** OAuth access token
- **Query:**
  ```graphql
  query CurrentUser {
    currentUser {
      id slug email name discriminator
      player { id gamerTag }
    }
  }
  ```
- **Stored at:** AsyncStorage key `startgg_user_info`. Refreshed only on login (no auto-refetch).

### `HealthCheck` — `startggApi.healthCheck`

- **File:** `src/lib/startgg.js:82-110`
- **Auth:** Client A (PAT)
- **Query:** Trivial `currentUser { id }` — used to verify the PAT works.

## Adding a New Query

Default home: `src/utils/startggData.js`. Pattern to follow:

```js
export async function getMyNewThing(arg, options = {}) {
  const { perPage = 20, page = 1 } = options;
  const query = `
    query MyNewThing($arg: String!, $perPage: Int!, $page: Int!) {
      thing(arg: $arg) {
        nodes { id name }
      }
    }
  `;
  try {
    const data = await makeAuthenticatedRequest(query, { arg, perPage, page });
    return data.thing.nodes;
  } catch (err) {
    console.error("getMyNewThing failed:", err);
    throw err;
  }
}
```

Things to remember:

1. **Pick the right client.** PAT for public, OAuth for personalized.
2. **Use named queries** (`query MyNewThing(...)`) — easier to spot in network tools.
3. **Cap `perPage` at 20 for `sets`** — anywhere else, follow the existing convention for that type.
4. **Apply `filterSinglesOnly` if it's a sets query** that could include doubles/non-Ultimate.
5. **Add a corresponding hook in `src/hooks/useStartGG.js`** if any component needs state, loading, or pagination management around it. Don't make components do their own state machine.
6. **Don't forget the videogame filter.** Smash Ultimate is `1386`. Without it, you'll get every fighting game in your search results.

## Anti-Patterns to Avoid

- **Don't query without `filterSinglesOnly`** when dealing with sets. The character-stats math gets ruined by doubles data.
- **Don't fetch all pages eagerly.** `MostPlayedAgainst` caps at 300 sets for a reason — that's ~15 page fetches. Anything more is a rate-limit risk.
- **Don't pass `videogameId` as a string** — it's an `ID!` scalar in GraphQL. Pass it as a number/numeric ID. (Start.gg accepts both, but the schema declares it.)
- **Don't introduce new singleton clients.** If a query genuinely needs different auth, it goes through Client B or Client C, not a parallel class.
