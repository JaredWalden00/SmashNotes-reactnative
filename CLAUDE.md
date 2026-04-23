# SmashNotes — Project Guide

## Overview
SmashNotes is a competitive Super Smash Bros. Ultimate companion app built with React Native (Expo). It helps players organize matchup notes, review VODs, browse frame data, track tournament stats via Start.gg, and ask AI-powered questions grounded in real game data.

## Tech Stack
- **Frontend:** React Native (Expo v54), React Native Web
- **Backend:** Express.js (dev server on port 3001), Vercel serverless functions (production)
- **Database:** Supabase (PostgreSQL) for cloud sync, AsyncStorage for local cache
- **Auth:** Supabase Auth (email + Google OAuth), Start.gg OAuth
- **AI:** Claude API (Haiku) with tool use for Ask AI, Ollama/Gemma as offline fallback

## Project Structure
```
SmashNotes-reactnative/
  src/
    components/     # React Native screens and UI components
    hooks/          # Custom hooks (useNotes, useStartGG, etc.)
    utils/          # Data models, cloud sync, frame data queries
    data/           # Static data (smashFighters.js, frameData.json)
    lib/            # Supabase client, Start.gg auth/API
    SmashIcons/     # Character icon images
  server/
    server.js       # Express dev server (all API routes)
    frameDataQuery.js  # Frame data retrieval for AI context (RAG layer)
    agentCoordinator.js # AI pipeline (Claude tool-use + Ollama fallback)
    agents.js       # Ollama-specific agent definitions (fallback only)
  api/              # Vercel serverless functions (production)
  ollama/           # Custom Ollama Modelfile
  supabase/         # Database migrations
```

## AI Architecture — Ask AI Feature

### Claude API (Primary)
Uses Claude Haiku with **tool use** — Claude decides which data to look up, calls tools, reads the results, and reasons over real frame data.

**Flow:**
1. User asks a question in the Ask AI tab
2. Server sends question + tool definitions to Claude API
3. Claude calls tools like `get_oos_options(character="Fox")`
4. Server executes the tool (queries frameData.json), returns real data
5. Claude reads the data, reasons, responds with grounded answer
6. No hallucinated frame numbers — every stat comes from the database

### Tool Definitions
| Tool | Function | Purpose |
|------|----------|---------|
| `get_frame_data` | `getFrameDataContext()` | Full move list for a character |
| `get_move_data` | `getMovesContext()` | Specific moves by name |
| `get_shield_data` | `getShieldAdvantageData()` | Moves sorted by on-shield advantage |
| `get_oos_options` | `getOOSOptions()` | Fastest out-of-shield punish options |
| `get_fastest_moves` | `getFastestMoves()` | Fastest startup moves |

All tools are defined in `server/frameDataQuery.js`.

### Ollama Fallback
If `ANTHROPIC_API_KEY` is missing or Claude API fails, falls back to local Ollama with the `smashnotes` custom model. Less reliable but works offline.

### Adding New Tools
1. Add a data retrieval function to `server/frameDataQuery.js`
2. Add the tool schema to the `CLAUDE_TOOLS` array in `server/agentCoordinator.js`
3. Add the execution case to `executeSmashTool()` in the same file
4. Claude will automatically discover and use the new tool

## Environment Variables
```
# Required for Ask AI (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...

# Start.gg OAuth
EXPO_PUBLIC_START_GG_CLIENT_ID=...
START_GG_CLIENT_SECRET=...
EXPO_PUBLIC_START_GG_MOBILE_CLIENT_ID=...
START_GG_MOBILE_CLIENT_SECRET=...

# Optional — Ollama fallback
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=smashnotes
```

## Key Data Models

### Note Structure (`src/utils/smashNoteModel.js`)
```js
{
  id, title, character, opponent,
  category: "general" | "matchup",
  sections: { overview, neutral, advantage, disadvantage, stageNotes, reminders },
  playerTag, vodUrl, setTournament, setEvent, setScore, updatedAt
}
```

### Frame Data (`src/data/frameData.json`)
1.6MB JSON with all 89 characters. Each character has categories (ground/aerial/special/grabs/dodges), each with moves containing: `moveName`, `startup`, `activeFrames`, `totalFrames`, `baseDamage`, `advantage` (on shield), `landingLag`, `shieldLag`, `shieldStun`, `whichHitbox`, `notes`.

## UI Conventions
- **Dark theme:** Background `#0F1420`, cards `#1A2030`, borders `#2A3040`
- **Accent:** Orange `#FF6B3D`
- **Success:** Green `#34D399`
- **Error:** Red `#F87171`
- **Text:** Primary `#F4F7FF`, secondary `#C0C8D8`, muted `#637083`
- **Tabs:** Defined in `MORE_TABS` array in `NotesScreen.js`, registered via `renderTabPage()`

## Server Routes
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/smash-ask` | AI assistant (Claude + Ollama fallback) |
| POST | `/api/claude-analyze` | VOD frame analysis (Claude Vision) |
| POST | `/api/claude-categorize` | AI notes import (Ollama) |
| POST | `/api/startgg/exchange` | Start.gg OAuth token exchange |
| GET | `/auth/native/callback` | Native OAuth callback |
| GET | `/auth/native/token` | Native OAuth token poll |

## Running Locally
```bash
# Terminal 1: Dev server
cd server && node server.js

# Terminal 2: Expo
npx expo start --web
```
