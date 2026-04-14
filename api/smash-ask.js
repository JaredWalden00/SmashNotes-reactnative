/**
 * Vercel serverless function for the RAG-powered Smash AI assistant.
 * Note: On Vercel, frame data is loaded from the bundled JSON.
 * For local dev, use the matching route in server/server.js instead.
 */

let frameDataJson = {};
try {
  frameDataJson = require('../src/data/frameData.json');
} catch (e) {
  console.warn('Failed to load frame data:', e.message);
}

const FIGHTER_NAMES = Object.keys(frameDataJson).sort();

const ALIASES = {
  'dk': 'Donkey Kong', 'diddy': 'Diddy Kong', 'zss': 'Zero Suit Samus',
  'gnw': 'Mr. Game & Watch', 'game and watch': 'Mr. Game & Watch',
  'palu': 'Palutena', 'bayo': 'Bayonetta', 'ddd': 'King Dedede',
  'dedede': 'King Dedede', 'krool': 'King K. Rool', 'k rool': 'King K. Rool',
  'rob': 'R.O.B.', 'rosa': 'Rosalina & Luma', 'banjo': 'Banjo & Kazooie',
  'wft': 'Wii Fit Trainer', 'mac': 'Little Mac', 'doc': 'Dr. Mario',
  'pt': 'Pokemon Trainer', 'minmin': 'Min Min', 'mythra': 'Pyra/Mythra',
  'pyra': 'Pyra/Mythra', 'aegis': 'Pyra/Mythra', 'falcon': 'Captain Falcon',
  'icies': 'Ice Climbers', 'megaman': 'Mega Man', 'mk': 'Meta Knight',
  'yink': 'Young Link', 'tink': 'Toon Link', 'plant': 'Piranha Plant',
};

function extractCharacters(question) {
  const lower = question.toLowerCase();
  const found = new Set();
  const sortedAliases = Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, realName] of sortedAliases) {
    if (lower.includes(alias)) found.add(realName);
  }
  for (const name of FIGHTER_NAMES) {
    if (lower.includes(name.toLowerCase())) found.add(name);
  }
  return Array.from(found);
}

function primary(val) {
  if (!val || val === '--') return null;
  return val.split('/')[0].trim();
}

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

function buildContext(question, myCharacter, userNotes) {
  const characters = extractCharacters(question);
  if (!characters.length && myCharacter) characters.push(myCharacter);

  let context = '';
  for (const char of characters) {
    const fullCtx = getFrameDataContext(char);
    if (fullCtx) context += fullCtx + '\n';
  }

  if (userNotes && myCharacter) {
    const relevant = (userNotes || []).filter(note =>
      note.sections && note.character === myCharacter &&
      characters.some(opp => note.opponent === opp)
    );
    if (relevant.length) {
      context += '\nYOUR MATCHUP NOTES:\n';
      for (const note of relevant) {
        context += `\n${note.title || `${note.character} vs ${note.opponent}`}:\n`;
        for (const [key, value] of Object.entries(note.sections || {})) {
          if (value && value.trim()) {
            context += `  ${key}: ${value.trim()}\n`;
          }
        }
      }
    }
  }

  return { context, characters };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, myCharacter, userNotes } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'No question provided' });
  }

  const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'smashnotes';

  const { context, characters } = buildContext(question, myCharacter, userNotes);

  const systemPrompt = `You are a competitive Super Smash Bros. Ultimate assistant. You help players improve by answering questions about frame data, matchups, and strategy.

The user plays: ${myCharacter || 'unknown character'}

PERSPECTIVE RULES — this is critical:
- Questions are ALWAYS from the user's perspective as a player of ${myCharacter || 'their character'}.
- "safe on shield against X" = which of the USER'S moves can hit X's shield without getting punished by X's OOS options
- "what can I punish from X" = X hits the user's shield, what OOS options can the user use to punish
- "fastest OOS option" = the user's out of shield options (user's character data)
- "how do I edgeguard X" = the user is edgeguarding X (X's recovery data + user's edgeguard tools)
- When the question mentions an opponent by name, the user wants to know how THEY should play against that opponent.

OUT OF SHIELD (OOS) MECHANICS — use these for all shield safety questions:
- Shield drop takes 11 frames. Most attacks require shield drop first (11 + move startup).
- These options BYPASS shield drop and are much faster:
  - Up B OOS = Up B startup frames (directly from shield, no drop needed)
  - Up Smash OOS = Up Smash startup frames (directly from shield)
  - Grab OOS = Grab startup + 4 frames (shieldstun penalty)
  - Aerial OOS = 3 frames jumpsquat + aerial startup frames
- A move is "safe on shield" if its on-shield disadvantage is LESS NEGATIVE than the opponent's fastest OOS option.
- The key formula: a move is safe if |on shield value| < opponent's fastest OOS startup.
- ALWAYS compare the user's move on-shield values against the opponent's fastest OOS options.

DATA RULES:
- ONLY cite frame numbers, damage values, and move data from the PROVIDED DATA below. Never guess.
- If the data doesn't contain the answer, say "I don't have data for that."
- When referencing moves, include key stats (startup, on shield, damage) so the player can verify.
- ALWAYS prefix move names with the character name (e.g., "${myCharacter || 'Your'}'s Back Air" or "Fox's Up Smash").
- If the user has matchup notes provided, reference their own notes when relevant.

FORMAT:
- Use markdown: **bold** for move names, bullet lists for multiple moves, ## headers for longer answers.
- Be concise and actionable — competitive players want quick answers they can use in-game.
- Do NOT add follow-up questions like "Do you want me to elaborate?" or "Want me to explain more?" — just give the answer.
- Do NOT confuse OOS (out of shield) terminology. OOS means the USER is shielding and punishing the OPPONENT's move. It does NOT mean hitting the opponent's shield.

${context || 'No specific frame data available for this question.'}`;

  try {
    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        options: { temperature: 0.3, num_predict: 2048 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `Ollama returned ${response.status}. Is Ollama running?` });
    }

    const data = await response.json();
    const answer = data.message?.content || 'No response generated.';
    return res.status(200).json({ answer, characters });
  } catch (err) {
    const isConnectionError = err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED';
    return res.status(500).json({
      error: isConnectionError
        ? 'Cannot connect to Ollama. Make sure Ollama is running.'
        : (err.message || 'Failed to generate answer')
    });
  }
}
