---
name: claude-ai-pattern
description: Use when adding, modifying, or debugging the Claude API integration in SmashNotes (the Ask AI feature, Claude Vision frame analysis, tool definitions, the Ollama fallback). Covers the tool-use loop, how to add new tools, model choices, and the dual-provider architecture.
---

# Claude AI Integration Pattern Guide

SmashNotes uses Claude in two places:

1. **Ask AI tab** — Claude Haiku with tool use, looks up real frame data instead of hallucinating. Fallback to local Ollama if no API key.
2. **VOD Review AI Analyze** — Claude Sonnet vision, analyzes uploaded screenshots.

Both use raw `fetch` calls to `https://api.anthropic.com/v1/messages` rather than the Anthropic SDK (one less dep, full control).

## Quick Decision Tree

| What you're doing | Where to go |
|---|---|
| Add a new "Claude looks up data X" capability | New tool in `server/agentCoordinator.js` — see `references/adding-tools.md` |
| Debug "Claude isn't picking my tool" | `references/tool-use-loop.md` |
| Add image-input feature (vision) | Mirror `api/claude-analyze.js` pattern |
| User has no API key / Claude is down | Falls through to Ollama automatically — see `references/ollama-fallback.md` |
| Change the model or temperature | Two endpoints to update: `server/server.js` and `api/smash-ask.js` (Vercel mirror) |

## The Two Endpoints

| Endpoint | Model | Purpose | Falls back to Ollama? |
|---|---|---|---|
| `POST /api/smash-ask` | `claude-haiku-4-5-20251001` | Ask AI tab — frame data Q&A with tool use | Yes |
| `POST /api/claude-analyze` | `claude-sonnet-4-20250514` | VOD frame analysis (vision) | No |

Both routes are duplicated:
- **Express dev:** `server/server.js`
- **Vercel prod:** `api/smash-ask.js` and `api/claude-analyze.js`

If you change one, update both. There's no shared module — they're parallel implementations.

## The Core Pattern: Tool Use, Not Memorization

The key architectural decision in the Ask AI flow: **do not let Claude memorize frame data**. Instead:

1. Define tools that look up real data (from `frameDataQuery.js`)
2. Send the question to Claude with the tools available
3. Claude decides which tools to call
4. Server executes the tool (deterministic, reads `frameData.json`)
5. Server sends the result back to Claude
6. Claude formats the final answer using the real numbers

This is why answers don't hallucinate frame numbers — the numbers come from a JSON file, not the model's training data.

See `references/tool-use-loop.md` for the actual control flow.

## Critical Gotchas

- **The tool-use loop is implemented manually** (no SDK helper). You build `messages` array, call API, check `stop_reason`, append tool results, repeat. Off-by-one in the array shape will make Claude lose track.
- **Tool results must be strings.** If `executeSmashTool()` returns an object, Claude won't read it correctly. Always stringify before returning from the tool dispatcher.
- **`tool_use_id` must match.** Every `tool_result` block must reference the exact `id` of the `tool_use` block from Claude's previous turn. Mismatch = API error.
- **The Ollama fallback uses a completely different prompt structure.** It doesn't have tools — instead the data gets injected into the system prompt directly. Don't try to share prompt logic between the two paths.
- **Claude Vision (the analyze endpoint) is NOT tool-use.** It's a single-call image+text request. Different model, different shape.
- **`max_tokens: 1024` is the current cap.** For longer answers, raise it — but watch the budget.
- **API key is loaded with `dotenv.config({ override: true })`** in `server/server.js:4`. Without `override:true`, a stale empty system env var will silently win over the `.env` file. Do not remove this flag.

## When NOT to Use This Skill

- The Ollama-only path (no Claude involvement): see `references/ollama-fallback.md` briefly but mostly self-contained.
- The notes import via Ollama (different endpoint, same Ollama, no Claude): `api/claude-categorize.js` is misleadingly named — it's Ollama-only now. See file comments.

## References

| Open this | When |
|---|---|
| `references/tool-use-loop.md` | Debugging or modifying the message-loop control flow |
| `references/adding-tools.md` | Adding a new lookup tool that Claude can call |
| `references/ollama-fallback.md` | Working on the offline / no-API-key path |
