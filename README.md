# SmashNotes (React Native)

A simple notes app built with React Native + Expo.

Current app runtime:
- Expo SDK 54
- React Native 0.81
- React 19.1

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

2. Use a compatible Expo Go version for SDK 54 (update Expo Go on your phone if needed).

3. Install Supabase CLI (one-time):
   npm install -g supabase

4. Create a `.env` file in the project root:

   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

5. Initialize Supabase in this repo (one-time):

   npm run db:init

6. Start local Supabase and apply migrations:

   npx supabase start
   npx supabase db reset

   This creates/configures `public.notes` and applies RLS/policies from:

   - `supabase/migrations/20260322_add_smash_note_columns.sql`
   - `supabase/migrations/20260323_enable_notes_rls_policies.sql`

7. (Optional) Link to your hosted Supabase project and push migrations:

   npm run db:link
   npm run db:migrate

8. Start the app (preferred: Docker one-command stack):

   Preferred:
   npm run dev:docker:up

   This starts local Supabase (if needed) and Expo web container together.

9. Open:

   Docker web preview:
   http://localhost:19006

   For mobile or non-Docker runs, see Run Modes below.
