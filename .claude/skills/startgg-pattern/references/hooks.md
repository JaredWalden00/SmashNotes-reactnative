# Start.gg React Hooks

Hooks that wrap the API/auth into stateful React-friendly interfaces. All hooks live in `src/hooks/useStartGG.js` **except** `useStartGGAuth` which lives in `src/lib/startggAuth.js` for historical reasons (it's tightly coupled to the `StartGGAuth` class).

When you add a new Start.gg-touching feature, prefer using or adding a hook over inline `fetch` calls in components. Hooks are where loading/error/pagination state belongs.

## `useStartGGAuth` (in `src/lib/startggAuth.js`)

**Owns:** Authentication state, login/logout, token, current user info.

**Inputs:** none.

**Returns:**
```js
{
  isAuthenticated: boolean,
  isLoading: boolean,
  user: { id, slug, email, name, discriminator, player: { id, gamerTag } } | null,
  accessToken: string | null,
  login: () => Promise<void>,
  logout: () => Promise<void>,
  authService: StartGGAuth,  // ← rarely needed; escape hatch
}
```

**Use it when:** any component needs to know if the user is logged in, who they are, or to call protected queries (you'll pass `accessToken` to `startggGraphQL`).

**Don't use it for:** queries themselves. This hook does not provide a fetch helper — it gives you the token, and you call the API with it.

**Mount behavior:** Checks AsyncStorage for an existing token on mount. If present and valid (incl. auto-refresh within 5-min window), populates state. On web, also handles the `?code=...` URL parameter from a redirect.

---

## `useStartGGTournaments` (`src/hooks/useStartGG.js`)

**Owns:** Tournament search state.

**Returns:**
```js
{
  tournaments: [], loading, error, searchQuery,
  searchForTournaments(query, options),
  clearSearch(),
}
```

**Calls:** `searchTournaments` from `startggData`.

**Use it for:** tournament browser components.

---

## `useStartGGTournament(tournamentSlug)`

**Owns:** Single tournament detail + its events.

**Inputs:** `tournamentSlug` — when this changes, the hook re-fetches.

**Returns:**
```js
{
  tournament: {...} | null,
  events: [...],
  smashUltimateEvents: [...],  // pre-filtered to videogameId 1386
  loading, error,
}
```

**Calls:** `getTournament` and `getTournamentEvents`.

**Auto-loads:** on mount and whenever `tournamentSlug` changes.

---

## `useStartGGPlayer`

**Owns:** Player search + player detail + their sets + computed character stats.

**Returns:**
```js
{
  players: [], selectedPlayer: null,
  playerSets: [], characterStats: null,
  loading,
  searchForPlayers(gamerTag),
  loadPlayerSets(userSlug, options),
  selectPlayer(player),
  clearSearch(),
}
```

**Calls:** `searchPlayers`, `getPlayerSets`, `getCharacterStats` (sync local processor).

---

## `useStartGGSets(eventId)`

**Owns:** Paginated event-sets view for a single event.

**Inputs:** `eventId` — when this changes, resets and re-fetches.

**Returns:**
```js
{
  sets: [...], characterStats, pageInfo, currentPage,
  loading, error,
  loadSets(page),
  loadMoreSets(),
  refreshSets(),
}
```

**Calls:** `getEventSets` (perPage 50, sortType RECENT).

**Auto-loads:** on mount and on `eventId` change.

---

## `useStartGGConnection`

**Owns:** API connectivity status. The "are we wired up correctly" probe.

**Returns:**
```js
{ isConnected, isAuthenticated, connectionError, checking, checkConnection() }
```

**Calls:** `startggApi.healthCheck()` (Client A, PAT-based).

**Auto-checks:** on mount.

**Use it in:** Settings screen, debug overlays, anywhere you want to surface "Start.gg integration is/isn't working" to the user.

---

## `useStartGGIntegration`

**Owns:** In-memory binding between SmashNotes notes and Start.gg entities. Note → tournament/player Maps.

**Returns:**
```js
{
  tournamentNotes: Map,
  playerNotes: Map,
  matchupData: Map,
  addTournamentNote(noteId, tournament),
  addPlayerNote(noteId, player),
  processMatchupData(notes, playerSets),
  generateInsights(),
}
```

**No API calls** — purely state management for the integration features. Use when you need to associate user notes with Start.gg objects.

---

## `useStartGGSchedule`

**Owns:** Tournaments grouped by ISO date for the calendar view.

**Returns:**
```js
{
  tournamentsByDate: { '2026-04-22': [...], ... },
  loading, error,
  loadTournamentsForWeek(startDate, endDate),
  getTournamentsForDate(dateISOString),
  getTournamentsForToday(),
}
```

**Calls:** `getTournamentsForDates` (which uses OAuth-required `getUserRegisteredTournaments` when available, falls back to mock data otherwise).

**Auto-loads:** on mount.

---

## When to Use a Hook vs Inline `fetch`

| Situation | Approach |
|---|---|
| Reading data that one component cares about, with loading/error UI | **Make / use a hook** |
| One-shot action triggered by a button click (e.g. submit, refresh) | OK to inline `await startggGraphQL(...)` in the click handler |
| Shared data multiple components might read | **Hook** (lift state into the hook) |
| Cross-cutting concern like auth | **Hook** |

## Adding a New Hook

Pattern to follow (matching `useStartGGPlayer` shape):

```js
export function useStartGGFooBar() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFooBar = useCallback(async (arg) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getFooBar(arg);  // from startggData.js
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchFooBar };
}
```

Conventions:

1. **Always expose `loading` and `error`.** The UI almost always wants both.
2. **Use `useCallback` for action functions** that components will likely pass to `useEffect` deps or memoized children.
3. **Don't fetch on import** — fetch on mount via `useEffect` or on explicit call.
4. **Clean up** if the hook does anything async on unmount (intervals, polling). The existing `useStartGGSchedule` and the event-poll in `TournamentTab` are good references.
5. **Name the file convention:** all useStartGG* live in `src/hooks/useStartGG.js`. Don't split into separate files unless one gets really big.

## Anti-Patterns

- **Don't duplicate `useStartGGAuth`'s state in your hook.** If you need auth, consume `useStartGGAuth()` and forward what you need.
- **Don't put network fetches in components.** Even one-off `fetch('https://api.start.gg/gql/alpha', ...)` calls should go through Client A/B/C in `src/lib/startgg.js` or `src/utils/startggData.js` — the components that currently violate this (`PlayerOpponentsTab`) are existing tech debt, not a pattern to follow.
- **Don't add a hook that just wraps a single query with no extra state.** That belongs as a function in `startggData.js`; components can call it directly via a useEffect.
