/**
 * Specialized agents for Smash Bros. knowledge.
 * Each agent has:
 *   - a focused data retrieval function (deterministic, no AI)
 *   - a focused prompt (small enough for Gemma to handle)
 *   - a single responsibility
 *
 * The coordinator calls the right agents and combines their outputs.
 */

const {
  getFrameDataContext,
  getMovesContext,
  getShieldAdvantageData,
  getOOSOptions,
  getFastestMoves,
  formatNotesContext,
  extractCharacters,
  extractMoves,
} = require('./frameDataQuery');

// ─── AGENT: Frame Data ───────────────────────────────────────────
// Retrieves and summarizes raw frame data for specific moves or characters.
const FrameDataAgent = {
  name: 'frame-data',

  /** Gather data this agent needs */
  getData(characters, moves) {
    let data = '';
    for (const char of characters) {
      if (moves.length) {
        const moveCtx = getMovesContext(char, moves);
        if (moveCtx) data += moveCtx + '\n';
      } else {
        const fullCtx = getFrameDataContext(char);
        if (fullCtx) data += fullCtx + '\n';
      }
    }
    return data || null;
  },

  /** Focused prompt for this agent */
  getPrompt(myCharacter) {
    return `You are a frame data specialist for Super Smash Bros. Ultimate.
Your ONLY job is to read the provided frame data and present it clearly.
- Cite exact numbers from the data. NEVER guess or invent frame numbers.
- Use markdown: **bold** move names, bullet lists.
- Be concise. No filler text. No follow-up questions.
- Always state whose move it is (e.g., "${myCharacter}'s Forward Air").`;
  },
};

// ─── AGENT: Shield & OOS ─────────────────────────────────────────
// Handles all shield safety and out-of-shield questions.
const ShieldAgent = {
  name: 'shield-oos',

  getData(characters, myCharacter) {
    let data = '';

    // User's character: their moves' on-shield values
    if (myCharacter) {
      const shieldCtx = getShieldAdvantageData(myCharacter);
      if (shieldCtx) data += shieldCtx + '\n';
      const myOOS = getOOSOptions(myCharacter);
      if (myOOS) data += myOOS + '\n';
    }

    // Opponents: their OOS options
    for (const char of characters) {
      if (char !== myCharacter) {
        const oosCtx = getOOSOptions(char);
        if (oosCtx) data += oosCtx + '\n';
      }
    }

    return data || null;
  },

  getPrompt(myCharacter) {
    return `You are a shield mechanics specialist for Super Smash Bros. Ultimate.
The user plays: ${myCharacter || 'unknown'}

KEY MECHANICS you must use for every answer:
- Shield drop = 11 frames. Most attacks need shield drop first (11 + startup).
- These bypass shield drop (much faster):
  - Up B OOS = Up B startup frames (direct from shield)
  - Up Smash OOS = Up Smash startup frames (direct from shield)
  - Grab OOS = Grab startup + 4 frames
  - Aerial OOS = 3 frames jumpsquat + aerial startup
- A move is "safe on shield" when |on-shield value| < opponent's fastest OOS.
  If ${myCharacter}'s move is -4 and opponent's fastest OOS is 7 frames, it IS safe (4 < 7).
  If ${myCharacter}'s move is -8 and opponent's fastest OOS is 7 frames, NOT safe (8 > 7).
- OOS = user is IN shield, punishing the opponent. NOT hitting the opponent's shield.
- "Safe on shield against X" = which of ${myCharacter}'s moves can hit X's shield without being punished.

RULES:
- ONLY cite numbers from the provided data. Never guess.
- Show the math: "Back Air (-4) vs Fox's nair OOS (7f) = safe, 4 < 7"
- Use markdown. Be concise. No follow-up questions.`;
  },
};

// ─── AGENT: Speed / Fastest Moves ────────────────────────────────
const SpeedAgent = {
  name: 'speed',

  getData(characters) {
    let data = '';
    for (const char of characters) {
      const fastCtx = getFastestMoves(char);
      if (fastCtx) data += fastCtx + '\n';
      const oosCtx = getOOSOptions(char);
      if (oosCtx) data += oosCtx + '\n';
    }
    return data || null;
  },

  getPrompt(myCharacter) {
    return `You are a speed/frame advantage specialist for Super Smash Bros. Ultimate.
The user plays: ${myCharacter || 'unknown'}

OOS (Out of Shield) MECHANICS:
- Shield drop = 11 frames.
- Up B OOS = Up B startup (direct from shield, bypasses shield drop)
- Up Smash OOS = Up Smash startup (direct from shield)
- Grab OOS = Grab startup + 4 frames
- Aerial OOS = 3 frames jumpsquat + aerial startup
- When asked about "fastest OOS", list these options sorted by total frames.
- OOS means the user is IN shield and wants to punish. Not hitting opponent's shield.

RULES:
- ONLY cite numbers from the provided data. Never guess.
- Use markdown. Be concise. No follow-up questions.
- Always state whose move (e.g., "${myCharacter}'s Up B OOS").`;
  },
};

// ─── AGENT: Matchup Notes ────────────────────────────────────────
const NotesAgent = {
  name: 'matchup-notes',

  getData(characters, myCharacter, userNotes) {
    if (!userNotes || !myCharacter) return null;
    const notesCtx = formatNotesContext(userNotes, myCharacter, characters);
    return notesCtx || null;
  },

  getPrompt(myCharacter) {
    return `You are a matchup notes assistant for Super Smash Bros. Ultimate.
The user plays: ${myCharacter || 'unknown'}
You have access to the user's personal matchup notes.
- Reference specific notes when answering.
- Keep the user's original voice/phrasing when quoting their notes.
- Use markdown. Be concise. No follow-up questions.`;
  },
};

// ─── AGENT: General Strategy ─────────────────────────────────────
const GeneralAgent = {
  name: 'general',

  getData(characters) {
    let data = '';
    for (const char of characters) {
      const fullCtx = getFrameDataContext(char);
      if (fullCtx) data += fullCtx + '\n';
    }
    return data || null;
  },

  getPrompt(myCharacter) {
    return `You are a competitive Super Smash Bros. Ultimate assistant.
The user plays: ${myCharacter || 'unknown'}

RULES:
- ONLY cite numbers from the provided data. Never guess frame numbers.
- If the data doesn't have the answer, say so.
- Always state whose move (e.g., "${myCharacter}'s Back Air").
- Use markdown. Be concise. No follow-up questions.`;
  },
};

module.exports = {
  FrameDataAgent,
  ShieldAgent,
  SpeedAgent,
  NotesAgent,
  GeneralAgent,
};
