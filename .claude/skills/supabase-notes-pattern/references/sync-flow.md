# Notes Sync Flow

The local-first sync architecture. Read this when notes aren't syncing, when writes feel slow, or when designing a new note-creation flow.

## The Big Picture

The app is **local-first**. Every write happens to React state immediately, then to AsyncStorage, then to Supabase in the background. The user never waits for the cloud.

```
User clicks "Save Note"
       │
       ▼
useNotes().saveDraft() / createNoteSilent() / saveInlineEdit()
       │
       ├──── 1. Build the upsertedNote via normalizeNote() ──────────┐
       │                                                              │
       ├──── 2. setNotes(prev => sortedNewList)  ◄── UI updates here ─┘
       │
       ├──── 3. persistAndSync() runs in background:
       │         a. Write nextNotes to AsyncStorage (per user)
       │         b. Call upsertNoteForUser(userId, upsertedNote) → Supabase
       │
       └──── 4. Show status popup (success / error / rate-limit)
```

Notice: step 2 happens BEFORE step 3. The UI updates instantly. The user can navigate away, lose internet, etc., and the local note is preserved.

## The Three Write Functions

All in `src/hooks/useNotes.js`. Use the right one:

| Function | When to use | Opens editor? |
|---|---|---|
| `saveDraft()` | User clicked Save in the main editor modal | N/A — closes it |
| `createNoteSilent(noteData)` | Programmatic creation (AI Import, Quick Create, tournament-set-to-note, etc.) | No |
| `saveInlineEdit(noteId, title, sections)` | Quick edits from a list view or VOD review | No |

If your new feature creates notes without showing the editor, **always use `createNoteSilent`**. Don't try to open the editor and then auto-submit — that path is for user-driven creation.

## Read Path

```
useNotes() mount
       │
       ▼
fetchNotesForUser(userId)  ← from cloudNotes.js
       │
       ├── Try full SELECT with all new columns
       ├── If error matches "missing column" regex:
       │     fall back to base SELECT (id, title, body, character, opponent, category, sections, updated_at)
       │     log a warning about missing columns
       │
       ▼
data.map(fromDb)  ← reconstruct notes (with body-JSON fallback)
       │
       ▼
setNotes(...)   ← UI populates
```

The fallback SELECT exists because users on older Supabase setups (or before they ran `npm run db:migrate`) won't have the newer columns. The code degrades gracefully by reading from the structured body JSON.

## AsyncStorage Layout

Local cache key pattern: `@smashnotes:notes:{userId}` (in `src/utils/storage.js`).

Stored value: the full notes array for that user, JSON-serialized.

This is **per-user** — switching users (or logging out / logging in as someone else) reads from a different key. There's no cross-user leakage.

Why store the whole array, not per-note? Because the app reads ALL notes on mount and shows them sorted by `updatedAt`. Storing as one blob means one read, one write. Per-note storage would require keying every note individually and reading the whole keyspace each time — slower and more complex.

## Why Local-First

Smash players are often in tournament venues with sketchy wifi. The local-first design means:
- Notes save instantly even on bad network
- Notes are readable offline
- Sync conflicts are rare because Supabase has `onConflict: "id"` upserts (last-write-wins)

## Error Handling

```js
persistAndSync(nextNotes, upsertedNote, null).catch((error) => {
  if (isRateLimitError(error)) {
    showServerOverloadedPopup();
    return;
  }
  showStatusPopup("error", "Save failed", "Your note was saved locally but cloud sync failed.");
});
```

Note: the local write succeeded by this point. The popup just tells the user that the cloud copy didn't update. The next time they open the app online, the local copy will overwrite the cloud copy on next save.

There is **no retry queue**. If cloud sync fails repeatedly, the local copy diverges silently. That's an accepted limitation for now (rare in practice; a real offline-queue would be a significant addition).

## Mass Operations

The current `useNotes` hook doesn't support bulk operations cleanly. If you need to:

- **Delete many notes:** loop `removeNote(id)` — each call updates state + AsyncStorage + Supabase. Slow but works.
- **Backfill a field:** write a one-time migration in `supabase/migrations/` using SQL. Don't try to do it from the JS hook.
- **Import many notes:** that's what the AI Import flow does — it loops `createNoteSilent` for each parsed note. Acceptable performance for tens of notes; doesn't scale to thousands.

## Cross-Device Sync

Two devices logged in as the same user:
- Device A creates a note → upsert to Supabase
- Device B opens the app → `fetchNotesForUser` pulls the latest, including A's note

There's no realtime subscription. Refreshing the list (or restarting the app) is what pulls new data. If you want realtime sync, you'd need Supabase Realtime + a merge strategy on the client. Not currently implemented.

## Common Bugs and How to Diagnose

| Symptom | Likely cause |
|---|---|
| "I saved a note but it's gone after refresh" | Local saved, cloud failed silently. Check console for `[cloudNotes]` warnings or popup-suppression bugs |
| "Notes from device A don't show on device B" | B hasn't refetched. Restart app or pull-to-refresh. Or A's cloud upsert never completed |
| "I see notes from another user" | Bug in `userId` plumbing — `useAuth` should isolate. Check `fetchNotesForUser(userId)` is called with the right ID |
| "Notes disappear when I log out and back in" | `logout()` clears AsyncStorage. Notes should reload from cloud on next login. If they don't, check `fetchNotesForUser` — maybe the SELECT failed silently |
| "I get duplicates after save" | Probably calling `createNoteSilent` instead of `saveInlineEdit`. Create makes a new ID; inline-edit updates an existing one |
| "Updates don't persist" | Check `upsertedNote.id` — if it's a new UUID each save, you're creating not updating. `saveInlineEdit` is what you want |

## Add-Ons

The notes hook supports several "alongside" data flows that aren't strictly note data but ride the same lifecycle:

- **Main character** — `userMainCharacter` from `cloudUserProfile.js`
- **Recent characters** — derived from notes' `updatedAt` ordering
- **Recent opponents** — same idea but from `opponent` field

These are all read-derived. Don't try to store them separately.
