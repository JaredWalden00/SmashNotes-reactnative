---
description: Build a detailed architecture map for the current repository and open it in ClaudeMap.
argument-hint: '[project-root]'
---

Set up ClaudeMap for the target repository.

High-level goal:

- snapshot the repository
- ask the bundled `@claudemap-architect` subagent to build a detailed graph with intuitive human grouping
- render that graph in the ClaudeMap UI

Steps:
1. Treat the current working directory as the target project root unless the user gave a different path.
2. Resolve the bundled snapshot script at `.claude/skills/claudemap-runtime/skill/commands/snapshot.js`.
3. Run the snapshot script and capture the repo snapshot JSON.
4. Read `.claude/skills/claudemap-runtime/skill/prompts/enrichment.txt`.
5. Use the `@claudemap-architect` subagent explicitly and provide:
   - the snapshot JSON
   - the enrichment contract
   - instructions to return only valid graph JSON
   - instructions to optimize for detailed systems, useful file/function depth, and human-intuitive grouping
6. Save the subagent result to `.claude/skills/claudemap-runtime/tmp/claudemap-enrichment.json`.
7. Run `.claude/skills/claudemap-runtime/skill/commands/setup-claudemap.js` with `--enrichment-file` pointing to that JSON file.
8. Add `--force-refresh` only when the user explicitly asks for a full rebuild.
9. If the subagent result is invalid, fall back to running the bundled setup command without the override.
10. Report the analyzed file count, system count, graph source, render transport, and app readiness.
