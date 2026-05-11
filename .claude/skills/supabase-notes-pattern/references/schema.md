# Notes Schema & Migrations

## The Canonical Note Shape

After `normalizeNote()` runs (defined in `src/utils/smashNoteModel.js`), a note looks like this:

```js
{
  id: string,                    // internal UUID
  title: string,                 // computed if blank: "Char vs Opp" or "Char notes" or "Notes"
  body: string,                  // for legacy / fallback use — see below
  character: string,             // a fighter name or "General"
  opponent: string | null,       // null for general notes
  category: "general" | "matchup",
  sections: {                    // 6 standard + any number of custom
    overview: string,
    neutral: string,
    advantage: string,
    disadvantage: string,
    stageNotes: string,
    reminders: string,
    "custom:Footsies": string,   // optional, prefix marks custom
    "custom:Notes 2": string,    // can be many
    ...
  },
  playerTag: string | null,
  startggPlayerId: string | null,
  setId: string | null,
  setTournament: string | null,
  setEvent: string | null,
  setScore: string | null,
  vodUrl: string | null,
  updatedAt: number,             // ms since epoch
}
```

## The Five Standard Section Keys

From `NOTE_SECTION_OPTIONS` in `smashNoteModel.js`. **Order matters** — UI iterates this array:

1. `overview` — game plan, key habits
2. `neutral` — spacing, approach
3. `advantage` — combos, kill confirms
4. `disadvantage` — landing, recovery
5. `stageNotes` — stage-specific
6. `reminders` — in-set reminders

All six are always present in the object even if empty strings (this is what `createEmptySections()` guarantees).

## Custom Section Keys

User can add custom sections. They're stored in the same flat `sections` object, prefixed with `custom:`:

```js
sections: {
  overview: "...",
  neutral: "",
  // ...
  "custom:Footsies": "neutral game specifics here",
  "custom:Match Day Mental": "stay calm, breathe",
}
```

Helper: `createCustomSectionKey(label, existingKeys)` — generates a unique key, appending `(2)`, `(3)` etc. if needed.

Don't try to store custom sections in a nested object — flat keyspace keeps queries simple.

## The Database Table

Table: `notes` (defined in `supabase/migrations/20260322_add_smash_note_columns.sql`).

Columns:
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users)
- `title` (text)
- `body` (text) — see "Structured Body Encoding" below
- `character` (text)
- `opponent` (text, nullable)
- `category` (text)
- `sections` (jsonb)
- `player_tag`, `startgg_player_id`, `set_id`, `set_tournament`, `set_event`, `set_score`, `vod_url` (text, all nullable — added in later migrations)
- `updated_at` (timestamptz)

## Structured Body Encoding (`__SMASHNOTE__:` prefix)

Reason it exists: the original schema had just `id`, `title`, `body`. Everything else was bolted on later. To stay compatible with older app builds (and stale Supabase instances), every note also serializes its full structure into `body`:

```
__SMASHNOTE__:{"title":"...","character":"...","sections":{...},...}
```

When reading:

```js
if (bodyStr.startsWith("__SMASHNOTE__:")) {
  bodyExtra = JSON.parse(bodyStr.slice("__SMASHNOTE__:".length));
}
```

Then in `fromDb()`, every column has a fallback: `row.player_tag || bodyExtra.playerTag`. If the DB column doesn't exist or is null, we still get the value from the body JSON.

This is the **single most important pattern** in this layer. If you're adding a field, you need to add it to BOTH paths.

## Migration Files

In `supabase/migrations/`:

| File | What it adds |
|---|---|
| `20260322_add_smash_note_columns.sql` | The base schema (character, opponent, category, sections) |
| `20260323_enable_notes_rls_policies.sql` | RLS so users can only see their own notes |
| `20260324_add_user_profiles_main_character.sql` | User profile for "your main" |
| `20260330_add_player_tag_columns.sql` | `player_tag` + `startgg_player_id` |
| `20260331_add_set_columns.sql` | `set_id`, `set_tournament`, `set_event`, `set_score` |
| `20260331_add_vod_url_column.sql` | `vod_url` |

To apply locally:
```
npx supabase db reset    # nukes and re-applies all migrations
```

To push to production:
```
npm run db:migrate
```

## Adding a New Field — The Five-File Edit

Imagine you want to add `weatherCondition` to notes (don't actually — this is just an example).

### 1. Migration file

```sql
-- supabase/migrations/20270101_add_weather_condition.sql
ALTER TABLE notes ADD COLUMN weather_condition TEXT;
```

Apply: `npx supabase db reset` (dev) or `npm run db:migrate` (prod).

### 2. `smashNoteModel.js`

Add the field to:
- `normalizeNote()` — read from various sources, default to `null`:
  ```js
  weatherCondition: note.weatherCondition || payload.weatherCondition || null,
  ```
- `serializeNoteForStorage()` — include in the `__SMASHNOTE__:` JSON payload
- TypeScript-ish: any field documentation in `NOTE_SECTION_OPTIONS` if it's a section, or just elsewhere if it's a top-level field

### 3. `cloudNotes.js` — `toDb()` and `fromDb()`

`toDb()`:
```js
weather_condition: normalized.weatherCondition || null,
```

`fromDb()`:
```js
weatherCondition: row.weather_condition || bodyExtra.weatherCondition || undefined,
```

Also: add `weather_condition` to the SELECT in `fetchNotesForUser()` (the full select, not the fallback). Add it to the fallback regex too if the column is from a new migration users might not have applied:
```js
if (error && /player_tag|...|weather_condition/.test(error.message)) { ... }
```

### 4. `useNotes.js` — `createNoteSilent()` and `saveDraft()`

If callers pass the field:
```js
weatherCondition: noteData.weatherCondition || null,
```

### 5. UI (whichever component sets the field)

Pass the new field when calling `createNoteSilent({ ..., weatherCondition: '...' })`.

That's the full five-file pattern. Missing any one of them means the data either won't persist, won't round-trip, or won't show after refresh.

## Section Helpers

`smashNoteModel.js` exports:

| Function | Use |
|---|---|
| `createEmptySections(seed)` | Returns the full 6-section object, filled with empty strings unless `seed` provides values |
| `getActiveSectionKeys(seed)` | Returns the keys that have content, or `["overview"]` if none |
| `getSectionLabel(key)` | "overview" → "Overview", `"custom:Foo"` → "Foo" |
| `getSectionPlaceholder(key)` | Returns the placeholder text for a known section |
| `createCustomSectionKey(label, existing)` | Makes a unique `custom:Label (N)` key |
| `buildNoteTitle(char, opp, title)` | Default-title logic — "Bayonetta vs Fox", "Fox notes", or "Notes" |
| `summarizeSections(sections)` | First non-empty section value, for preview cards |
| `getNoteSummaryLines(sections)` | Top 3 [label, value] pairs for compact display |
| `matchesSmashNoteSearch(note, search)` | Lowercased substring match across title/character/opponent/etc. |
| `normalizeNote(note)` | THE big one. Always run notes through this. |
| `serializeNoteForStorage(note)` | Re-encodes a note with the `__SMASHNOTE__:` body prefix for upsert |

## RLS Policies (Row-Level Security)

`supabase/migrations/20260323_enable_notes_rls_policies.sql` enables policies so:
- `SELECT`, `INSERT`, `UPDATE`, `DELETE` all require `user_id = auth.uid()`
- Users can only see their own notes
- A note written without `user_id` is essentially invisible

If you ever see "I saved a note but it's not showing up", check that `user_id` was set in the `toDb()` row. The Supabase client doesn't fill it automatically.

## What NOT to Do

- **Don't query the notes table from the frontend with raw SQL.** Go through `cloudNotes.js` so the toDb/fromDb conventions are honored.
- **Don't add a field as a section.** Sections are user-editable text. Fields like `playerTag` or `vodUrl` are metadata — top-level columns.
- **Don't remove the `body` field or stop dual-writing.** Until every prod user is on a migration-current DB, the JSON-in-body fallback is keeping things working.
- **Don't iterate `notes` and write them all in a loop.** Bulk updates aren't supported through the current upsert path. If you need a backfill, write a migration with SQL, not JS.
