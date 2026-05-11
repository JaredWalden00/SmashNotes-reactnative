---
name: react-native-component-pattern
description: Use when building new screens, tabs, or components in SmashNotes — or when modifying existing UI. Covers the dark-theme color palette, the tab-registration four-step dance in NotesScreen.js, the recurring character-picker pattern, and StyleSheet/layout conventions.
---

# SmashNotes UI / Component Pattern Guide

This app has ~30 components that share consistent visual and structural conventions. Match these when adding new UI.

## Quick Decision Tree

| What you're doing | Where to go |
|---|---|
| Add a new tab to the More menu | `references/adding-tabs.md` — four-step dance in NotesScreen.js |
| Pick colors / spacing / font weights | `references/theming.md` |
| Add a character picker (user picks a fighter) | `references/character-picker.md` — already duplicated 3x; extract it if you add a 4th |
| Create a Modal that animates in | Look at existing modals; use `Pressable` overlays |
| Make something work on mobile + web | Check `isNarrow = width < 800` pattern in VodReviewTab |

## Tech Choices (what's used vs. avoided)

| Used | NOT used (intentionally) |
|---|---|
| `StyleSheet.create` for styles | NativeWind / Tailwind |
| Plain `Pressable` for buttons | TouchableOpacity (legacy), GestureHandler (over-engineered) |
| `View` + flex layout | RN Paper, RN Elements (UI lib lock-in) |
| `Ionicons` from `@expo/vector-icons` | Custom SVGs (except character icons) |
| `useColorScheme()` for theme awareness, but mostly forced dark | System-driven theming everywhere |
| `useWindowDimensions()` for responsive layouts | Media query libraries |
| `react-native-markdown-display` for AI responses | Building custom markdown |

Don't introduce new dependencies casually — the app stays light on purpose.

## File Organization

```
src/components/
├── NotesScreen.js          ← The orchestrator. Lots of state, lots of tabs.
├── *Tab.js                 ← Major features (VodReviewTab, FrameDataTab, etc.)
├── *Modal.js               ← Modal dialogs
├── *Card.js                ← Compact display widgets (RecentOpponentsCard, etc.)
├── NoteItem.js             ← One note in a list
├── LiveTextEditor.js       ← The rich-text editor used in note editing
├── FighterTile.js          ← One character icon button
└── ...
```

Conventions:
- **One component per file.** Even if it's a small subcomponent, give it its own file if it has its own styles.
- **Named export, no default for sub-components.** Main page-level component is `export default`. Helpers are named exports if exposed.
- **Component file should start with the JSX-y stuff, end with `const styles = StyleSheet.create({...})`.** Top-down readability.

## Critical Gotchas

- **All UI is forced-dark in practice.** Many components accept `forceDark` props or hard-code dark colors. Light mode is half-implemented; don't rely on it.
- **`Pressable` with conditional style array** is the universal button pattern: `style={[styles.btn, disabled && styles.btnDisabled]}`. Don't use `TouchableOpacity` for new code.
- **Web-specific JSX is allowed** — many components use bare `<iframe>`, `<img>`, `<input type="file">` etc. for web. Wrap in `Platform.OS === 'web'` checks if the native path needs different code.
- **Don't use `onPress` for keyboard-driven UI on web.** Use `onSubmitEditing` on TextInput, `onPress` on buttons. The two together cover both clicking and pressing Enter.
- **The "browse mode vs review mode" pattern in VodReviewTab is reusable.** A component decides at render time whether to show a list view or a detail view based on state. Good pattern when adapting it to new features.
- **All tabs are kept mounted** (hidden via `display: none` when inactive) — see `renderTabPage` in NotesScreen. This prevents data re-fetching when the user switches tabs. Don't accidentally unmount them.

## When NOT to Use This Skill

- For static data files (frame data, fighter list) — separate skill.
- For data hooks (useNotes, useStartGGAuth) — those have their own skills.
- For server-side / Express stuff — backend, not UI.

## References

| Open this | When |
|---|---|
| `references/theming.md` | Picking colors, spacing, fonts; matching dark-mode palette |
| `references/adding-tabs.md` | Adding a new tab to the More menu (the four-step dance) |
| `references/character-picker.md` | Implementing fighter selection in a new component (or extracting the duplicate) |
