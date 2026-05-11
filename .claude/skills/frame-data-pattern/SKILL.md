---
name: frame-data-pattern
description: Use when working with the bundled Smash Ultimate frame data — querying it, parsing values, adding new derived stats, or extending the Frame Data tab. Covers the JSON schema, the dual client/server-side utility files, value-parsing rules (slash-separated multi-hitboxes, the "--" sentinel), and the character alias map.
---

# Frame Data Pattern Guide

The app bundles `src/data/frameData.json` (1.6MB) — every move for every character in Smash Ultimate. It's static (scraped at build time from ultimateframedata.com via `scripts/scrapeFrameData.js`). Queries against it run instantly.

## Files

| File | Where it runs | Purpose |
|---|---|---|
| `src/data/frameData.json` | bundled | The data |
| `src/utils/frameData.js` | client (browser/RN) | Client-side queries + UI formatters (HTML badges for the Frame Data tab) |
| `server/frameDataQuery.js` | server (Node) | Server-side queries + RAG context formatters (text for Claude/Ollama prompts) |
| `scripts/scrapeFrameData.js` | dev tooling | Rebuilds frameData.json from UFD |

**The client and server utility files are partial duplicates.** Some functions exist in both (e.g., `getFrameData`, character alias maps). If you add a function, decide which side actually needs it — they're not auto-synced.

## The JSON Schema

```js
{
  "Bayonetta": {
    "name": "Bayonetta",
    "slug": "bayonetta",                    // UFD URL slug
    "categories": [
      {
        "category": "groundattacks",        // or aerialattacks, specialattacks, grabs, dodges
        "label": "Ground Attacks",
        "moves": [
          {
            "moveName": "Jab 1",
            "startup": "5",                  // string, sometimes slash-separated for multi-hitbox
            "activeFrames": "5—7",           // string, em-dash separator
            "totalFrames": "24",
            "landingLag": "--",              // "--" means N/A for ground moves
            "baseDamage": "1.5",
            "advantage": "-8",               // on-shield advantage
            "shieldLag": "8",
            "shieldStun": "3",
            "whichHitbox": "--",
            "notes": "..."
          },
          // ... more moves
        ]
      },
      // ... more categories
    ]
  },
  "Fox": { ... },
  // ... 87 more characters
}
```

## Value Parsing Rules

### The `"--"` Sentinel

Means "not applicable" or "no data". Always check for it before using:

```js
if (move.landingLag && move.landingLag !== "--") {
  // use it
}
```

Or use the helper:

```js
function valid(val) {
  return val && val !== "--" && val.trim() !== "";
}
```

### Slash-Separated Multi-Hitbox Values

Some moves hit with multiple values depending on hitbox/position:

```
"baseDamage": "15.0/12.0/9.0"   // strong / mid / weak
"startup": "6/7/9"              // depends on follow-up
"advantage": "-6/-6"            // both hits
```

To get just the first/primary value:

```js
function primary(val) {
  if (!val || val === "--") return null;
  return val.split("/")[0].trim();
}
```

To display the full value: keep the string as-is.

### Range Values

Active frames use em-dashes: `"5—7"` means frames 5 through 7. Don't confuse with hyphen-minus.

### String, Not Number

**Every field is a string.** Don't assume `parseFloat` works without checking — fields can contain unicode, asterisks (`**`), or be `"--"`. Always validate first.

## The Five Standard Categories

Order matters for UI display:

1. `groundattacks` ("Ground Attacks")
2. `aerialattacks` ("Aerial Attacks")
3. `specialattacks` ("Special Attacks")
4. `grabs` ("Grabs & Throws")
5. `dodges` ("Dodges & Rolls")

Not every character has all 5 (e.g., Random doesn't exist, some characters lack certain attack types). Code must tolerate missing categories.

## Common Query Patterns

### Get all data for a character

```js
import { getFrameData } from "../utils/frameData";  // or server/frameDataQuery
const data = getFrameData("Fox");  // returns null if not found
```

### Search moves by name (with aliases)

```js
import { searchMoves } from "../utils/frameData";
const results = searchMoves("Fox", "nair");  // expands to "Neutral Air"
```

The `MOVE_ALIASES` map (in both client and server utils) handles abbreviations: `nair`, `fair`, `bair`, `uair`, `dair`, `ftilt`, `utilt`, `dtilt`, `fsmash`, `usmash`, `dsmash`, `up b`, `down b`, `side b`, `neutral b`, `grab`, `dash attack`, `jab`.

### Get a character's safe-on-shield moves

```js
import { getShieldAdvantageData } from "../../server/frameDataQuery";  // server only
const text = getShieldAdvantageData("Bayonetta");
// returns a formatted text block sorted by on-shield advantage
```

### Get a character's OOS options

```js
import { getOOSOptions } from "../../server/frameDataQuery";
const text = getOOSOptions("Bayonetta");
// returns Up B OOS, Up Smash OOS, Grab OOS, Aerial OOS calculations
```

See `server/frameDataQuery.js` for the full math (shield drop = 11, jumpsquat = 3, grab shieldstun = +4).

## Character Aliases (server-only, in `frameDataQuery.js`)

The server has an alias map for parsing user questions. Most-common ones:

| Alias | Maps to |
|---|---|
| `dk` | Donkey Kong |
| `diddy` | Diddy Kong |
| `zss` | Zero Suit Samus |
| `gnw`, `game and watch` | Mr. Game & Watch |
| `palu` | Palutena |
| `bayo` | Bayonetta |
| `ddd`, `dedede` | King Dedede |
| `krool`, `k rool` | King K. Rool |
| `rob` | R.O.B. |
| `rosa` | Rosalina & Luma |
| `banjo` | Banjo & Kazooie |
| `mythra`, `pyra`, `aegis` | Pyra/Mythra |
| `falcon` | Captain Falcon |
| `mk` | Meta Knight |
| `pt` | Pokemon Trainer |
| `minmin` | Min Min |
| `wft` | Wii Fit Trainer |
| `mac` | Little Mac |

Full list at top of `server/frameDataQuery.js`. Add new ones here if you encounter user-facing questions that fail to resolve a character.

## UI Formatters (client-side, in `frameData.js`)

`formatMoveAsHtml(move, characterName)` — compact HTML "chip" with stat bars. Used for drag-into-editor.

`formatMoveDetailedHtml(move, characterName)` — full move card with all stats. Used for clicked-from-editor.

Both return HTML strings with inline styles. They use the same color palette as the rest of the app (`#FF6B3D` for headings, `#34D399` for safe, `#F87171` for unsafe, etc.).

## Rebuilding the JSON

```
npm run scrape:framedata
```

This runs `scripts/scrapeFrameData.js`, scraping UFD and overwriting `src/data/frameData.json`. Takes ~1 minute. Run when:
- UFD has updated frame data (rare; the game is in maintenance mode)
- A new character was added (not happening but in theory)
- You discovered the scraper is missing fields you need

## Adding a New Derived Query

If you want to compute something across moves (e.g., "all moves above 15% damage"), add a function to **the right side**:

- Client-side: `src/utils/frameData.js` (used by UI components like FrameDataTab)
- Server-side: `server/frameDataQuery.js` (used by AI tools)

If both will use it, write it twice (duplicate code is acceptable here — these files have different runtime environments and bundling concerns).

Pattern in `frameDataQuery.js`:

```js
function getYourThing(characterName) {
  const data = frameDataJson[characterName];
  if (!data) return null;

  const results = [];
  for (const cat of data.categories) {
    for (const move of cat.moves) {
      if (/* condition */) {
        results.push(/* formatted entry */);
      }
    }
  }

  if (!results.length) return null;
  return `${characterName.toUpperCase()}'S YOUR THING:\n${results.join('\n')}`;
}
```

If you want Claude to be able to call it, also add a tool definition (see `claude-ai-pattern` skill).

## Common Gotchas

- **Don't `Object.keys(frameDataJson).length` to count characters.** The JSON has 89 entries; that's fine. Just be aware that "General" isn't here — that's a UI concept only, in `smashFighters.js`.
- **Character name case-sensitivity.** Lookups are exact. `"bayonetta"` won't match `"Bayonetta"`. Always normalize via the alias map or use the proper-cased name.
- **`Pokemon Trainer` is a special case.** UFD has three slugs for it: `pt_squirtle`, `pt_ivysaur`, `pt_charizard` — mapped to three separate characters in our JSON. There's no aggregated "Pokemon Trainer" entry.
- **`Mythra` vs `Pyra/Mythra`.** UFD has just `mythra` and `pyra` (separate slugs) but our app calls the duo `Pyra/Mythra`. The alias map handles user input; the JSON keeps them separate.
- **The em-dash in `activeFrames`.** Not a regular hyphen. If you split on `"-"`, you'll fail to parse ranges.
- **Don't trust `parseInt(move.startup)` blindly.** Could be `"6/7/9"`, `"--"`, `"*"`, etc.
