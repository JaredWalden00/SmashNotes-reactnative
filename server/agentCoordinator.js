/**
 * AI Pipeline Coordinator
 *
 * Primary: Claude API with tool use (reliable, grounded answers)
 * Fallback: Ollama multi-agent pipeline (works offline)
 */

const {
  extractCharacters,
  extractMoves,
  getFrameDataContext,
  getMovesContext,
  getShieldAdvantageData,
  getOOSOptions,
  getFastestMoves,
  formatNotesContext,
} = require('./frameDataQuery');

const { FrameDataAgent, ShieldAgent, SpeedAgent, NotesAgent, GeneralAgent } = require('./agents');

// ─── Claude Tool Definitions ─────────────────────────────────────
// These map 1:1 to functions in frameDataQuery.js.
// Claude reads the descriptions and decides which to call.

const CLAUDE_TOOLS = [
  {
    name: 'get_frame_data',
    description: 'Get the complete frame data for a character — all moves across all categories (ground attacks, aerials, specials, grabs, dodges) with startup, active frames, total frames, damage, on-shield advantage, landing lag, and notes. Use this for broad questions about a character or when you need to scan all their moves.',
    input_schema: {
      type: 'object',
      properties: {
        character: { type: 'string', description: 'Character name (e.g., "Fox", "Bayonetta", "Pyra/Mythra")' },
      },
      required: ['character'],
    },
  },
  {
    name: 'get_move_data',
    description: 'Look up detailed frame data for specific moves by name. Returns startup, active frames, total frames, damage, on-shield advantage, landing lag, shield lag, shield stun, hitbox info, and notes. Use this when the user asks about specific moves.',
    input_schema: {
      type: 'object',
      properties: {
        character: { type: 'string', description: 'Character name' },
        move_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Move names to look up (e.g., ["Forward Air", "Up Smash", "Neutral Air"]). Common aliases: nair=Neutral Air, fair=Forward Air, bair=Back Air, uair=Up Air, dair=Down Air, ftilt=Forward Tilt, utilt=Up Tilt, dtilt=Down Tilt, fsmash=Forward Smash, usmash=Up Smash, dsmash=Down Smash.',
        },
      },
      required: ['character', 'move_names'],
    },
  },
  {
    name: 'get_shield_data',
    description: "Get a character's moves sorted by on-shield advantage (best to worst). Shows which moves are safest when hitting an opponent's shield. Includes on-shield value, landing lag, and damage. Use this for questions about shield safety or shield pressure.",
    input_schema: {
      type: 'object',
      properties: {
        character: { type: 'string', description: 'Character name' },
      },
      required: ['character'],
    },
  },
  {
    name: 'get_oos_options',
    description: "Get a character's fastest out-of-shield (OOS) punish options. These bypass the 11-frame shield drop: Up B OOS (direct), Up Smash OOS (direct), Grab OOS (+4 frames), Aerials OOS (3f jumpsquat + startup). Returns options sorted by speed. Use this when asked about OOS options, what can punish moves on shield, or shield counterplay.",
    input_schema: {
      type: 'object',
      properties: {
        character: { type: 'string', description: 'Character name' },
      },
      required: ['character'],
    },
  },
  {
    name: 'get_fastest_moves',
    description: "Get a character's top 10 fastest moves by startup frames. Use this for questions about fastest options, frame speed, or quickest punishes.",
    input_schema: {
      type: 'object',
      properties: {
        character: { type: 'string', description: 'Character name' },
      },
      required: ['character'],
    },
  },
];

/**
 * Execute a tool call from Claude. Maps tool names to frameDataQuery functions.
 */
function executeSmashTool(toolName, input, myCharacter, userNotes) {
  switch (toolName) {
    case 'get_frame_data':
      return getFrameDataContext(input.character) || `No frame data found for "${input.character}".`;

    case 'get_move_data':
      return getMovesContext(input.character, input.move_names) || `No moves found matching ${input.move_names.join(', ')} for "${input.character}".`;

    case 'get_shield_data':
      return getShieldAdvantageData(input.character) || `No shield data found for "${input.character}".`;

    case 'get_oos_options':
      return getOOSOptions(input.character) || `No OOS data found for "${input.character}".`;

    case 'get_fastest_moves':
      return getFastestMoves(input.character) || `No speed data found for "${input.character}".`;

    default:
      return `Unknown tool: ${toolName}`;
  }
}

/**
 * Build the system prompt for Claude.
 */
function buildClaudeSystemPrompt(myCharacter) {
  return `You are a competitive Super Smash Bros. Ultimate assistant. The user plays ${myCharacter || 'an unknown character'}.

Use the provided tools to look up real frame data before answering. NEVER guess frame numbers — always call a tool first.

Key Smash mechanics you must know:
- Shield drop = 11 frames. Most attacks need shield drop first (11 + startup).
- Out of Shield (OOS) options bypass shield drop and are faster:
  - Up B OOS = Up B startup frames (direct from shield)
  - Up Smash OOS = Up Smash startup frames (direct from shield)
  - Grab OOS = Grab startup + 4 frames (shieldstun penalty)
  - Aerial OOS = 3 frames jumpsquat + aerial startup frames
- A move is "safe on shield" if |on-shield value| < opponent's fastest OOS startup.
  Example: A move at -4 on shield vs an opponent with 7f OOS = SAFE (4 < 7).
  Example: A move at -8 on shield vs an opponent with 7f OOS = NOT SAFE (8 > 7).
- OOS = the player IS IN shield and punishing. NOT hitting the opponent's shield.

When answering:
- Always state whose move (e.g., "Bayonetta's Back Air" not just "Back Air").
- Show the math when comparing frame data.
- Use markdown: **bold** move names, bullet lists, ## headers for longer answers.
- Be concise and actionable. No filler. No follow-up questions.`;
}

/**
 * Run the Claude API tool-use pipeline.
 *
 * Flow:
 * 1. Send question + tools to Claude
 * 2. If Claude returns tool_use → execute tools, send results back
 * 3. Repeat until Claude returns a text answer
 */
async function runClaudePipeline(question, myCharacter, userNotes, apiKey) {
  const systemPrompt = buildClaudeSystemPrompt(myCharacter);
  const messages = [{ role: 'user', content: question }];
  const toolsCalled = [];
  let loopCount = 0;
  const MAX_LOOPS = 5; // Safety limit

  while (loopCount < MAX_LOOPS) {
    loopCount++;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        tools: CLAUDE_TOOLS,
        messages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Claude API error');
    }

    // Check if Claude wants to use tools
    if (data.stop_reason === 'tool_use') {
      // Add Claude's response (which contains tool_use blocks) to messages
      messages.push({ role: 'assistant', content: data.content });

      // Execute each tool call
      const toolResults = [];
      for (const block of data.content) {
        if (block.type === 'tool_use') {
          console.log(`[Claude] Tool call: ${block.name}(${JSON.stringify(block.input)})`);
          toolsCalled.push(block.name);

          const result = executeSmashTool(block.name, block.input, myCharacter, userNotes);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Send tool results back to Claude
      messages.push({ role: 'user', content: toolResults });
    } else {
      // Claude returned a text answer — extract and return it
      const textBlocks = (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text);
      const answer = textBlocks.join('\n') || 'No response generated.';
      const characters = extractCharacters(question);

      return {
        answer,
        characters,
        tools: [...new Set(toolsCalled)],
        provider: 'claude',
        loops: loopCount,
      };
    }
  }

  throw new Error('Claude tool-use loop exceeded maximum iterations');
}


// ─── Ollama Fallback Pipeline ────────────────────────────────────

const ALL_AGENTS = {
  'frame-data': FrameDataAgent,
  'shield-oos': ShieldAgent,
  'speed': SpeedAgent,
  'matchup-notes': NotesAgent,
  'general': GeneralAgent,
};

function fallbackSelectAgents(question) {
  const lower = question.toLowerCase();
  const agents = [];
  if (/oos|out of shield|o\.o\.s/i.test(lower)) agents.push('speed');
  if (/shield|safe.*on|on.*shield|punish|block/i.test(lower) && !agents.includes('speed')) agents.push('shield-oos');
  if (/fast|quick|slow|startup|frame\s?\d/i.test(lower) && !agents.includes('speed')) agents.push('speed');
  if (extractMoves(question).length > 0) agents.push('frame-data');
  if (/matchup|match up|vs|versus|against|mu\b|notes|wrote|remember/i.test(lower)) agents.push('matchup-notes');
  if (agents.length === 0) agents.push('general');
  return agents;
}

/**
 * Ollama single-call fallback (used when Claude API is unavailable).
 */
function runOllamaFallback(question, myCharacter, userNotes) {
  const characters = extractCharacters(question);
  const moves = extractMoves(question);
  if (!characters.length && myCharacter) characters.push(myCharacter);

  const agents = fallbackSelectAgents(question);
  let combinedData = '';

  for (const agentName of agents) {
    const agent = ALL_AGENTS[agentName];
    if (!agent) continue;
    let data = null;
    switch (agentName) {
      case 'frame-data': data = agent.getData(characters, moves); break;
      case 'shield-oos': data = agent.getData(characters, myCharacter); break;
      case 'speed': data = agent.getData(characters); break;
      case 'matchup-notes': data = agent.getData(characters, myCharacter, userNotes); break;
      case 'general': data = agent.getData(characters); break;
    }
    if (data) combinedData += data + '\n';
  }

  const primaryAgent = ALL_AGENTS[agents[0]] || GeneralAgent;
  const systemPrompt = `${primaryAgent.getPrompt(myCharacter)}\n\n${combinedData || 'No data available.'}`;

  return { systemPrompt, agents, characters, context: combinedData };
}

module.exports = {
  runClaudePipeline,
  runOllamaFallback,
  CLAUDE_TOOLS,
  executeSmashTool,
};
