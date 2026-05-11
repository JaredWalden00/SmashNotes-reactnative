---
name: supabase-notes-pattern
description: Use when adding, modifying, or debugging anything related to notes in SmashNotes (the core data model, Supabase cloud sync, AsyncStorage caching, migrations, adding new fields to notes). Covers the note schema, the local-first sync pattern, the structured-body fallback, and how to extend the model safely.
---

# SmashNotes Notes-Data Pattern Guide

Notes are the central data model of this app. The system is more complex than it looks because it has to handle:

- **Local-first writes** (instant UI, sync to cloud in the background)
- **Schema migration backwards-compat** (older DB columns missing → fall back to JSON-in-body)
- **Mixed-shape notes** (general, matchup, VOD, player-tracked) all in one table
- **Custom section keys** (user-defined sections beyond the standard 6)

## Quick Decision Tree

| What you're doing | Where to go |
|---|---|
| Adding a new field to notes | All 5 layers below — see `references/schema.md` |
| Creating a new kind of note from a tab | `useNotes().createNoteSilent(noteData)` — silent = no editor modal |
| Editing an existing note | `useNotes().saveInlineEdit(noteId, title, sections)` |
| Adding a new section type | `NOTE_SECTION_OPTIONS` in `smashNoteModel.js` |
| Adding a custom user-defined section | Already supported — use `createCustomSectionKey()` |
| Fixing a sync bug | `references/sync-flow.md` |
| Schema migration | `supabase/migrations/` + update `cloudNotes.js` toDb/fromDb |

## The Five Layers of a Note

A note flows through these layers when you write it:

```
1. UI state (the editor's local React state)
       │ user clicks Save
       ▼
2. useNotes() hook (orchestration: createNoteSilent, saveDraft, saveInlineEdit)
       │
       ▼
3. normalizeNote() in smashNoteModel.js (canonicalize, default fields)
       │
       ▼
4a. Local: setNotes(...) + AsyncStorage write   ← INSTANT (UI updates)
4b. Cloud: upsertNoteForUser() in cloudNotes.js  ← BACKGROUND (best-effort)
```

The user sees the note immediately (step 4a). Cloud sync happens after, errors show a popup but don't block.

## The Schema (Two Variants)

The database has been migrated several times. Newer columns may not exist on stale instances. The code handles this by **dual-writing**: every note's data lives both in dedicated columns AND inside the `body` field as JSON, prefixed with `__SMASHNOTE__:`.

```js
// What's stored in body when migrations are caught up:
{
  title, character, opponent, category,
  sections: { overview, neutral, advantage, ... },
  playerTag, startggPlayerId, setId, setTournament,
  setEvent, setScore, vodUrl
}
```

When the DB is missing a column (e.g., `vod_url`), `fromDb()` in `cloudNotes.js` reads from `body` instead. See `references/schema.md` for the encoding format.

## Critical Gotchas

- **Local update happens BEFORE cloud save.** Don't await `persistAndSync()` in user-facing flows — let the popup catch failures. The hook is structured this way intentionally; reverting it makes the UI feel laggy.
- **`normalizeNote()` is idempotent and defensive.** Always run notes through it before storing or comparing. It handles missing fields, legacy body parsing, and the `__SMASHNOTE__:` prefix.
- **`sections` is a flat object, not nested.** Keys are strings; `custom:` prefix marks user-defined ones. Don't nest sections under categories.
- **`buildId()` generates UUIDs.** Don't try to use IDs from external sources (Start.gg's IDs, etc.) — keep our IDs internal, store external IDs in their own fields like `setId` or `startggPlayerId`.
- **Migration files are date-named** (`YYYYMMDD_description.sql`). Don't rename or reorder them.
- **RLS policies require `user_id` matches `auth.uid()`.** If you write a note without setting `user_id`, the row is invisible to the user and orphaned in the DB.
- **The fallback SELECT** in `fetchNotesForUser()` exists to handle the case where DB columns from newer migrations haven't been applied yet. Don't simplify it without testing on a fresh DB.

## When NOT to Use This Skill

- For NEW data that isn't a note: don't shoehorn it into the notes table. Create a new table + migration + Supabase client functions.
- For static reference data (frame data, fighter list): that's bundled JSON, not Supabase.
- For user auth/profile: see `useAuth.js` and `cloudUserProfile.js` (separate from notes).

## References

| Open this | When |
|---|---|
| `references/schema.md` | Adding a field, understanding the `__SMASHNOTE__:` encoding, running a migration |
| `references/sync-flow.md` | Debugging "my note didn't save" or "notes don't sync between devices" |
