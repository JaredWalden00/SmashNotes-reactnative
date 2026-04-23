---
description: Direct the live ClaudeMap session. Use it to focus the map, highlight architecture, present a step, compare regions, or show flow.
argument-hint: '[intent]'
---

Use ClaudeMap as a live presentation and navigation surface.

Principles:

- optimize for the fewest actions that make the user's intent visually obvious
- prefer `present` when the user wants explanation plus focus
- prefer `highlight` or `navigate` when the user wants quick emphasis without narration
- prefer `flow` when the user wants sequence or dependency motion
- keep the map legible and avoid noisy multi-step show-command spam

Workflow:
1. Resolve the bundled command script at `.claude/skills/claudemap-runtime/skill/commands/show.js`.
2. Read the user request as presentation intent, not just a literal command request.
3. If needed, read the current runtime graph from `.claude/skills/claudemap-runtime/app/public/claudemap-runtime.json` to choose the right node names or path through the graph.
4. Translate the request into the smallest useful set of show commands.
5. Run the show command or short command sequence with Node.
6. Briefly report what changed in the UI.

Built-in show actions include:
- `highlight <query> [--zoom <value>] [--explain "..."]`
- `clear-highlight`
- `present <query> [--title "..."] [--step "..."] [--explain "..."]`
- `navigate <query> [--zoom <value>]`
- `health <on|off>`
- `mode <free|guided|locked-demo>`
- `caption [--title <title>] [--step <step>] <body>`
- `clear-caption`
- `flow <query1> <query2> [query3 ...]`
- `ask "<phrase>"`

Examples of intent translation:

- "focus the auth system" -> `navigate` or `highlight`
- "walk me through request handling" -> a short `present` or `flow` sequence
- "show the riskiest area" -> `ask "what's wrong"`
- "put the UI in guided mode and caption this step" -> `mode` plus `caption`
