# SmashNotes (React Native)

A simple notes app built with React Native + Expo.

## Features

- Create notes
- Edit existing notes
- Delete notes
- Email/password authentication with Supabase
- Cloud sync across devices with Supabase Postgres
- Offline cache per user with AsyncStorage
- Search notes by title or content

## Getting Started

1. Install dependencies:
   npm install

2. Install Supabase CLI (one-time):
   npm install -g supabase

3. Create a `.env` file in the project root:

   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

4. Initialize Supabase in this repo (one-time):

   npm run db:init

5. Start local Supabase and apply migrations:

   npx supabase start
   npx supabase db reset

   This creates/configures `public.notes` and applies RLS/policies from:

   - `supabase/migrations/20260322_add_smash_note_columns.sql`
   - `supabase/migrations/20260323_enable_notes_rls_policies.sql`

6. (Optional) Link to your hosted Supabase project and push migrations:

   npm run db:link
   npm run db:migrate

7. Start the app (preferred: Docker one-command stack):

   Preferred:
   npm run dev:docker:up

   This starts local Supabase (if needed) and Expo web container together.

8. Open:

   Docker web preview:
   http://localhost:19006

   For mobile or non-Docker runs, see Run Modes below.

## Supabase Notes Table Schema

The migrations build this table shape:

   create table if not exists public.notes (
     id text primary key,
     user_id uuid not null references auth.users(id) on delete cascade,
     title text not null default '',
     body text not null default '',
     character text not null default 'General',
     opponent text,
     category text not null default 'general',
     sections jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now(),
     created_at timestamptz not null default now()
   );

RLS is enabled and restricted to the authenticated user (`auth.uid() = user_id`) by migration.

## How Data Is Stored

- Cloud: Notes are stored in Supabase Postgres table `public.notes`, scoped by `user_id`, with structured fields (`character`, `opponent`, `category`, `sections`).
- Local: Notes are cached in AsyncStorage under a user-specific key so each account has separate offline data.

## Scripts

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run docker:web:build`
- `npm run docker:web:up`
- `npm run docker:web:down`
- `npm run dev:docker:up`
- `npm run dev:docker:down`

## Run Modes (Docker Preferred)

Use one of these ways to run the app:

1. Preferred: full local stack with Docker + Supabase

   Start:
   npm run dev:docker:up

   Stop:
   npm run dev:docker:down

   Best for daily development when you want consistent local backend + web preview.

2. Docker web only (when Supabase is already running)

   Build:
   npm run docker:web:build

   Start:
   npm run docker:web:up

   Stop:
   npm run docker:web:down

3. Host machine Expo (best for mobile device testing)

   Start:
   npm run start

   Then open in Expo Go / emulator for iOS or Android.

## Supabase CLI Migrations (EF-style workflow)

You can run migrations from local files instead of manually pasting SQL each time.

1. Install Supabase CLI (one-time):
   npm install -g supabase

2. Authenticate CLI (one-time):
   supabase login

3. Initialize local Supabase config (one-time, in project root):
   npm run db:init

4. Start local Supabase services:
   npx supabase start

5. Rebuild local DB and replay all migrations:
   npx supabase db reset

6. Link this project to your hosted Supabase project (one-time):
   npm run db:link

7. Create a new migration file:
   npm run db:migration:new -- add_matchup_constraints

8. Edit the generated SQL file under `supabase/migrations/`.

9. Apply all pending migrations to your linked project:
   npm run db:migrate

Notes:
- `npm run db:migrate` applies migrations in timestamp order.
- Keep all schema changes in migration files for version control.
- Existing migration for Smash note fields: `supabase/migrations/20260322_add_smash_note_columns.sql`.
- Existing migration for RLS policies: `supabase/migrations/20260323_enable_notes_rls_policies.sql`.

## Docker (Expo Web Preview)

This repo includes a lightweight Docker setup for Expo web preview.
Docker is the preferred run path for local web development in this project.

What it does:
- Runs Expo web in a container (`docker-compose.yml`).
- Mounts your source for live-edit development.
- Keeps `node_modules` in a Docker volume so host/container dependency trees do not conflict.

Start Docker web preview:
1. Build image:
   npm run docker:web:build
2. Start container:
   npm run docker:web:up
3. Open:
   http://localhost:19006

Stop Docker web preview:
- npm run docker:web:down

Notes:
- This Docker setup is for web preview. For mobile device testing, keep using `npm run start` on host.
- Supabase local still runs separately via `npx supabase start`.

### One-command local stack (Supabase + Expo web)

Start both local Supabase and Expo web together:

- `npm run dev:docker:up`

Stop both together:

- `npm run dev:docker:down`

Tip:
- `dev:docker:up` uses a Windows PowerShell helper script that checks `supabase status` first, so it does not fail just because Supabase is already running.
- `dev:docker:up` also rebuilds and force-recreates `expo-web` so Docker picks up the latest compose/script changes.
