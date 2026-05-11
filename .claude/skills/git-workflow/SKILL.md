---
name: git-workflow
description: Use when committing, pushing, or pulling code in SmashNotes. Mostly a tripwire skill — covers secret-detection rules (never commit anything matching sk-ant-*, sk-*, etc.), branch conventions, and what's safe vs unsafe to share in chat or commits.
---

# Git Workflow & Secret Safety

This is a small skill but the rules are absolute. Treat them as tripwires — if you're about to violate one, **stop and ask first**.

## The Cardinal Rule: Never Commit Secrets

A "secret" is anything that grants access to a resource someone could abuse:

- API keys (Anthropic, Start.gg, OpenAI, etc.)
- OAuth client secrets
- Database service-role keys
- Personal access tokens (GitHub, Vercel, etc.)
- Webhook signing secrets
- Private SSH keys

### Patterns That ARE Secrets

| Pattern | Provider | Notes |
|---|---|---|
| `sk-ant-api03-*` | Anthropic Claude | Auto-revoked by Anthropic if it hits GitHub |
| `sk-proj-*` or `sk-*` | OpenAI | Same auto-revocation |
| `ghp_*`, `github_pat_*` | GitHub | Personal access tokens |
| `xoxb-*`, `xoxp-*` | Slack | Bot/user tokens |
| Long random hex strings paired with a "client_secret" field | Various OAuth | Often these |
| Anything in `START_GG_*_CLIENT_SECRET` | Start.gg | OAuth secrets |

### Patterns That Are NOT Secrets (Safe-ish)

- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — designed to be public; RLS protects the data
- Public OAuth client IDs (e.g., `442`, `450`, `455`) — half of OAuth; useless without the secret
- API URLs and endpoint paths
- Project IDs, slugs

When in doubt, treat as secret.

## What Happens If You Commit a Secret

This actually happened during this app's development:

1. `.env` with `ANTHROPIC_API_KEY=sk-ant-api03-...` was committed and pushed
2. GitHub's secret-scanning bot detected the pattern within minutes
3. GitHub notified Anthropic
4. Anthropic auto-revoked the key
5. The Claude integration silently broke (`invalid x-api-key` errors)
6. We had to: generate a new key, update `.env`, untrack `.env` from git, add to `.gitignore`

Total recovery time: ~30 minutes. **Don't let this happen.**

## The Gitignored Files

Already in `.gitignore` (don't remove these):

```
node_modules/
.expo/
dist/
*.log
.DS_Store
.vercel
.env*.local
.env             ← critical
server/.env      ← critical
data/move-gifs/* ← scraped binaries (huge)
!data/move-gifs/manifest.json  ← but keep the manifest
```

## Pre-Commit Self-Check

Before `git commit`, ask yourself:

1. Am I including `.env` or `server/.env`? **STOP.** They should already be ignored. If they're showing up in `git status`, run `git rm --cached .env server/.env` to untrack.
2. Am I pasting an API key into a markdown file, comment, or plan file? **STOP.** Use `<your-api-key-here>` placeholder.
3. Am I committing a binary that's > 1 MB? **STOP.** Probably shouldn't be in git. Move to `data/` or similar, gitignore.
4. Did I accidentally commit a screenshot containing the dev tools showing my localStorage with tokens? **CHECK.** Crop or redact.

Quick sanity check on staged changes:

```bash
git diff --cached | grep -iE "sk-ant|sk-proj|sk_|client_secret|API_KEY|ANON_KEY" | head
```

If anything shows up, review it carefully before committing.

## Things Claude Should NEVER Paste in Chat

If you're collaborating with Claude (as you are right now) on this codebase, these should never appear in the conversation:

- Actual API key values (even briefly, even for debugging)
- Client secrets
- Database connection strings with embedded passwords
- Service-role JWTs
- Anything else from the secret patterns above

If Claude needs to verify an env var is loaded, it should print **only the first 10-20 chars** of the value, never the full thing:

```bash
node -e "console.log('Key starts with:', process.env.ANTHROPIC_API_KEY?.substring(0, 20))"
```

This has been violated earlier in this app's development. Don't continue the pattern.

## Branch Conventions

Light conventions; not strictly enforced:

- `main` — the canonical branch. Direct commits OK during early development.
- Feature branches: descriptive names like `ai-vod-review`, `start-gg-integration`. PR them to main.
- Don't `git push --force` to `main`. If you need to amend, branch off, fix, PR.

## Commit Message Conventions

No strict format. Past commits use:
- "added smashnotes gemma model"
- "Push up files"
- "Merge pull request #2 from JaredWalden00/ai-vod-review"

Aim for: present-tense imperative, brief description, mention the area of change. Examples:

- `add Claude tool-use pipeline for Ask AI`
- `fix lazy-loaded image detection in scrapeMoveGifs`
- `document Start.gg integration patterns`

Don't write commit messages that mention secret values, customer info, or other sensitive content.

## Pre-Push Self-Check

Before `git push`:

1. `git log -p origin/main..HEAD | grep -iE "sk-ant|sk-proj|sk_|client_secret"` — any secrets in commits about to be pushed?
2. If you find one: **don't push**. Reset to before that commit (`git reset HEAD~N`), redo without the secret, then push.
3. If you already pushed a secret: rotate the key immediately. Don't bother scrubbing history — assume the secret is compromised.

## What to Do When `.env` Shows Up in `git status`

This usually means it was tracked before `.gitignore` was set up:

```bash
git rm --cached .env server/.env       # remove from tracking, keep locally
git commit -m "untrack .env files"
```

After this, future changes to `.env` won't show up in `git status` (which is what you want).

## Tracking the Tracked Things

These directories ARE meant to be in git:

- `src/` — all source code
- `server/server.js` and other server files (but NOT `server/.env`)
- `api/` — Vercel serverless functions
- `scripts/` — dev tooling
- `supabase/migrations/` — DB migrations
- `.claude/skills/` — these skill docs
- `.claude/settings.local.json` — project-local Claude config (be careful — no secrets in there)
- `data/move-gifs/manifest.json` — labeled GIF index (but NOT the GIFs themselves)
- `package.json`, `package-lock.json`, etc. — dependency manifests
- `README.md`, `CLAUDE.md` — docs

These should NOT be in git:

- `.env`, `server/.env`
- `node_modules/`
- `.expo/`, `dist/`, build outputs
- `data/move-gifs/*.gif` — binaries
- `.claude/skills/claudemap-runtime/` — 137MB of runtime install
- Personal IDE configs

## Operations Claude Should Avoid Without User Confirmation

- `git push --force` (anywhere)
- `git reset --hard` followed by losing commits
- Deleting branches that contain unmerged work
- `git filter-repo` or BFG (rewrite history) — only for verified-needed cases
- Committing on behalf of the user without them asking
- Pushing to remotes without the user asking

When in doubt, run `git status` and `git log -n 5` and ask the user what they want to do.
