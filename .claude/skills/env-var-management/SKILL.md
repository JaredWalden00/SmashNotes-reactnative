---
name: env-var-management
description: Use when adding, modifying, or debugging environment variables in SmashNotes — the dual .env file setup, the EXPO_PUBLIC_ prefix, the dotenv override quirk, Vercel deployment, and known gotchas like Windows line endings silently breaking secrets.
---

# Environment Variable Management

This app uses environment variables in **multiple places** and has hit several hard-to-debug gotchas. Read this before adding new env vars or debugging "the API key isn't being loaded" issues.

## File Layout

```
project root/
├── .env             ← Read by Expo at build time (client-side vars)
├── .env.example     ← Template, no secrets, tracked in git
├── server/.env      ← Read by Express dev server only
└── .gitignore       ← .env and server/.env both ignored
```

**Both `.env` files are gitignored.** They contain secrets. If they're ever committed, the secrets must be rotated immediately because GitHub's secret scanning will notify any provider whose key matches a known pattern.

## The `EXPO_PUBLIC_` Prefix

Expo inlines vars with this prefix into the JavaScript bundle at build time. **Anything WITHOUT the prefix is server-only** (won't be available in `src/*` code).

```js
// In src/lib/supabase.js — runs in the bundle:
process.env.EXPO_PUBLIC_SUPABASE_URL  // ✅ works
process.env.SUPABASE_SERVICE_KEY      // ❌ undefined

// In server/server.js — runs in Node:
process.env.ANTHROPIC_API_KEY         // ✅ works (server-side, no prefix needed)
process.env.EXPO_PUBLIC_SUPABASE_URL  // ✅ also works (any var works server-side)
```

Rule: **client-readable = public. Server-only = secret.** Don't put secrets in `EXPO_PUBLIC_*`.

## The Full Inventory

### Public (`EXPO_PUBLIC_*`)

| Var | Used by | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `src/lib/supabase.js` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase.js` | Supabase anon JWT (safe to expose; RLS protects data) |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` | sign-up flow | Cloudflare Turnstile bot detection |
| `EXPO_PUBLIC_START_GG_API_TOKEN` | `src/lib/startgg.js` | Start.gg PAT for public queries |
| `EXPO_PUBLIC_START_GG_CLIENT_ID` | `src/lib/startggAuth.js` | OAuth client ID (desktop, 442) |
| `EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID` | `src/lib/startggAuth.js` | OAuth client ID (mobile, 450) |
| `EXPO_PUBLIC_START_GG_PROD_CLIENT_ID` | `src/lib/startggAuth.js` | OAuth client ID (production, 455) |

### Secret (no prefix)

| Var | Used by | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | `server/server.js` | Claude API |
| `START_GG_CLIENT_SECRET` | `server/server.js`, `api/startgg-exchange.js` | OAuth secret (desktop) |
| `START_GG_MOBILE_CLIENT_SECRET` | same | OAuth secret (mobile) |
| `START_GG_PROD_CLIENT_SECRET` | `api/startgg-exchange.js` | OAuth secret (prod) |
| `OLLAMA_URL` | `server/server.js` | Ollama server URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | `server/server.js` | Ollama model name (default: `smashnotes`) |
| `PORT` | `server/server.js` | Dev server port (default: `3001`) |

## The Two Hardest-To-Debug Gotchas

### Gotcha #1: Windows `\r\n` Line Endings Break Secrets

If you `cat` your `.env` and the values look correct but the API key is "invalid," check for trailing carriage returns:

```bash
node -e "const fs=require('fs');const l=fs.readFileSync('.env','utf8').split('\n');l.forEach((line,i)=>{if(line.includes('API_KEY'))console.log(i,JSON.stringify(line))})"
```

If you see `"ANTHROPIC_API_KEY=sk-ant-...\r"`, the trailing `\r` is part of the value when dotenv reads it. Some APIs treat the trailing whitespace as part of the key and reject it.

**Fix:** Convert the file to LF line endings.

```bash
node -e "const fs=require('fs');const c=fs.readFileSync('.env','utf8').replace(/\r\n/g,'\n').replace(/\r/g,'\n');fs.writeFileSync('.env',c)"
```

Or configure your editor to use LF line endings. Add `.gitattributes`:

```
*.env text eol=lf
```

### Gotcha #2: `dotenv.config()` Doesn't Override Existing Env Vars

By default, `dotenv` skips any var that's already set in `process.env`. If a previous session or shell init somehow set `ANTHROPIC_API_KEY=""` (empty string), dotenv will silently NOT load the value from `.env`.

**Fix:** Always use `{ override: true }` in `server/server.js:4`:

```js
require('dotenv').config({ override: true });
```

This forces `.env` values to win over pre-existing env vars. **Do not remove the `override: true` flag.** It's there because we hit this exact bug.

## Setting Env Vars in Each Environment

### Local dev (project root)

Edit `.env` and `server/.env`. They typically contain the same values. After editing, **restart the dev server** to pick up changes (`node server/server.js` and `npx expo start --web`).

Tip: Most contents are identical between the two files. You could symlink them but Windows symlinks are annoying. Just keep both in sync manually.

### Vercel (production)

Project → Settings → Environment Variables. Add each var; preserve the `EXPO_PUBLIC_` prefix on public ones. Apply to "Production" environment (and "Preview" if you want preview branches to work).

Vercel will NOT see your local `.env` — it has its own env store. Every var you need in prod must be set in Vercel manually.

### Mobile native (Expo Go)

Same `.env` file used; the values get inlined into the dev bundle when you run `npx expo start`. Restart Expo after changing `.env` (the metro cache holds old values).

## Checking What's Loaded

Quick diagnostic:

```bash
# In project root:
node -e "require('dotenv').config({override:true});console.log('Key:',process.env.ANTHROPIC_API_KEY?.substring(0,20))"
```

Should print the first 20 chars of the key. If it prints `undefined` or `""`, check:
1. Spelling of the var name
2. The `.env` file is in the cwd you're running from
3. Line endings (Gotcha #1)
4. Whether something else already set this var (Gotcha #2 — run with `override: true`)

## Adding a New Env Var

Pattern:

1. **Decide if it's public or secret.** Public = the user could see it via the bundle. If you can't tolerate that, it's secret.
2. **Pick a name.** If public, prefix with `EXPO_PUBLIC_`. Use SCREAMING_SNAKE_CASE.
3. **Add to `.env`** (and `server/.env` if the server needs it).
4. **Add to `.env.example`** with a dummy placeholder so future contributors know it's expected.
5. **Reference in code:** `process.env.YOUR_VAR`.
6. **Document in `CLAUDE.md`** (the project root doc) and the relevant skill.
7. **For prod:** add to Vercel env vars dashboard.
8. **Restart the dev server.**

## Anti-Patterns

- **Don't commit `.env`.** Ever. The `.gitignore` covers this, but `git add -f .env` will override. Don't.
- **Don't put secrets in `EXPO_PUBLIC_*`.** They'll ship in the bundle. Anyone with the app can read them.
- **Don't hardcode env values in source for "convenience."** They drift, then prod breaks.
- **Don't print full secret values in logs.** First 4-10 chars max if needed for debugging. The existing code does this correctly.
- **Don't add a new env var without `.env.example` updating.** New contributors won't know it's needed.
- **Don't use different variable names for "the same thing" in different files.** E.g., don't use `ANTHROPIC_KEY` in one file and `ANTHROPIC_API_KEY` in another. Pick one canonical name.

## Recovery: Your Secret Got Committed

If a secret hits git:

1. **Rotate the secret immediately** (revoke the old key, generate a new one)
2. Update `.env` with the new key
3. **Don't try to scrub git history** — assume the old key is compromised forever
4. The new key works going forward; the old one is dead

If you want to remove the secret from git history (for clean repos), use `git filter-repo` or BFG Repo Cleaner. But realistically, if it was a real secret, rotating is faster and safer.

This is the situation we hit during development: an API key was committed, GitHub's secret scanning notified Anthropic, the key was auto-revoked within minutes. We rotated and added `.env` to `.gitignore`. **Both `.env` files were tracked in git before this**; `git rm --cached .env server/.env` removed them from tracking without deleting locally.
