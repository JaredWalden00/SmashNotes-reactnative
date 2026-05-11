---
name: ufd-scraper-pattern
description: Use when writing or modifying scrapers in scripts/ — adding a new data source from ultimateframedata.com, debugging broken selectors, or extending the GIF / frame data scrapers. Covers cheerio patterns, the lazy-load image gotcha, concurrency/throttling conventions, the SLUG_TO_NAME map duplication, and resumability.
---

# UFD Scraper Pattern Guide

The app has two scrapers in `scripts/`:

- **`scrapeFrameData.js`** — pulls text fields from ultimateframedata.com, writes `src/data/frameData.json`
- **`scrapeMoveGifs.js`** — pulls move GIFs, writes binaries + a manifest

They share patterns. New scrapers (forum posts, VOD listings, etc.) should follow these same conventions.

## Quick Decision Tree

| What you're doing | Where to go |
|---|---|
| Add a new field to the frame-data scrape | Edit `scrapeFrameData.js`, add to the `.movecontainer` extraction |
| Scrape something new from UFD | New script in `scripts/`, copy patterns below |
| Image selector returning nothing | Check `data-src` — UFD lazy-loads (see below) |
| Need to scrape from a non-UFD source | Cheerio + fetch still works; throttling pattern still applies |

## The Shared Patterns

### 1. The 89-Character `SLUG_TO_NAME` Map

Both scrapers have a (currently identical) copy. This is **tech debt** — when a new character is added (or UFD changes a slug), both files need to be updated.

If you're adding a third scraper, consider extracting this to `scripts/_smashFighters.js` and `require()`-ing it. Or just live with three copies until it bites.

### 2. Cheerio + `node-fetch` (built-in)

Modern Node has global `fetch` so no library needed:

```js
const cheerio = require("cheerio");

async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const html = await fetchPage(`https://ultimateframedata.com/${slug}`);
const $ = cheerio.load(html);
```

### 3. The Cheerio Selectors UFD Uses

Verified working (as of last check):

```js
const $catEl = $(`#${categoryId}`);                   // groundattacks, aerialattacks, etc.
const $movesDiv = $catEl.nextAll(".moves").first();   // SIBLING, not child
const $containers = $movesDiv.children(".movecontainer");

$containers.each((_, el) => {
  const $el = $(el);
  const moveName = $el.find(".movename").text().trim();
  const startup = $el.find(".startup").text().trim();
  // .activeframes, .totalframes, .baseDamage (note casing), .advantage, etc.
});
```

UFD uses single-word lowercase class names: `.movename`, `.startup`, `.activeframes`, `.totalframes`, `.landinglag`, `.basedamage`, `.advantage`, `.shieldlag`, `.shieldstun`, `.whichhitbox`, `.notes`.

### 4. The Lazy-Loaded Image Gotcha

UFD lazy-loads images. The first ~4 visible images have `src` populated; the rest only have `data-src` (loaded via JavaScript when the user scrolls them into view).

If your selector only checks `src`, you'll get 4 results per character and miss the rest.

**Correct pattern:**

```js
let gifSrc = null;
$el.find("img").each((_, img) => {
  if (gifSrc) return;
  const src = $(img).attr("src") || $(img).attr("data-src") || "";
  if (/\.gif(\?|$)/i.test(src)) {
    gifSrc = src;
  }
});
```

Always check **both** `src` and `data-src`. This was a real bug we fixed mid-development.

### 5. Concurrency + Throttling Convention

```js
const CONCURRENCY = 4;
const DELAY_MS = 500;

for (let i = 0; i < slugs.length; i += CONCURRENCY) {
  const batch = slugs.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(scrapeCharacter));
  if (i + CONCURRENCY < slugs.length) {
    await sleep(DELAY_MS);
  }
}
```

4 characters at a time, 500ms between batches. This is polite — UFD has never rate-limited us. If you scale to more sources, keep similar restraint.

```js
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
```

### 6. Resumability Pattern

For scrapers that download files (like `scrapeMoveGifs.js`), check if the file already exists before downloading:

```js
if (fs.existsSync(destPath)) {
  skipped++;
} else {
  await downloadGif(sourceUrl, destPath);
  downloaded++;
  await sleep(DELAY_MS);
}
```

This makes re-runs nearly instant — the second run only fetches new things. Crucial for development (you'll re-run dozens of times).

### 7. Manifest Pattern for Labeled Outputs

When scraping binary files, also write a JSON manifest with metadata:

```json
[
  {
    "character": "Bayonetta",
    "characterSlug": "bayonetta",
    "category": "groundattacks",
    "moveName": "Jab 1",
    "moveSlug": "jab-1",
    "filePath": "data/move-gifs/bayonetta/jab-1.gif",
    "sourceUrl": "https://ultimateframedata.com/hitboxes/bayonetta/BayonettaJab1.gif"
  },
  // ...
]
```

The manifest:
- Acts as an index for downstream consumers (UI rendering, ML training, etc.)
- Survives even if binary files are gitignored
- Is sortable / diffable in git when needed

**Write the manifest after every batch**, not just at the end. If the scraper crashes, you keep partial progress:

```js
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(sortedManifest, null, 2));
```

### 8. Filesystem-Safe Slugging

Move names contain parens, apostrophes, spaces — bad for filesystems:

```js
function slugifyMove(moveName) {
  return moveName
    .toLowerCase()
    .replace(/[()']/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
// "Up B (Witch Twist)" → "up-b-witch-twist"
```

Always slug for paths. Keep the original `moveName` in the manifest for human-readable labels.

### 9. Dedupe-Within-Character Pattern

A character page might have two moves with the same name (rare, but happens). Track used slugs and disambiguate:

```js
const usedSlugs = new Set();
let unique = moveSlug;
let n = 2;
while (usedSlugs.has(unique)) {
  unique = `${moveSlug}-${n++}`;
}
moveSlug = unique;
usedSlugs.add(moveSlug);
```

### 10. Logging Conventions

Print one line per major unit (character, file, etc.) for progress visibility:

```js
console.log(`[${done}/${total}] ${name}: ${moveCount} moves (downloaded ${dl}, skipped ${sk})`);
```

For errors, use `console.error` but **don't stop** — log and continue. Scrape what you can; the user re-runs to fill gaps.

```js
} catch (err) {
  console.error(`[${done}/${total}] FAILED ${slug}: ${err.message}`);
  return null;  // marker so the caller knows to skip aggregation
}
```

## Anti-Patterns to Avoid

- **Don't `fetch` without throttling.** Even though UFD doesn't rate-limit currently, hammering them is bad form and risks getting blocked.
- **Don't fail-fast on one bad character.** If `getCharacterPage('xyz')` returns 404, log it and move on. Don't crash the whole scrape.
- **Don't write the manifest only at the end.** A crash 95% through wastes hours.
- **Don't hardcode the output directory.** Use `path.join(__dirname, ..., 'data', '...')` so the script works regardless of cwd.
- **Don't `git add` the binary outputs.** Add `data/move-gifs/` (or similar) to `.gitignore`. Keep the manifest tracked.
- **Don't put scraping logic inside the app code.** Scrapers run at dev time only. The app reads pre-scraped files. This separation is intentional — keep `src/` free of scrape logic.

## Adding a New Scraper

Pattern checklist:

1. New file: `scripts/scrapeXyz.js`
2. Top-of-file comment: how to run, what it outputs
3. `require('cheerio')` and `require('fs')`
4. Constants: `BASE_URL`, `OUTPUT_PATH`, `CONCURRENCY = 4`, `DELAY_MS = 500`
5. `SLUG_TO_NAME` map if needed (copy from existing scraper for now)
6. `fetchPage(url)` helper
7. `sleep(ms)` helper
8. `scrapeOneThing(input)` async function — gets a list of items + a result count
9. `main()` async function — batched loop with concurrency + delay
10. `main().catch(err => { console.error('Fatal:', err); process.exit(1); })`
11. Add npm script in `package.json`: `"scrape:xyz": "node scripts/scrapeXyz.js"`
12. Gitignore output binaries; track manifest if applicable

## Storage Estimates

UFD's media is small. The GIF scrape (~3500 files) ends up around 1.5 GB. If you scrape larger binaries (full VODs, hi-res PDFs), be mindful — the project root is on the dev's main drive.

## When to Re-scrape

- Frame data: when UFD updates (rare — Smash Ultimate is in maintenance mode) or you discover a missing field
- GIFs: same, plus when UFD changes their image URLs
- Anything else: as needed

Don't re-scrape on a schedule. UFD doesn't change frequently, and re-scraping every CI run wastes bandwidth + risks getting blocked.
