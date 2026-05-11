# Theming, Colors, and Layout

## Color Palette

These colors appear throughout the codebase. Use them; don't invent new shades.

### Backgrounds

| Token | Hex | Where |
|---|---|---|
| Primary background | `#0F1420` | Tab containers, full-screen views |
| Card background | `#1A2030` or `#1B2333` | Most cards, list items, sub-panels |
| Nested background | `#141C2B` | Inputs, deeper card layers, code-style blocks |
| Border / divider | `#2A3040` or `#2A3449` | All borders, separators between sections |
| Subtler border | `#252D3D` or `#1A2030` | Separators within cards |

Note: `#1A2030` and `#1B2333` are functionally interchangeable — different components used different exact shades historically. Pick whichever matches the surrounding context.

### Text

| Token | Hex | Use |
|---|---|---|
| Primary text | `#F4F7FF` | Headings, important UI text |
| Secondary text | `#C0C8D8` | Body text, descriptions |
| Tertiary / muted | `#637083` or `#96A3BD` | Placeholders, captions, deemphasized labels |
| Heavily muted | `#252D3D` | "Empty state" subtle text |

### Accent / Status

| Token | Hex | Meaning |
|---|---|---|
| Orange (primary accent) | `#FF6B3D` | Brand color. Buttons, active tabs, headings emphasis |
| Green (success) | `#34D399` | Save success, "Connected" |
| Red (error) | `#F87171` | Errors, destructive actions, danger zones |
| Blue (info / AI) | `#6B9CFF` | AI-related UI, info badges, alternate accent |
| Purple (auxiliary) | `#A78BFA` | Less-common alternate accent (e.g., Ollama provider chip) |
| Amber (warning / damage) | `#F59E0B` | Frame data damage stats, warnings |

### Pattern: Translucent Accent Backgrounds

For chips, badges, and soft accents, use a low-opacity version of the accent:

```js
backgroundColor: "rgba(255,107,61,0.12)"   // orange chip
backgroundColor: "rgba(107,156,255,0.15)"  // blue chip
backgroundColor: "rgba(167,139,250,0.15)"  // purple chip
backgroundColor: "rgba(248,113,113,0.1)"   // red error block
```

Pair with the matching solid color for text:

```js
backgroundColor: "rgba(255,107,61,0.12)",
color: "#FF6B3D",
```

This is the visual pattern for "soft chip" UI throughout the app.

## Spacing

No fixed spacing scale, but common values:

- `4`, `6`, `8` — tight spacing within compact UI
- `10`, `12`, `14` — typical padding inside cards / inputs
- `16` — page-level padding
- `20`, `24` — section separations
- `40` — empty-state top spacing

Border radius:
- `4`, `6` — small chips, badges
- `8` — buttons, inputs
- `10`, `12` — cards
- `14` — main "page card" containers

## Typography

No fonts are loaded — uses system default. The variation is in weight and size:

| Use | Size | Weight |
|---|---|---|
| Page heading | `20-22` | `700-800` |
| Section heading | `16-18` | `700-800` |
| Body text | `14` | `500` (or unspecified) |
| Caption / label | `12-13` | `600-700` |
| Tiny label / chip text | `10-11` | `700` (uppercase, letterSpacing 0.5) |

For uppercase chips/badges: combine `fontSize: 10-11`, `fontWeight: '700'`, `textTransform: 'uppercase'`, `letterSpacing: 0.5`.

## Layout Patterns

### Responsive (mobile + web)

```js
const { width } = useWindowDimensions();
const isNarrow = width < 800;
```

Apply different layouts based on `isNarrow`. Tabs typically:
- Stack vertically on narrow
- Side-by-side on wide

`VodReviewTab` is a good example with three layouts (`side`, `stack`, `video-top`).

### Side rail vs bottom nav

`NotesScreen.js` renders one of two navigation patterns based on `isWideLayout`:
- **Side rail** (desktop) — vertical list of tab labels on the left
- **Bottom tab bar** (mobile) — three primary tabs + "More" menu sheet

Both are built from the same `MORE_TABS` / `PRIMARY_TABS` arrays. See `references/adding-tabs.md`.

### Card pattern (compositional)

```jsx
<View style={styles.card}>
  <View style={styles.cardHeader}>
    <Text style={styles.cardTitle}>...</Text>
    <Pressable style={styles.cardAction}>...</Pressable>
  </View>
  <View style={styles.cardBody}>
    ...
  </View>
</View>
```

Cards almost always have a border (`#2A3040`-ish), padding `12-16`, border radius `12-14`.

## Common Reusable Element Styles

### Primary button

```js
btn: {
  backgroundColor: "#FF6B3D",
  borderRadius: 8,
  paddingVertical: 10,
  paddingHorizontal: 18,
  alignItems: "center",
},
btnLabel: {
  color: "#fff",
  fontWeight: "800",
  fontSize: 14,
},
btnDisabled: {
  opacity: 0.4,
},
```

### Secondary button

```js
btn: {
  backgroundColor: "#1A2030",
  borderRadius: 8,
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderWidth: 1,
  borderColor: "#2A3040",
},
btnLabel: {
  color: "#C0C8D8",
  fontSize: 13,
  fontWeight: "600",
},
```

### TextInput

```js
input: {
  backgroundColor: "#1A2030",  // or #141C2B for nested
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#2A3040",
  padding: 12,
  color: "#F4F7FF",
  fontSize: 14,
},
```

Always set `placeholderTextColor="#637083"`. Without it, the default placeholder is too light/contrasty.

### Chip / Badge

```js
chip: {
  backgroundColor: "rgba(255,107,61,0.12)",
  borderRadius: 4,
  paddingVertical: 2,
  paddingHorizontal: 8,
},
chipText: {
  color: "#FF6B3D",
  fontSize: 10,
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: 0.5,
},
```

## Anti-Patterns

- **Don't use inline `style={{...}}` for anything non-trivial.** Always go through StyleSheet.create.
- **Don't hardcode colors that don't match the palette.** If you need a new color, ask whether the design really needs it.
- **Don't make UI hover-dependent.** Mobile has no hover. Use press/active states only.
- **Don't use `<Text>` without explicit color.** Default is platform-dependent and ugly. Always set `color`.
- **Don't nest `<Text>` inside `<View>` without thinking about layout.** RN sometimes does weird vertical alignment. Use `flexDirection: 'row'` explicitly when laying out a row of text+icon.

## When the Design Doesn't Fit the Palette

If you genuinely need a color the palette doesn't have (e.g., a tournament status indicator), introduce it sparingly and document why. Don't slowly accumulate one-off hexes — the palette is a feature, not a constraint.
