# Adding a New Tool to the Ask AI Pipeline

A "tool" is something Claude can call to look up real data. Adding one is a four-step pattern.

## When You Want to Add a Tool

Common cases:
- New kind of frame-data query ("get all moves with `kill` in notes")
- New data source ("look up the user's matchup notes for a character")
- New computed query ("find the best counter-character against X")

If the data lives in `frameData.json` or the user's notes, this is the right pattern. If it's external (Start.gg, a web search, etc.), it's also still tools but you'll write the HTTP call inside the executor.

## The Four Steps

### 1. Write the data retriever

In `server/frameDataQuery.js`. Pure function. Takes inputs, returns a **formatted string** (Claude reads strings, not objects).

```js
function getKillingMoves(characterName) {
  const data = frameDataJson[characterName];
  if (!data) return null;

  const killers = [];
  for (const cat of data.categories) {
    for (const move of cat.moves) {
      // Heuristic: high damage + smash attacks/specials
      if (parseFloat(move.baseDamage) >= 15 && cat.category !== 'aerialattacks') {
        killers.push(`${move.moveName} (${move.baseDamage}%)`);
      }
    }
  }

  if (!killers.length) return null;
  return `${characterName.toUpperCase()}'S KILL MOVES:\n${killers.map(k => `  ${k}`).join('\n')}`;
}

module.exports = { ...existing, getKillingMoves };
```

Conventions:
- Return `null` if no data — the dispatcher will turn that into a friendly "no data" string
- Return a multi-line text table — Claude reads these well
- ALL CAPS the headers — helps Claude visually parse
- Two-space indented entries — looks cleaner in the model's view

### 2. Add the tool schema

In `server/agentCoordinator.js`, push a new object onto `CLAUDE_TOOLS`:

```js
{
  name: 'get_killing_moves',
  description: "Get a character's high-damage moves likely to KO at the standard 80-130% kill range. Use this when the user asks about kill moves, killing percent, or KO options.",
  input_schema: {
    type: 'object',
    properties: {
      character: { type: 'string', description: 'Character name (e.g., "Fox", "Bayonetta")' },
    },
    required: ['character'],
  },
},
```

The `description` is what Claude reads when deciding whether to call the tool. Be specific about **when** to use it. Generic descriptions = Claude won't pick it.

### 3. Wire up the executor

In the same file's `executeSmashTool()` switch:

```js
case 'get_killing_moves':
  return getKillingMoves(input.character) || `No kill move data for "${input.character}".`;
```

Always return a string. Always handle the null case with a friendly message.

### 4. Import the retriever

At the top of `server/agentCoordinator.js`:

```js
const {
  getFrameDataContext,
  getMovesContext,
  getShieldAdvantageData,
  getOOSOptions,
  getFastestMoves,
  formatNotesContext,
  extractCharacters,
  extractMoves,
  getKillingMoves,   // ← added
} = require('./frameDataQuery');
```

Done. No other files to touch. Claude will discover the new tool on the next `/api/smash-ask` call (the tools array is re-built each request).

## How to Verify Claude Is Using Your Tool

Server logs each tool call:

```
[Claude] Tool call: get_killing_moves({"character":"Bayonetta"})
```

If you ask "what are Bayonetta's kill moves" and don't see your tool fire, the `description` wasn't specific enough or didn't match the user's wording. Iterate on the description.

## When NOT to Add a Tool

- **The data is already in the system prompt.** Don't duplicate. Tools are for things you'd rather look up than carry around.
- **The "tool" is trivially computable from existing data.** E.g., "get the move at position N" — Claude can already read the full list from `get_frame_data` and pick the Nth item.
- **You want Claude to do free-form reasoning.** Tools are for facts. Reasoning happens in the model. Don't write `evaluate_matchup` as a tool — let Claude reason from the data.

## Description-Writing Tips

The description is the **entire** signal for whether Claude picks this tool. Treat it as the prompt for tool selection:

- **Be specific about triggers:** "Use this when the user asks about X, Y, or Z."
- **Distinguish from similar tools:** "Use this for safe-on-shield questions, NOT for general 'fastest move' questions (use `get_fastest_moves` for that)."
- **State output format:** "Returns moves sorted by on-shield advantage (best to worst)."
- **Don't oversell:** "Returns kill confirms" is a lie if you're really returning "moves with high damage." Be honest about what the tool actually computes; otherwise Claude will cite it incorrectly.

## Schema Validation Notes

Claude's API validates the `input_schema` strictly:

- `type: 'object'` is required at the top level
- `required: []` defaults to none — if a field is mandatory, list it
- `enum: [...]` is supported and helpful for categorical inputs (e.g., `category: { enum: ['ground', 'aerial', 'special'] }`)
- `type: 'array'` needs `items: { type: 'string' }` (or similar)

If the schema is invalid, the API will reject the request — not Claude. The error will be a 400 with a message like "tools[2].input_schema.properties.foo is not a valid schema".

## Testing a New Tool

1. Restart the dev server
2. Ask a question that should trigger it
3. Watch the server log for the tool call line
4. If it doesn't fire: edit the description, retry
5. If it fires but the result is wrong: check what `executeSmashTool` returned (add a `console.log` of the result string)
6. If Claude misinterprets the result: edit the data retriever's output format (clearer headers, units, etc.)

## Pattern: Multi-Argument Tools

If your retriever takes multiple inputs (e.g., character + move name):

```js
{
  name: 'get_move_data',
  description: 'Look up specific moves by name for a character.',
  input_schema: {
    type: 'object',
    properties: {
      character: { type: 'string' },
      move_names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Move names. Aliases supported: nair=Neutral Air, fair=Forward Air, etc.',
      },
    },
    required: ['character', 'move_names'],
  },
},
```

The `description` on individual properties matters — it tells Claude how to format the args. Without it, Claude might pass `"forward air"` when the function expects `"Forward Air"`.
