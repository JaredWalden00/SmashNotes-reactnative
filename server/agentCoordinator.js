/**
 * Multi-Agent Coordinator
 *
 * Full pipeline with independent AI-powered agents:
 *
 * Step 1: COORDINATOR (Ollama call #1)
 *   - AI reads the question and decides which agents to activate
 *   - Returns structured JSON: { agents: ["shield-oos", "speed"], characters: ["Fox"] }
 *
 * Step 2: SPECIALIST AGENTS (Ollama calls #2-N, in parallel)
 *   - Each agent gets its own focused data + prompt
 *   - Each agent independently reasons about its domain
 *   - Returns its own analysis
 *
 * Step 3: SYNTHESIZER (Ollama call #N+1)
 *   - Receives all agent outputs
 *   - Combines them into one coherent answer
 *   - Resolves conflicts between agents
 */

const { extractCharacters, extractMoves } = require('./frameDataQuery');
const { FrameDataAgent, ShieldAgent, SpeedAgent, NotesAgent, GeneralAgent } = require('./agents');

const ALL_AGENTS = {
  'frame-data': FrameDataAgent,
  'shield-oos': ShieldAgent,
  'speed': SpeedAgent,
  'matchup-notes': NotesAgent,
  'general': GeneralAgent,
};

/**
 * Helper to call Ollama.
 */
async function callOllama(ollamaBase, model, systemPrompt, userMessage) {
  const response = await fetch(`${ollamaBase}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      options: { temperature: 0.2, num_predict: 1024 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = await response.json();
  let content = data.message?.content || '';
  // Clean garbled leading text
  content = content.replace(/^[^\w#*\-•>\[{]+/, '').trim();
  return content;
}

/**
 * Step 1: Coordinator — AI decides which agents to use.
 * Falls back to deterministic selection if AI fails.
 */
async function coordinatorStep(question, ollamaBase, model) {
  const prompt = `You are a question router for a Smash Bros. assistant. Given a question, decide which specialist agents should handle it.

Available agents:
- "frame-data": For questions about specific moves, startup frames, damage, active frames, total frames
- "shield-oos": For questions about shield safety, out of shield options, what's punishable, on-shield advantage
- "speed": For questions about fastest moves, fastest OOS options, frame speed comparisons
- "matchup-notes": For questions referencing the user's personal notes, or matchup strategy
- "general": For broad strategy questions, game plan, neutral game, advantage state

Return ONLY a JSON object like: {"agents":["shield-oos","speed"],"reason":"asking about safe shield options which needs shield data and speed comparison"}

Pick 1-3 agents. Pick the most relevant ones. Always pick "general" if no other agent fits.`;

  try {
    const raw = await callOllama(ollamaBase, model, prompt, question);
    // Try to parse JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.agents && Array.isArray(parsed.agents)) {
        // Validate agent names
        const validAgents = parsed.agents.filter(a => ALL_AGENTS[a]);
        if (validAgents.length > 0) {
          return { agents: validAgents, reason: parsed.reason || '', source: 'ai' };
        }
      }
    }
  } catch (e) {
    console.log('[Coordinator] AI routing failed, using fallback:', e.message);
  }

  // Fallback: deterministic selection
  return { agents: fallbackSelectAgents(question), reason: 'fallback routing', source: 'fallback' };
}

/**
 * Deterministic fallback for agent selection.
 */
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
 * Step 2: Run each specialist agent in parallel.
 * Each agent gets its own Ollama call with focused data + prompt.
 */
async function runSpecialistAgents(agentNames, question, characters, moves, myCharacter, userNotes, ollamaBase, model) {
  const tasks = agentNames.map(async (agentName) => {
    const agent = ALL_AGENTS[agentName];
    if (!agent) return { agent: agentName, result: null };

    // Get this agent's data
    let data = null;
    switch (agentName) {
      case 'frame-data':
        data = agent.getData(characters, moves);
        break;
      case 'shield-oos':
        data = agent.getData(characters, myCharacter);
        break;
      case 'speed':
        data = agent.getData(characters);
        break;
      case 'matchup-notes':
        data = agent.getData(characters, myCharacter, userNotes);
        break;
      case 'general':
        data = agent.getData(characters);
        break;
    }

    if (!data) return { agent: agentName, result: `No ${agentName} data found for the given characters.` };

    // Each agent gets its own focused prompt + data + Ollama call
    const agentPrompt = `${agent.getPrompt(myCharacter)}\n\n${data}`;
    try {
      const result = await callOllama(ollamaBase, model, agentPrompt, question);
      return { agent: agentName, result };
    } catch (e) {
      return { agent: agentName, result: `Agent error: ${e.message}` };
    }
  });

  // Run all agents in parallel
  return Promise.all(tasks);
}

/**
 * Step 3: Synthesizer — combines all agent outputs into one answer.
 */
async function synthesize(question, agentResults, myCharacter, ollamaBase, model) {
  // If only one agent responded, just return its result directly
  const validResults = agentResults.filter(r => r.result && !r.result.startsWith('Agent error') && !r.result.startsWith('No '));
  if (validResults.length === 1) {
    return validResults[0].result;
  }
  if (validResults.length === 0) {
    return "I don't have enough data to answer that question. Try mentioning a specific character or move.";
  }

  // Multiple agents — synthesize
  let agentOutputs = '';
  for (const { agent, result } of validResults) {
    agentOutputs += `\n--- ${agent.toUpperCase()} AGENT ANALYSIS ---\n${result}\n`;
  }

  const synthPrompt = `You are a synthesizer for a Smash Bros. assistant. Multiple specialist agents have analyzed a question independently. Your job is to combine their findings into one clear, coherent answer.

The user plays: ${myCharacter || 'unknown'}

RULES:
- Combine the agents' analyses — don't repeat information, merge it.
- If agents disagree, note both perspectives.
- Use markdown: **bold** move names, bullet lists, ## headers.
- Be concise. No follow-up questions. No filler.
- Cite exact frame numbers from the agent analyses.
- Always state whose move it is.

AGENT ANALYSES:
${agentOutputs}`;

  try {
    return await callOllama(ollamaBase, model, synthPrompt, question);
  } catch (e) {
    // If synthesis fails, concatenate the valid results
    return validResults.map(r => r.result).join('\n\n');
  }
}

/**
 * Run the full multi-agent pipeline.
 *
 * @returns {{ answer: string, agents: string[], characters: string[], steps: object[] }}
 */
async function runAgentPipeline(question, myCharacter, userNotes, ollamaBase, model) {
  const characters = extractCharacters(question);
  const moves = extractMoves(question);
  if (!characters.length && myCharacter) characters.push(myCharacter);

  const steps = [];

  // Step 1: Coordinator decides which agents to use
  const coordination = await coordinatorStep(question, ollamaBase, model);
  steps.push({ step: 'coordinator', agents: coordination.agents, reason: coordination.reason, source: coordination.source });
  console.log(`[Pipeline] Step 1 - Coordinator (${coordination.source}): ${coordination.agents.join(', ')} — ${coordination.reason}`);

  // Step 2: Run specialist agents in parallel
  const agentResults = await runSpecialistAgents(
    coordination.agents, question, characters, moves,
    myCharacter, userNotes, ollamaBase, model
  );
  for (const r of agentResults) {
    steps.push({ step: 'agent', agent: r.agent, resultLength: r.result?.length || 0 });
    console.log(`[Pipeline] Step 2 - ${r.agent}: ${r.result?.length || 0} chars`);
  }

  // Step 3: Synthesize (if multiple agents) or return single agent result
  const answer = await synthesize(question, agentResults, myCharacter, ollamaBase, model);
  steps.push({ step: 'synthesize', outputLength: answer.length });
  console.log(`[Pipeline] Step 3 - Synthesized: ${answer.length} chars`);

  return {
    answer,
    agents: coordination.agents,
    characters,
    steps,
  };
}

// Also keep the simple single-call version for backward compat
function runAgents(question, myCharacter, userNotes) {
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

module.exports = { runAgentPipeline, runAgents, fallbackSelectAgents };
