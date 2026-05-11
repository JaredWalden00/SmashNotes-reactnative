# The Ollama Fallback

When `ANTHROPIC_API_KEY` is missing OR Claude's API call throws (network error, rate limit, low balance), the Ask AI feature silently falls back to local Ollama. This file explains how that path works and what to watch for.

## When the Fallback Triggers

```js
// server/server.js, /api/smash-ask route
const apiKey = process.env.ANTHROPIC_API_KEY;

if (apiKey) {
  try {
    const result = await runClaudePipeline(...);
    return res.json({ ..., provider: 'claude' });
  } catch (err) {
    console.error('[SmashAsk] Claude failed, falling back to Ollama:', err.message);
  }
}

// Reaches here if: no API key OR Claude threw
const { systemPrompt, agents, characters } = runOllamaFallback(...);
// ... fetch to Ollama ...
return res.json({ ..., provider: 'ollama' });
```

The fallback is **silent to the user** — they see an answer, just with a purple "Ollama" chip instead of a blue "Claude" chip in the UI.

## What's Architecturally Different About the Ollama Path

| Aspect | Claude path | Ollama path |
|---|---|---|
| Tool use | Yes (Claude picks tools) | No (server picks data deterministically via regex on the question) |
| Number of API calls | 2-4 (tool loop) | 1 (single completion) |
| Data injection | Via tool results | Pre-injected into the system prompt |
| Model | Claude Haiku 4.5 | Gemma 3 (custom Modelfile baked in: `smashnotes`) |
| Hallucination risk | Very low | Medium-high — Gemma 4B sometimes ignores context |
| Speed | ~2-5s typical | ~5-10s typical (depends on machine) |

The Ollama path uses the older "agent" architecture: regex-based intent detection (`fallbackSelectAgents()`) picks which data to fetch, then everything gets stuffed into the system prompt before the single Ollama call.

## The Agent Files (Ollama-Only)

These files exist ONLY to support the Ollama fallback:

- `server/agents.js` — Defines 5 agents (FrameDataAgent, ShieldAgent, SpeedAgent, NotesAgent, GeneralAgent), each with its own focused prompt + data getter
- `server/agentCoordinator.js#fallbackSelectAgents()` — Regex-based intent detection that picks 1-3 agents to run
- `server/agentCoordinator.js#runOllamaFallback()` — Builds the prompt by concatenating data from selected agents

The Claude path **does not use** any of these agents. Tools replaced them. Don't accidentally couple the two paths.

## The Ollama Modelfile

`ollama/Modelfile` defines a custom model called `smashnotes`:

```
FROM gemma3
PARAMETER temperature 0.3
PARAMETER num_predict 4096
SYSTEM """[bakedlong system prompt with Smash mechanics]"""
```

Build it with:
```
ollama create smashnotes -f ollama/Modelfile
```

The baked-in SYSTEM prompt is for the **notes import** flow (`api/claude-categorize.js` — misleadingly named, it's Ollama-only). The Ask AI fallback supplies its own system prompt per request, so it doesn't really benefit from the bake-in.

## Env Vars

| Var | Default | Purpose |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Where to reach Ollama |
| `OLLAMA_MODEL` | `smashnotes` | Which model to call |

Both are optional with sane defaults. If you change the model name in the Modelfile, update `OLLAMA_MODEL` to match (or rebuild as `smashnotes`).

## Gemma 4B Quirks (Observed)

These are footguns the existing code already works around:

- **Garbled leading text** ("ählten" etc.) — Cleaned by `answer.replace(/^[^\w#*\-•>]+/, '').trim()` in the response handler
- **Lazy reading of system prompt** — If the system prompt is huge, Gemma ignores most of it. Keep agent prompts focused; don't dump all data into one prompt
- **Confusing terminology** — "OOS" can be interpreted as either direction. The agent prompts spell this out explicitly
- **Adding unwanted follow-ups** — "Want me to elaborate?" — Explicitly forbidden in agent prompts (`Do NOT add follow-up questions`)
- **Hallucinated frame numbers** — Even with data in the prompt, Gemma sometimes invents. Lower temperature helps; tool use (Claude) eliminates this

The Claude path doesn't have these problems. The fallback is best-effort, not production-quality.

## When to Test the Fallback

You usually don't need to. But test it when:
- You change anything in `server/agentCoordinator.js` (the file is shared)
- You change tool definitions (the Ollama fallback doesn't use them, but it's easy to break it by accident)
- You're deploying somewhere with `ANTHROPIC_API_KEY` unset (Vercel preview branches?)

To force the fallback locally: temporarily unset `ANTHROPIC_API_KEY` in `server/.env` and restart the dev server.

## Cost Comparison

| Provider | Cost per question | Latency | Reliability |
|---|---|---|---|
| Claude Haiku | ~$0.001 | 2-5s | High |
| Ollama (local Gemma) | $0 (local compute) | 5-10s | Medium |

The fallback exists for resilience, not cost. Use Claude unless you have a strong reason (offline, demo without internet, etc.).

## Do Not Remove the Fallback

It's tempting to delete the agent files now that Claude handles everything reliably. **Don't.** Reasons to keep them:
- Demo / dev without internet
- Rate-limit recovery (if you hit Claude's per-minute cap)
- Cost-zero option for high-volume use cases later
- Useful regression test — if a feature works in Claude but not Ollama, the data layer probably has a bug

If you ever do remove it, also remove the `provider` field from the response (UI uses it), remove the chip rendering in `SmashAskTab.js`, and update `CLAUDE.md`.
