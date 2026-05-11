# Character Picker Pattern

A pattern that's been copy-pasted into at least three tabs (`NotesImportTab`, `SmashAskTab`, `SettingsTab`'s main selector, and arguably the main `FighterTile` grid in NotesScreen). If you find yourself adding a 4th instance, **extract it to `src/components/CharacterPicker.js`** instead of copy-pasting again.

## What the Picker Does

A modal-style fullscreen view that lets the user select one fighter from the 89-character roster, optionally with search.

Visual structure:

```
┌─────────────────────────────────────────┐
│  ← Back   Select Your Character         │
├─────────────────────────────────────────┤
│  [ Search fighters...               ]   │
├─────────────────────────────────────────┤
│  Banjo & Kazooie  Bayonetta  Bowser     │
│  Bowser Jr        Byleth     Capt. F.   │
│  Charizard        Chrom      Cloud      │
│  ...                                    │
└─────────────────────────────────────────┘
```

It uses chips (text-only) rather than icons in `NotesImportTab` and `SmashAskTab`. The dashboard uses icon tiles via `FighterTile.js`.

## Current Implementation in Each Tab

Look at `src/components/NotesImportTab.js` for the canonical copy of this pattern:

```jsx
import { getRosterFighters } from "../data/smashFighters";

const [showCharPicker, setShowCharPicker] = useState(false);
const [charSearch, setCharSearch] = useState("");
const [myCharacter, setMyCharacter] = useState(userMainCharacter || "");

const roster = useMemo(() => getRosterFighters(), []);
const filteredRoster = useMemo(() => {
  if (!charSearch.trim()) return roster;
  const q = charSearch.toLowerCase();
  return roster.filter((f) => f.name.toLowerCase().includes(q));
}, [roster, charSearch]);

// In render:
if (showCharPicker) {
  return (
    <View style={styles.container}>
      <View style={styles.pickerHeader}>
        <Pressable onPress={() => { setShowCharPicker(false); setCharSearch(""); }}>
          <Text>← Back</Text>
        </Pressable>
        <Text style={styles.pickerTitle}>Select Your Character</Text>
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="Search fighters..."
        placeholderTextColor="#637083"
        value={charSearch}
        onChangeText={setCharSearch}
      />
      <ScrollView contentContainerStyle={styles.rosterGrid}>
        {filteredRoster.map((fighter) => (
          <Pressable
            key={fighter.name}
            style={[styles.fighterTile, myCharacter === fighter.name && styles.fighterTileActive]}
            onPress={() => {
              setMyCharacter(fighter.name);
              setShowCharPicker(false);
              setCharSearch("");
            }}
          >
            <Text style={[styles.fighterName, myCharacter === fighter.name && styles.fighterNameActive]}>
              {fighter.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
```

And the trigger button somewhere in the main view:

```jsx
<Pressable style={styles.charSelector} onPress={() => setShowCharPicker(true)}>
  <Text>{myCharacter || "Select your character..."}</Text>
</Pressable>
```

## Styles (copy verbatim if you need this)

```js
charSelector: {
  backgroundColor: "#1A2030",
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#2A3040",
  padding: 14,
  marginBottom: 16,
},
pickerHeader: {
  flexDirection: "row",
  alignItems: "center",
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: "#1A2030",
},
pickerTitle: {
  color: "#F4F7FF",
  fontSize: 18,
  fontWeight: "700",
},
searchInput: {
  backgroundColor: "#1A2030",
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#2A3040",
  padding: 12,
  margin: 16,
  color: "#F4F7FF",
  fontSize: 14,
},
rosterGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  padding: 12,
  gap: 8,
},
fighterTile: {
  backgroundColor: "#1A2030",
  borderRadius: 8,
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: "#2A3040",
},
fighterTileActive: {
  borderColor: "#FF6B3D",
  backgroundColor: "rgba(255,107,61,0.12)",
},
fighterName: {
  color: "#C0C8D8",
  fontSize: 13,
  fontWeight: "500",
},
fighterNameActive: {
  color: "#FF6B3D",
},
```

## When to Use the Chip-Style vs. Icon-Style Picker

- **Chip-style** (text only) — used in functional contexts where the user is filtering data by character (AI Import, Ask AI). No characters icons needed; just identification.
- **Icon-style** (`FighterTile`) — used in the dashboard where character is the primary navigation metaphor. The icon serves as the "open this character's notes" entry point.

Don't mix them in the same view. Pick one based on the user's mental model.

## When to Extract to a Shared Component

Strong signal that the time is now:

- A fourth tab needs this exact pattern, OR
- You need to change the styles (e.g., new active state) and you'd have to edit 3+ files, OR
- A bug shows up in one copy and the others have the same bug

When you extract:

1. New file: `src/components/CharacterPicker.js`
2. Accept props: `value`, `onChange`, `onClose`, `placeholder`, optionally `excludeGeneral` (since some tabs want to exclude "General")
3. Internally manage `searchQuery` state
4. Use `getRosterFighters()` from `smashFighters.js` (already excludes "General")
5. Style same as above

Caller becomes:

```jsx
const [showPicker, setShowPicker] = useState(false);
const [myCharacter, setMyCharacter] = useState("");

return showPicker ? (
  <CharacterPicker
    value={myCharacter}
    onChange={(name) => { setMyCharacter(name); setShowPicker(false); }}
    onClose={() => setShowPicker(false)}
  />
) : (
  /* main view */
);
```

That's it — no more 60 lines of styles repeated in every tab.

## Why It Hasn't Been Extracted Yet

Honestly, just inertia. Each tab added it slightly differently (some excluded "General", some didn't; some had additional state). Extracting requires a small reconciliation. Worth doing the next time you need to touch any one of them — at that point, just extract first, then make your change to the extracted version.

## Related Helpers

In `src/data/smashFighters.js`:

```js
GENERAL_FIGHTER_NAME = "General"
SMASH_FIGHTERS       = [ { name, icon }, ... ]  // all 90 (89 + "General")
getRosterFighters()  // SMASH_FIGHTERS without "General"
getFighterIcon(name) // returns the require()'d image for a fighter, or null
```

Use these instead of hardcoding character names anywhere.
