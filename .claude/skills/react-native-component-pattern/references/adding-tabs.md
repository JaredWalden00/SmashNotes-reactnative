# Adding a Tab — The Four-Step Dance

`NotesScreen.js` is the orchestrator that hosts every tab. Adding a new tab requires changes in **four places in this one file** (plus the new tab component itself). Forgetting any one of them = silent breakage.

## The Tabs Already in the App

### Primary tabs (`PRIMARY_TABS`)

Always visible at the bottom on mobile / top of side rail on desktop:

- `my-stuff` (Home)
- `all-notes` (Notes)
- `tournaments` (Tournaments)

### More-menu tabs (`MORE_TABS`)

In the More sheet on mobile / lower side rail on desktop:

- `stats`, `players`, `vod-review`, `notes-import`, `smash-ask`, `frame-data`, `settings`

You'll almost always be adding to `MORE_TABS`, not `PRIMARY_TABS`.

## The Four Places to Edit `NotesScreen.js`

### 1. `MORE_TABS` array (around line 194)

```js
const MORE_TABS = [
  { key: "stats", label: "Stats", icon: "stats-chart" },
  // ...
  { key: "your-new-tab", label: "Your Tab", icon: "rocket" },  // ← add
];
```

`icon` is an Ionicon name. Find one at https://ionic.io/ionicons. Active state uses `name`, inactive uses `name + "-outline"`.

### 2. Side-rail nav items (in `renderSideRail`, around line 386)

```js
const navItems = [
  { key: "my-stuff", label: "My Stuff" },
  // ...
  { key: "your-new-tab", label: "Your Tab" },  // ← add
];
```

Same key as in MORE_TABS. Label can be different if you want (rare).

### 3. `renderTabPage` call (around line 508-538)

This is the actual mounting:

```jsx
{renderTabPage("your-new-tab", "Your Tab",
  <YourNewTab
    allNotes={allNotes}
    onCreateNoteSilent={onCreateNoteSilent}
    onEditNote={onEditNote}
    onDeleteNote={onDeleteNote}
    onSaveInlineEdit={onSaveInlineEdit}
    userMainCharacter={userMainCharacter}
  />
)}
```

The component receives whatever props you wire here. Don't pass props it doesn't need — keep the prop list small.

### 4. `persistentTabKeys` array (around line 546)

```js
const persistentTabKeys = [
  "tournaments", "stats", "players", "vod-review",
  "notes-import", "smash-ask", "frame-data", "settings",
  "your-new-tab",  // ← add
];
```

This array lists tabs that should be rendered while a character is NOT selected. If you skip this step, your tab won't show up at all when navigating from outside a character context.

## The Tab Component Itself

Create `src/components/YourNewTab.js`. Pattern:

```jsx
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";

export default function YourNewTab({ allNotes, onCreateNoteSilent, userMainCharacter }) {
  const [state, setState] = useState(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Your Tab</Text>
      {/* ... */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F1420" },
  content: { padding: 20, paddingBottom: 40 },
  heading: { color: "#F4F7FF", fontSize: 22, fontWeight: "700", marginBottom: 6 },
  // ...
});
```

Conventions:
- **Container background:** `#0F1420` (matches the page bg)
- **Outer wrapper:** `ScrollView` (90% of the time) or `View` (if you control your own scroll regions)
- **No top bar inside the tab.** The renderTabPage wrapper adds the title bar with the back arrow.

## The `renderTabPage` Wrapper (read-only, but useful to know)

```jsx
function renderTabPage(tabKey, title, children) {
  const isActive = activeNavSection === tabKey && !selectedCharacter;
  return (
    <View style={[styles.dashboardShell, isDark && styles.dashboardShellDark, !isActive && { display: "none" }]}>
      {isWideLayout ? renderSideRail(tabKey) : null}
      <View style={styles.dashboardMain}>
        <View style={styles.dashboardTopBar}>
          {!isWideLayout && <Pressable style={styles.mobileBackBtn} onPress={() => navigateTo("my-stuff")}>←</Pressable>}
          <Text style={styles.dashboardTitle}>{title}</Text>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
        {!isWideLayout && renderMobileBottomNav(tabKey)}
      </View>
    </View>
  );
}
```

Key thing: **inactive tabs use `display: none`, they're NOT unmounted.** This is why state in your tab persists when the user switches away — `useState` values stay alive. Don't try to load data on every "mount" expecting it to refetch.

## Auto-Load on First Visit

If you want the tab to load data when the user first navigates to it (not on app mount), use a flag pattern:

```jsx
const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
const isActive = /* derived from props somehow */;

useEffect(() => {
  if (isActive && !hasLoadedOnce) {
    loadData();
    setHasLoadedOnce(true);
  }
}, [isActive]);
```

But honestly, most tabs just load on mount via a regular `useEffect`, and the cost of one extra fetch on app startup is acceptable.

## Pending-Data Pattern

If another tab needs to "send" the user to your tab with preloaded data:

1. Add a `pendingXyz` state at the `NotesScreen.js` level
2. The sending tab calls a setter (e.g., `setPendingVodNote(note)`) and then `navigateTo("your-tab")`
3. Your tab receives `pendingXyz` as a prop, consumes it on mount, then calls `onClearPendingXyz()` to acknowledge

`VodReviewTab` does this with `pendingVodNote` / `onClearPendingVodNote`. Match this shape if you build something similar.

## Common Mistakes

- **Forgetting `persistentTabKeys`.** The most common bug. Tab is in MORE_TABS, in side rail, has a renderTabPage call... but doesn't appear because it's missing from this array.
- **Naming inconsistency.** Tab key must be EXACTLY the same string in all four places. Typo in one = silent breakage.
- **Wrong icon name.** Ionicons doesn't auto-fail for typo icons — it just renders blank. Test that the icon shows up.
- **Passing too many props.** You don't need to forward every prop NotesScreen has. Pick what your tab actually uses.
- **Re-importing data the parent already has.** If `allNotes` is in props, use it; don't `useNotes()` again inside the tab (would double-render, double-fetch).

## Test Checklist for a New Tab

1. Build it: server + Expo running
2. On wide layout: tab name shows in side rail; clicking it opens
3. On narrow: "More" sheet opens, tab name shows; clicking it opens
4. Tab loads without error
5. Switch to another tab and back — state persists (because `display: none`, not unmount)
6. Tab works on at least one wide breakpoint and one narrow breakpoint
