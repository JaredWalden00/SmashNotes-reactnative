# The Tool-Use Loop

The Ask AI feature's core control flow. Lives in `server/agentCoordinator.js` → `runClaudePipeline()`.

## The Loop in Pseudocode

```
messages = [{ role: 'user', content: question }]
while loopCount < MAX_LOOPS:
  response = POST /v1/messages with { messages, tools, system }
  if response.stop_reason == 'tool_use':
    messages.append({ role: 'assistant', content: response.content })  // full content array
    tool_results = []
    for each tool_use block in response.content:
      result = executeSmashTool(block.name, block.input)
      tool_results.append({ type: 'tool_result', tool_use_id: block.id, content: result })
    messages.append({ role: 'user', content: tool_results })
    continue
  else:
    # stop_reason == 'end_turn' or 'max_tokens'
    return extractText(response.content)
```

## The Message Shape (this is what trips people up)

Once Claude is mid-tool-use, your `messages` array contains alternating role types with **content arrays**, not strings:

```js
[
  { role: 'user', content: 'What's Bayonetta's fastest OOS?' },             // string OK
  { role: 'assistant', content: [                                            // array required
    { type: 'text', text: 'I'll look this up.' },
    { type: 'tool_use', id: 'toolu_abc123', name: 'get_oos_options', input: {...} }
  ]},
  { role: 'user', content: [                                                 // array required
    { type: 'tool_result', tool_use_id: 'toolu_abc123', content: 'BAYONETTA OOS...' }
  ]},
  { role: 'assistant', content: [                                            // final text
    { type: 'text', text: '**Witch Twist** at frame 6.' }
  ]}
]
```

You don't construct the assistant turns — you receive them from the API and push them back verbatim. The only ones you construct are:
- The initial `{ role: 'user', content: question }` (string is fine)
- The follow-up `{ role: 'user', content: [tool_result, tool_result, ...] }` (array required)

## `stop_reason` Values

| Value | Meaning | What to do |
|---|---|---|
| `tool_use` | Claude wants to call tool(s) | Execute, push results, loop |
| `end_turn` | Claude finished naturally | Extract text, return |
| `max_tokens` | Hit token limit mid-response | Return what you have, or retry with higher cap |
| `stop_sequence` | Hit a custom stop sequence | N/A — we don't use these |

## Parallel vs Sequential Tool Calls

Claude can return **multiple `tool_use` blocks in a single response**. The current code handles this correctly — it iterates over all of them and bundles results in one `tool_result` array:

```js
const toolResults = [];
for (const block of data.content) {
  if (block.type === 'tool_use') {
    const result = executeSmashTool(block.name, block.input, ...);
    toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
  }
}
messages.push({ role: 'user', content: toolResults });
```

This is "parallel tool use" — one round-trip per turn, multiple tools per turn. **Do not** make N separate API calls when Claude asks for N tools.

## The `MAX_LOOPS` Safety Cap

```js
const MAX_LOOPS = 5;
```

Claude shouldn't normally need more than 2-3 loops (one to decide, one to read results, one for final answer). If you ever hit the cap, something's wrong — Claude is stuck in a loop calling tools that aren't giving it what it needs. Look at the server logs (each `[Claude] Tool call: ...` line) to see what it's repeatedly asking for.

## Extracting the Final Text

The text answer is in `data.content` as one or more `{ type: 'text', text: '...' }` blocks. Join them:

```js
const answer = data.content
  .filter(b => b.type === 'text')
  .map(b => b.text)
  .join('\n');
```

## Common Failure Modes

| Symptom | Likely cause |
|---|---|
| Claude says "I'll look that up" and then stops | You returned an object from `executeSmashTool` instead of a string. Stringify it. |
| API returns 400 about mismatched tool_use_id | Your `tool_result.tool_use_id` doesn't match the `tool_use.id` from Claude's previous turn |
| API returns 400 about message format | You sent a string when an array was expected, or vice versa, somewhere in the middle of the convo |
| Claude calls the same tool 5 times in a row and gives up | The tool is returning an empty/error string. Claude reads "no data found" and tries again with slightly different args. Make sure the tool actually returns useful data. |
| Response has no text blocks (only tool_use) | You called the API on the final turn before extracting text. Check that `stop_reason` is `end_turn` before extracting. |

## System Prompt Conventions

The system prompt in `runClaudePipeline()` is short — Claude doesn't need the heavy-handed rules Gemma needed. Key constraints:

- State the user's character once at top (`The user plays: ${myCharacter}`)
- A few critical mechanics rules (shield drop = 11 frames, OOS math, etc.)
- "Use the provided tools — never guess frame numbers"
- Markdown formatting expectations

Don't put data IN the system prompt. Data comes through tool results.

## Cost Per Question (Haiku)

Roughly:
- System prompt: ~500 tokens (fixed)
- User question: ~20 tokens
- Tool descriptions: ~600 tokens (5 tools × ~120 tokens each)
- Tool results (one round): ~500 tokens of frame data text
- Final answer: ~200 tokens

So ~1800 input + 200 output ≈ $0.001 per question on Haiku. ~1000 questions per dollar.
