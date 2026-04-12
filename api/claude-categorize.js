export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, myCharacter } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  // Clean Discord copy-paste noise before sending to the model
  function cleanDiscordText(raw) {
    return raw
      .split('\n')
      .map(line => line.trim())
      // Remove Discord UI artifacts
      .filter(line => {
        if (!line) return false;
        // Emoji reactions and UI buttons
        if (/^:(thumbsup|fire|sob|heart|eyes|100):$/i.test(line)) return false;
        if (/^(Click to react|Add Reaction|Edit|Forward|More|Delete|Download)$/i.test(line)) return false;
        // "Image failed to load" or standalone "Image"
        if (/^Image(?: failed to load\.?)?$/i.test(line)) return false;
        // Bare timestamps like "[2:50 PM]Thursday, August 8, 2024 2:50 PM"
        if (/^\[?\d{1,2}:\d{2}\s*(AM|PM)\]?\s*(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/i.test(line)) return false;
        // Duplicate long-form timestamps appended to usernames: "TrueDingus — 1/2/2023 1:48 PMMonday, January 2, 2023 1:48 PM"
        // Clean these to just "TrueDingus — 1/2/2023 1:48 PM"
        // (handled below in transform, keep line)
        // Pure URLs with no surrounding text
        if (/^https?:\/\/\S+$/i.test(line)) return false;
        // Twitter/YouTube embeds metadata
        if (/^(Twitter|YouTube)•/i.test(line)) return false;
        if (/^Likes$/i.test(line)) return false;
        if (/^\d+$/.test(line)) return false; // bare numbers (like counts)
        // "Edit Channel"
        if (/^Edit Channel$/i.test(line)) return false;
        // Bare month/date headers "January 2, 2023", "August 8, 2024"
        if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/i.test(line)) return false;
        return true;
      })
      .map(line => {
        // Clean duplicate timestamps from username lines
        // "TrueDingus — 1/2/2023 1:48 PMMonday, January 2, 2023 1:48 PM" -> "TrueDingus — 1/2/2023 1:48 PM"
        line = line.replace(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}\s*\d{1,2}:\d{2}\s*(?:AM|PM)/i, '$1');
        // Remove "(edited)" markers
        line = line.replace(/\s*\(edited\)\s*/gi, ' ').trim();
        return line;
      })
      .filter(line => line.length > 0)
      .join('\n');
  }

  const cleanedText = cleanDiscordText(text);

  const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'smashnotes';

  const VALID_FIGHTERS = [
    "Banjo & Kazooie","Bayonetta","Bowser","Bowser Jr","Byleth","Captain Falcon",
    "Charizard","Chrom","Cloud","Corrin","Daisy","Dark Pit","Dark Samus",
    "Diddy Kong","Donkey Kong","Dr. Mario","Duck Hunt","Falco","Fox","Ganondorf",
    "Greninja","Hero","Ice Climbers","Ike","Incineroar","Inkling","Isabelle",
    "Ivysaur","Jigglypuff","Joker","Kazuya","Ken","King Dedede","King K. Rool",
    "Kirby","Link","Little Mac","Lucario","Lucas","Lucina","Luigi","Mario",
    "Marth","Mega Man","Meta Knight","Mewtwo","Mii Brawler","Mii Gunner",
    "Mii Swordfighter","Min Min","Mr. Game & Watch","Ness","Olimar","Pac-Man",
    "Palutena","Peach","Pichu","Pikachu","Piranha Plant","Pit","Pokemon Trainer",
    "Pyra/Mythra","R.O.B.","Richter","Ridley","Robin","Rosalina & Luma","Roy",
    "Ryu","Samus","Sephiroth","Sheik","Shulk","Simon","Snake","Sonic","Sora",
    "Squirtle","Steve","Terry","Toon Link","Villager","Wario","Wii Fit Trainer",
    "Wolf","Yoshi","Young Link","Zelda","Zero Suit Samus"
  ];

  const systemPrompt = `You organize Super Smash Bros. Ultimate gameplay notes into JSON.

The user plays: ${myCharacter || "unknown"}
The user does NOT play as the opponent. The "opponent" field is who they are fighting AGAINST, NOT their own character.

STEP 1: IDENTIFY OPPONENTS
The text contains sections separated by channel headers like "the #fox channel" or "the #steve channel" or "#mythra channel".
The channel name IS the opponent character. Map it to the closest match from this list:
${VALID_FIGHTERS.join(", ")}

IMPORTANT MAPPINGS:
- #mythra or #pyra -> "Pyra/Mythra"
- #fox -> "Fox"
- #steve -> "Steve"
- #chrom -> "Chrom"
- #dk or #donkey kong -> "Donkey Kong"
The opponent CAN be "${myCharacter}" (mirror match). Identify opponents from channel names, not from the user's character.

STEP 2: GROUP ALL NOTES BY OPPONENT
All notes under a channel header belong to that ONE opponent. Create exactly ONE object per opponent.
Do NOT split one opponent's notes into multiple objects.

STEP 3: CATEGORIZE EACH NOTE into one section:
- "overview": General game plan, mindset, high-level strategy
- "neutral": Spacing, approach, whiff punishing, grounded interactions, anti-air, movement
- "advantage": Combos, juggles, edgeguards, ledgetrapping, kill confirms, tech chases, offstage
- "disadvantage": Landing, recovery, escaping pressure, defensive options
- "stageNotes": Stage-specific tips, platform play
- "reminders": Quick reminders, habits to break, mental notes

STEP 4: DEDUPLICATE — if the same note appears twice, include it only once.

STEP 5: FORMAT each note as a bullet starting with "- ". Combine all notes in a section with newlines.

Skip empty messages, links/URLs, images, and tweets — only include actual gameplay tips.

EXAMPLE:
If input has "#fox channel" with notes about combos and spacing, and "#mario channel" with notes about edgeguarding:

{"notes":[{"opponent":"Fox","sections":{"overview":"","neutral":"- spacing note here","advantage":"- combo note here","disadvantage":"","stageNotes":"","reminders":""}},{"opponent":"Mario","sections":{"overview":"","neutral":"","advantage":"- edgeguard note here","disadvantage":"","stageNotes":"","reminders":""}}]}

Return ONLY valid JSON. No markdown. No code fences. No explanation.`;

  try {
    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here are the raw notes to categorize:\n\n${cleanedText}` },
        ],
        options: {
          temperature: 0.3,
          num_predict: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Ollama error:', response.status, errText);
      return res.status(502).json({
        error: `Ollama returned ${response.status}. Is Ollama running with the ${OLLAMA_MODEL} model pulled?`
      });
    }

    const data = await response.json();
    const rawContent = data.message?.content || '';

    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      // Try to extract JSON from the response if it has extra text or markdown fences
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // fall through
        }
      }
      if (!parsed) {
        console.error('Failed to parse Ollama response as JSON:', rawContent);
        return res.status(500).json({ error: 'AI returned invalid format. Please try again.' });
      }
    }

    // Post-process: clean up what the model returns
    if (parsed.notes && Array.isArray(parsed.notes)) {
      // 1. Filter out notes where opponent matches the user's own character
      if (myCharacter) {
        const myCharLower = myCharacter.toLowerCase();
        parsed.notes = parsed.notes.filter(n =>
          n.opponent && n.opponent.toLowerCase() !== myCharLower
        );
      }

      // 2. Merge duplicate opponents into one
      const merged = {};
      for (const note of parsed.notes) {
        const key = (note.opponent || '').toLowerCase();
        if (!merged[key]) {
          merged[key] = { opponent: note.opponent, sections: { ...note.sections } };
        } else {
          // Append each section's content
          for (const [sectionKey, content] of Object.entries(note.sections || {})) {
            if (!content || !content.trim()) continue;
            const existing = merged[key].sections[sectionKey] || '';
            if (existing) {
              // Avoid appending exact duplicates
              const existingLines = new Set(existing.split('\n').map(l => l.trim().toLowerCase()));
              const newLines = content.split('\n').filter(l =>
                l.trim() && !existingLines.has(l.trim().toLowerCase())
              );
              if (newLines.length) {
                merged[key].sections[sectionKey] = existing + '\n' + newLines.join('\n');
              }
            } else {
              merged[key].sections[sectionKey] = content;
            }
          }
        }
      }
      parsed.notes = Object.values(merged);
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Ollama request failed:', err);
    const isConnectionError = err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED';
    return res.status(500).json({
      error: isConnectionError
        ? 'Cannot connect to Ollama. Make sure Ollama is running (ollama serve).'
        : (err.message || 'Failed to categorize notes')
    });
  }
}
