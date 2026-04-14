/**
 * Server-side frame data query utilities for RAG context injection.
 * These functions prepare frame data as clean text for LLM prompts.
 */

const path = require('path');

let frameDataJson = {};
try {
  frameDataJson = require(path.join(__dirname, '..', 'src', 'data', 'frameData.json'));
} catch (e) {
  console.warn('[frameDataQuery] Failed to load frame data JSON:', e.message);
}

// Fighter name list for extraction from questions
const FIGHTER_NAMES = Object.keys(frameDataJson).sort();

// Lowercase lookup for fuzzy matching
const FIGHTER_LOOKUP = {};
for (const name of FIGHTER_NAMES) {
  FIGHTER_LOOKUP[name.toLowerCase()] = name;
}

// Common abbreviations and aliases
const ALIASES = {
  // Character aliases
  'dk': 'Donkey Kong',
  'diddy': 'Diddy Kong',
  'zss': 'Zero Suit Samus',
  'gnw': 'Mr. Game & Watch',
  'game and watch': 'Mr. Game & Watch',
  'gameandwatch': 'Mr. Game & Watch',
  'palu': 'Palutena',
  'bayo': 'Bayonetta',
  'ddd': 'King Dedede',
  'dedede': 'King Dedede',
  'krool': 'King K. Rool',
  'k rool': 'King K. Rool',
  'rob': 'R.O.B.',
  'rosa': 'Rosalina & Luma',
  'banjo': 'Banjo & Kazooie',
  'wft': 'Wii Fit Trainer',
  'mac': 'Little Mac',
  'doc': 'Dr. Mario',
  'pt': 'Pokemon Trainer',
  'minmin': 'Min Min',
  'min min': 'Min Min',
  'mythra': 'Pyra/Mythra',
  'pyra': 'Pyra/Mythra',
  'aegis': 'Pyra/Mythra',
  'bowser jr': 'Bowser Jr',
  'jr': 'Bowser Jr',
  'dark pit': 'Dark Pit',
  'dark samus': 'Dark Samus',
  'captain falcon': 'Captain Falcon',
  'falcon': 'Captain Falcon',
  'ice climbers': 'Ice Climbers',
  'icies': 'Ice Climbers',
  'mega man': 'Mega Man',
  'megaman': 'Mega Man',
  'meta knight': 'Meta Knight',
  'mk': 'Meta Knight',
  'mii brawler': 'Mii Brawler',
  'mii gunner': 'Mii Gunner',
  'mii sword': 'Mii Swordfighter',
  'young link': 'Young Link',
  'yink': 'Young Link',
  'toon link': 'Toon Link',
  'tink': 'Toon Link',
  'piranha plant': 'Piranha Plant',
  'plant': 'Piranha Plant',
};

// Move name aliases
const MOVE_ALIASES = {
  'nair': 'Neutral Air',
  'fair': 'Forward Air',
  'bair': 'Back Air',
  'uair': 'Up Air',
  'dair': 'Down Air',
  'ftilt': 'Forward Tilt',
  'utilt': 'Up Tilt',
  'dtilt': 'Down Tilt',
  'fsmash': 'Forward Smash',
  'f smash': 'Forward Smash',
  'usmash': 'Up Smash',
  'u smash': 'Up Smash',
  'dsmash': 'Down Smash',
  'd smash': 'Down Smash',
  'up b': 'Up Special',
  'down b': 'Down Special',
  'side b': 'Side Special',
  'neutral b': 'Neutral Special',
  'grab': 'Grab',
  'dash attack': 'Dash Attack',
  'dash': 'Dash Attack',
  'jab': 'Jab',
};

/**
 * Extract character names mentioned in a question.
 */
function extractCharacters(question) {
  const lower = question.toLowerCase();
  const found = new Set();

  // Check aliases first (longer phrases first to avoid partial matches)
  const sortedAliases = Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, realName] of sortedAliases) {
    if (lower.includes(alias)) {
      found.add(realName);
    }
  }

  // Check exact fighter names
  for (const name of FIGHTER_NAMES) {
    if (lower.includes(name.toLowerCase())) {
      found.add(name);
    }
  }

  return Array.from(found);
}

/**
 * Extract move names mentioned in a question.
 */
function extractMoves(question) {
  const lower = question.toLowerCase();
  const found = new Set();

  for (const [alias, realName] of Object.entries(MOVE_ALIASES)) {
    if (lower.includes(alias)) {
      found.add(realName);
    }
  }

  return Array.from(found);
}

/**
 * Get the first numeric value from slash-separated data.
 */
function primary(val) {
  if (!val || val === '--') return null;
  return val.split('/')[0].trim();
}

/**
 * Format all frame data for a character as clean text for LLM context.
 */
function getFrameDataContext(characterName) {
  const data = frameDataJson[characterName];
  if (!data) return null;

  let output = `FRAME DATA FOR ${characterName.toUpperCase()}:\n`;

  for (const cat of data.categories) {
    output += `\n${cat.label}:\n`;
    for (const move of cat.moves) {
      const parts = [`  ${move.moveName}:`];
      if (move.startup && move.startup !== '--') parts.push(`startup ${move.startup}`);
      if (move.activeFrames && move.activeFrames !== '--') parts.push(`active frames ${move.activeFrames}`);
      if (move.totalFrames && move.totalFrames !== '--') parts.push(`total ${move.totalFrames} frames`);
      if (move.baseDamage && move.baseDamage !== '--') parts.push(`damage ${move.baseDamage}%`);
      if (move.advantage && move.advantage !== '--') parts.push(`on shield ${move.advantage}`);
      if (move.landingLag && move.landingLag !== '--') parts.push(`landing lag ${move.landingLag}`);
      if (move.notes && move.notes !== '--') parts.push(`(${move.notes})`);
      output += parts.join(', ') + '\n';
    }
  }

  return output;
}

/**
 * Get frame data for specific moves of a character.
 */
function getMovesContext(characterName, moveNames) {
  const data = frameDataJson[characterName];
  if (!data) return null;

  const results = [];
  const searchTerms = moveNames.map(m => m.toLowerCase());

  for (const cat of data.categories) {
    for (const move of cat.moves) {
      const nameLower = move.moveName.toLowerCase();
      if (searchTerms.some(term => nameLower.includes(term.toLowerCase()))) {
        results.push({ ...move, categoryLabel: cat.label });
      }
    }
  }

  if (!results.length) return null;

  let output = `SPECIFIC MOVES FOR ${characterName.toUpperCase()}:\n`;
  for (const move of results) {
    output += `  ${move.moveName} (${move.categoryLabel}):\n`;
    if (move.startup && move.startup !== '--') output += `    Startup: ${move.startup} frames\n`;
    if (move.activeFrames && move.activeFrames !== '--') output += `    Active: frames ${move.activeFrames}\n`;
    if (move.totalFrames && move.totalFrames !== '--') output += `    Total Frames: ${move.totalFrames}\n`;
    if (move.baseDamage && move.baseDamage !== '--') output += `    Damage: ${move.baseDamage}%\n`;
    if (move.advantage && move.advantage !== '--') output += `    On Shield: ${move.advantage}\n`;
    if (move.landingLag && move.landingLag !== '--') output += `    Landing Lag: ${move.landingLag} frames\n`;
    if (move.shieldLag && move.shieldLag !== '--') output += `    Shield Lag: ${move.shieldLag} frames\n`;
    if (move.shieldStun && move.shieldStun !== '--') output += `    Shield Stun: ${move.shieldStun} frames\n`;
    if (move.whichHitbox && move.whichHitbox !== '--') output += `    Hitbox: ${move.whichHitbox}\n`;
    if (move.notes && move.notes !== '--') output += `    Notes: ${move.notes}\n`;
  }

  return output;
}

/**
 * Get a character's moves sorted by on-shield advantage (best to worst).
 * Includes all moves with on-shield data, not just "safe" ones.
 */
function getShieldAdvantageData(characterName) {
  const data = frameDataJson[characterName];
  if (!data) return null;

  const moves = [];
  for (const cat of data.categories) {
    for (const move of cat.moves) {
      if (move.advantage && move.advantage !== '--') {
        const val = parseInt(primary(move.advantage));
        if (!isNaN(val)) {
          moves.push({
            name: move.moveName,
            advantage: val,
            advantageRaw: move.advantage,
            category: cat.label,
            startup: move.startup,
            damage: move.baseDamage,
            landingLag: move.landingLag,
            totalFrames: move.totalFrames,
          });
        }
      }
    }
  }

  moves.sort((a, b) => b.advantage - a.advantage);

  let output = `${characterName.toUpperCase()}'S MOVES — ON SHIELD ADVANTAGE (sorted best to worst):\n`;
  for (const m of moves) {
    output += `  ${m.name}: on shield ${m.advantageRaw}`;
    if (m.landingLag && m.landingLag !== '--') output += `, landing lag ${m.landingLag}`;
    output += `, damage ${m.damage || '?'}%`;
    output += '\n';
  }

  return output;
}

/**
 * Get a character's best Out of Shield (OOS) options.
 * OOS options that bypass the 11-frame shield drop:
 *   - Up B OOS = up B startup frames (directly from shield)
 *   - Up Smash OOS = up smash startup frames (directly from shield)
 *   - Grab OOS = grab startup + 4 frames (shieldstun penalty)
 *   - Jump OOS + aerial = 3 frames jumpsquat + aerial startup
 * Regular shield drop + any move = 11 + move startup
 */
function getOOSOptions(characterName) {
  const data = frameDataJson[characterName];
  if (!data) return null;

  const options = [];

  for (const cat of data.categories) {
    for (const move of cat.moves) {
      const startupVal = parseInt(primary(move.startup));
      if (isNaN(startupVal)) continue;
      const nameLower = move.moveName.toLowerCase();

      // Up B (directly from shield — matches "Up B", "Up Special", "Up B (Witch Twist)", etc.)
      if (cat.category === 'specialattacks' && (nameLower.includes('up special') || nameLower.startsWith('up b'))) {
        options.push({ name: `Up B OOS (${move.moveName})`, move: move.moveName, frames: startupVal, calc: `${startupVal} frames (direct from shield)`, damage: move.baseDamage });
      }
      // Up Smash (directly from shield — matches "Up Smash", "Up Smash (move name)", etc.)
      if (nameLower.startsWith('up smash')) {
        options.push({ name: `Up Smash OOS (${move.moveName})`, move: move.moveName, frames: startupVal, calc: `${startupVal} frames (direct from shield)`, damage: move.baseDamage });
      }
      // Grab (+ 4 frame shieldstun penalty)
      if (nameLower === 'grab' || nameLower.includes('standing grab') || (cat.category === 'grabs' && nameLower.includes('grab'))) {
        options.push({ name: `Grab OOS`, move: move.moveName, frames: startupVal + 4, calc: `${startupVal} + 4 shieldstun = ${startupVal + 4} frames`, damage: '0' });
      }
      // Aerials (3 frame jumpsquat + startup)
      if (cat.category === 'aerialattacks') {
        const oosFrames = 3 + startupVal;
        options.push({ name: `${move.moveName} OOS`, move: move.moveName, frames: oosFrames, calc: `3 jumpsquat + ${startupVal} startup = ${oosFrames} frames`, damage: move.baseDamage });
      }
    }
  }

  options.sort((a, b) => a.frames - b.frames);

  let output = `${characterName.toUpperCase()}'S FASTEST OUT-OF-SHIELD (OOS) OPTIONS:\n`;
  output += `  (Shield drop = 11 frames. These options bypass shield drop.)\n`;
  for (const opt of options.slice(0, 12)) {
    output += `  ${opt.name}: ${opt.calc}, damage ${opt.damage || '?'}%\n`;
  }

  return output;
}

/**
 * Get fastest moves (lowest startup).
 */
function getFastestMoves(characterName) {
  const data = frameDataJson[characterName];
  if (!data) return null;

  const moves = [];
  for (const cat of data.categories) {
    for (const move of cat.moves) {
      if (move.startup && move.startup !== '--') {
        const val = parseInt(primary(move.startup));
        if (!isNaN(val)) {
          moves.push({
            name: move.moveName,
            startup: val,
            startupRaw: move.startup,
            category: cat.label,
            damage: move.baseDamage,
          });
        }
      }
    }
  }

  moves.sort((a, b) => a.startup - b.startup);
  const top10 = moves.slice(0, 10);

  let output = `FASTEST MOVES FOR ${characterName.toUpperCase()}:\n`;
  for (const m of top10) {
    output += `  ${m.name}: startup frame ${m.startupRaw}, damage ${m.damage || '?'}%\n`;
  }

  return output;
}

/**
 * Format user's matchup notes as context for the LLM.
 */
function formatNotesContext(notes, myCharacter, opponents) {
  if (!notes || !notes.length) return '';

  const relevant = notes.filter(note => {
    if (!note.sections) return false;
    // Match notes where the character or opponent is mentioned
    const charMatch = note.character === myCharacter;
    const oppMatch = opponents.some(opp =>
      note.opponent === opp || note.character === opp
    );
    return charMatch && oppMatch;
  });

  if (!relevant.length) return '';

  let output = '\nYOUR MATCHUP NOTES:\n';
  for (const note of relevant) {
    output += `\n${note.title || `${note.character} vs ${note.opponent}`}:\n`;
    const sections = note.sections || {};
    for (const [key, value] of Object.entries(sections)) {
      if (value && value.trim()) {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        output += `  ${label}: ${value.trim()}\n`;
      }
    }
  }

  return output;
}

/**
 * Detect question intent and gather all relevant context.
 * Always includes the user's own character data alongside opponent data.
 */
function buildContext(question, myCharacter, userNotes) {
  const characters = extractCharacters(question);
  const moves = extractMoves(question);
  const lower = question.toLowerCase();

  // If no characters found but user has a main, include their main
  if (!characters.length && myCharacter) {
    characters.push(myCharacter);
  }

  // Always ensure the user's character is included so the model has both sides
  const allCharsToFetch = new Set(characters);
  if (myCharacter) {
    allCharsToFetch.add(myCharacter);
  }

  let context = '';

  // Detect intent and gather appropriate data
  const isOOSQuestion = /oos|out of shield|o\.o\.s/i.test(lower);
  const isShieldSafetyQuestion = /safe.*(shield|block)|shield.*(safe|punish)|on shield|hit.*shield/i.test(lower);
  const isShieldQuestion = isOOSQuestion || isShieldSafetyQuestion || /shield|punish|block/i.test(lower);
  const isSpeedQuestion = /fast|quick|slow|startup|frame\s?\d/i.test(lower);
  const isMoveQuestion = moves.length > 0;

  for (const char of allCharsToFetch) {
    const isUserChar = char === myCharacter;
    const label = isUserChar ? `(YOUR CHARACTER)` : `(OPPONENT)`;

    if (isMoveQuestion) {
      const moveCtx = getMovesContext(char, moves);
      if (moveCtx) context += moveCtx + '\n';
    }

    if (isOOSQuestion) {
      // OOS question: always show the OOS options for the character being asked about
      const oosCtx = getOOSOptions(char);
      if (oosCtx) context += oosCtx + '\n';
    } else if (isShieldSafetyQuestion || isShieldQuestion) {
      if (isUserChar) {
        // "safe on shield against X" — show user's moves' on-shield advantage
        const shieldCtx = getShieldAdvantageData(char);
        if (shieldCtx) context += shieldCtx + '\n';
        // Also show user's OOS options for reference
        const oosCtx = getOOSOptions(char);
        if (oosCtx) context += oosCtx + '\n';
      } else {
        // Opponent: show their OOS options (what they can punish with)
        const oosCtx = getOOSOptions(char);
        if (oosCtx) context += oosCtx + '\n';
      }
    }

    if (isSpeedQuestion) {
      const fastCtx = getFastestMoves(char);
      if (fastCtx) context += fastCtx + '\n';
    }

    // Only include full frame data if we don't already have focused context.
    // Full frame data is huge and overwhelms small models — only include it
    // for general questions where no specific filtered data was provided.
    const hasFilteredData = isOOSQuestion || isShieldSafetyQuestion || isShieldQuestion || isSpeedQuestion || isMoveQuestion;
    if (!hasFilteredData) {
      const fullCtx = getFrameDataContext(char);
      if (fullCtx) {
        context += fullCtx.replace(
          `FRAME DATA FOR ${char.toUpperCase()}:`,
          `FRAME DATA FOR ${char.toUpperCase()} ${label}:`
        ) + '\n';
      }
    }
  }

  // Add user's matchup notes if available
  if (userNotes && myCharacter) {
    const notesCtx = formatNotesContext(userNotes, myCharacter, characters);
    if (notesCtx) context += notesCtx;
  }

  return { context, characters, moves };
}

module.exports = {
  extractCharacters,
  extractMoves,
  getFrameDataContext,
  getMovesContext,
  getShieldAdvantageData,
  getOOSOptions,
  getFastestMoves,
  formatNotesContext,
  buildContext,
  FIGHTER_NAMES,
};
