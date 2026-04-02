/**
 * Scrapes frame data from ultimateframedata.com for all Smash Ultimate characters.
 * Run: node scripts/scrapeFrameData.js
 * Output: src/data/frameData.json
 */
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://ultimateframedata.com";
const OUTPUT_PATH = path.join(__dirname, "..", "src", "data", "frameData.json");
const CONCURRENCY = 4;
const DELAY_MS = 500;

// Map UFD slugs to app fighter names
const SLUG_TO_NAME = {
  banjo_and_kazooie: "Banjo & Kazooie",
  bayonetta: "Bayonetta",
  bowser: "Bowser",
  bowser_jr: "Bowser Jr",
  byleth: "Byleth",
  captain_falcon: "Captain Falcon",
  chrom: "Chrom",
  cloud: "Cloud",
  corrin: "Corrin",
  daisy: "Daisy",
  dark_pit: "Dark Pit",
  dark_samus: "Dark Samus",
  diddy_kong: "Diddy Kong",
  donkey_kong: "Donkey Kong",
  dr_mario: "Dr. Mario",
  duck_hunt: "Duck Hunt",
  falco: "Falco",
  fox: "Fox",
  ganondorf: "Ganondorf",
  greninja: "Greninja",
  hero: "Hero",
  ice_climbers: "Ice Climbers",
  ike: "Ike",
  incineroar: "Incineroar",
  inkling: "Inkling",
  isabelle: "Isabelle",
  jigglypuff: "Jigglypuff",
  joker: "Joker",
  kazuya: "Kazuya",
  ken: "Ken",
  king_dedede: "King Dedede",
  king_k_rool: "King K. Rool",
  kirby: "Kirby",
  link: "Link",
  little_mac: "Little Mac",
  lucario: "Lucario",
  lucas: "Lucas",
  lucina: "Lucina",
  luigi: "Luigi",
  mario: "Mario",
  marth: "Marth",
  mega_man: "Mega Man",
  meta_knight: "Meta Knight",
  mewtwo: "Mewtwo",
  mii_brawler: "Mii Brawler",
  mii_gunner: "Mii Gunner",
  mii_swordfighter: "Mii Swordfighter",
  minmin: "Min Min",
  mr_game_and_watch: "Mr. Game and Watch",
  mythra: "Mythra",
  ness: "Ness",
  olimar: "Olimar",
  pac_man: "Pac-Man",
  palutena: "Palutena",
  peach: "Peach",
  pichu: "Pichu",
  pikachu: "Pikachu",
  piranha_plant: "Piranha Plant",
  pit: "Pit",
  pt_squirtle: "Squirtle",
  pt_ivysaur: "Ivysaur",
  pt_charizard: "Charizard",
  pyra: "Pyra",
  richter: "Richter",
  ridley: "Ridley",
  rob: "R.O.B.",
  robin: "Robin",
  rosalina_and_luma: "Rosalina & Luma",
  roy: "Roy",
  ryu: "Ryu",
  samus: "Samus",
  sephiroth: "Sephiroth",
  sheik: "Sheik",
  shulk: "Shulk",
  simon: "Simon",
  snake: "Snake",
  sonic: "Sonic",
  sora: "Sora",
  steve: "Steve",
  terry: "Terry",
  toon_link: "Toon Link",
  villager: "Villager",
  wario: "Wario",
  wii_fit_trainer: "Wii Fit Trainer",
  wolf: "Wolf",
  yoshi: "Yoshi",
  young_link: "Young Link",
  zelda: "Zelda",
  zero_suit_samus: "Zero Suit Samus",
};

const CATEGORIES = ["groundattacks", "aerialattacks", "specialattacks", "grabs", "dodges"];
const CATEGORY_LABELS = {
  groundattacks: "Ground Attacks",
  aerialattacks: "Aerial Attacks",
  specialattacks: "Special Attacks",
  grabs: "Grabs & Throws",
  dodges: "Dodges & Rolls",
};

function clean(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function scrapeCharacter(slug) {
  const url = `${BASE_URL}/${slug}`;
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const categories = [];

  for (const catId of CATEGORIES) {
    const moves = [];
    const catEl = $(`#${catId}`);
    if (!catEl.length) continue;

    // Structure: H2#category → ... → DIV.moves (next .moves sibling) → .movecontainer children
    const movesDiv = catEl.nextAll(".moves").first();
    movesDiv.children(".movecontainer").each((_, el) => {
      const $el = $(el);
      const moveName = clean($el.find(".movename").text());
      if (!moveName) return;

      moves.push({
        moveName,
        startup: clean($el.find(".startup").text()),
        activeFrames: clean($el.find(".activeframes").text()),
        totalFrames: clean($el.find(".totalframes").text()),
        landingLag: clean($el.find(".landinglag").text()),
        baseDamage: clean($el.find(".basedamage").text()),
        advantage: clean($el.find(".advantage").text()),
        shieldLag: clean($el.find(".shieldlag").text()),
        shieldStun: clean($el.find(".shieldstun").text()),
        whichHitbox: clean($el.find(".whichhitbox").text()),
        notes: clean($el.find(".notes").text()),
      });
    });

    if (moves.length > 0) {
      categories.push({
        category: catId,
        label: CATEGORY_LABELS[catId] || catId,
        moves,
      });
    }
  }

  return categories;
}

async function scrapeCharacterList() {
  const html = await fetchPage(`${BASE_URL}/smash`);
  const $ = cheerio.load(html);
  const slugs = [];
  $("#charList a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    // Skip non-character links like "stats"
    const slug = href.replace(/^\//, "").replace(/\/$/, "");
    if (slug && slug !== "stats" && !slug.includes("/") && SLUG_TO_NAME[slug]) {
      slugs.push(slug);
    }
  });
  return slugs;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Fetching character list...");
  let slugs;
  try {
    slugs = await scrapeCharacterList();
  } catch (e) {
    console.log("Could not fetch character list, using built-in slug map...");
    slugs = Object.keys(SLUG_TO_NAME);
  }
  console.log(`Found ${slugs.length} characters\n`);

  const allData = {};
  let done = 0;

  // Process in batches
  for (let i = 0; i < slugs.length; i += CONCURRENCY) {
    const batch = slugs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (slug) => {
        try {
          const categories = await scrapeCharacter(slug);
          const name = SLUG_TO_NAME[slug] || slug;
          const moveCount = categories.reduce((sum, c) => sum + c.moves.length, 0);
          done++;
          console.log(`[${done}/${slugs.length}] ${name}: ${moveCount} moves`);
          return { slug, name, categories };
        } catch (err) {
          done++;
          console.error(`[${done}/${slugs.length}] FAILED ${slug}: ${err.message}`);
          return null;
        }
      })
    );

    for (const result of results) {
      if (result) {
        allData[result.name] = {
          name: result.name,
          slug: result.slug,
          categories: result.categories,
        };
      }
    }

    if (i + CONCURRENCY < slugs.length) {
      await sleep(DELAY_MS);
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allData, null, 2));
  console.log(`\nDone! Wrote ${Object.keys(allData).length} characters to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
