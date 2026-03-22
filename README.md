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

2. Create a `.env` file in the project root:

   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

3. Configure your Supabase table and Row Level Security (run in Supabase SQL editor):

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

   alter table public.notes enable row level security;

   create policy "users can read own notes"
   on public.notes
   for select
   using (auth.uid() = user_id);

   create policy "users can insert own notes"
   on public.notes
   for insert
   with check (auth.uid() = user_id);

   create policy "users can update own notes"
   on public.notes
   for update
   using (auth.uid() = user_id)
   with check (auth.uid() = user_id);

   create policy "users can delete own notes"
   on public.notes
   for delete
   using (auth.uid() = user_id);

4. If you are upgrading from the older schema, run:

   supabase/migrations/20260322_add_smash_note_columns.sql

5. Enable RLS and notes policies:

   supabase/migrations/20260323_enable_notes_rls_policies.sql

6. Start development server:
   npm run start

7. Open in Expo Go on your phone or run an emulator.

## How Data Is Stored

- Cloud: Notes are stored in Supabase Postgres table `public.notes`, scoped by `user_id`, with structured fields (`character`, `opponent`, `category`, `sections`).
- Local: Notes are cached in AsyncStorage under a user-specific key so each account has separate offline data.

## Scripts

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`

## Supabase CLI Migrations (EF-style workflow)

You can run migrations from local files instead of manually pasting SQL each time.

1. Install Supabase CLI (one-time):
   npm install -g supabase

2. Authenticate CLI (one-time):
   supabase login

3. Initialize local Supabase config (one-time, in project root):
   npm run db:init

4. Link this project to your hosted Supabase project (one-time):
   npm run db:link

5. Create a new migration file:
   npm run db:migration:new -- add_matchup_constraints

6. Edit the generated SQL file under `supabase/migrations/`.

7. Apply all pending migrations to your linked project:
   npm run db:migrate

Notes:
- `npm run db:migrate` applies migrations in timestamp order.
- Keep all schema changes in migration files for version control.
- Existing migration for Smash note fields: `supabase/migrations/20260322_add_smash_note_columns.sql`.
