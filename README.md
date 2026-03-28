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
- Google sign-in with Supabase OAuth
- Cloud sync across devices with Supabase Postgres
- Offline cache per user with AsyncStorage
- Search notes by title or content
- **Start.gg Integration (Optional)**:
  - Tournament search and bracket viewing
  - Player lookup with tournament history
  - Character usage analytics
  - Auto-generated matchup notes from tournament data

## Getting Started

1. Install dependencies:
   npm install

2. Use a compatible Expo Go version for SDK 54 (update Expo Go on your phone if needed).

3. Install Supabase CLI (one-time):
   npm install -g supabase

4. Create a `.env` file in the project root:

   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_TURNSTILE_SITE_KEY=your_cloudflare_turnstile_site_key
   EXPO_PUBLIC_START_GG_API_TOKEN=your_start_gg_api_token_here

### Google Sign-In Setup (Supabase + Google Cloud)

To enable Google sign-in, configure both Google Cloud and Supabase:

1. In Google Cloud Console:
   - Create or select a project.
   - Configure OAuth consent screen.
   - Create OAuth Client ID (Web application).

2. Add Authorized redirect URI in Google Cloud:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`

3. In Supabase Dashboard:
   - Go to Authentication -> Providers -> Google.
   - Enable Google provider.
   - Paste Google Client ID and Client Secret.

4. In Supabase Dashboard, set additional redirect URLs (Authentication -> URL Configuration):
   - `smashnotes://auth/callback`
   - `http://localhost:19006/auth/callback`
   - `http://localhost:8081/auth/callback` (optional for Expo dev server)

5. Native app scheme:
   - This project uses `smashnotes` in `app.json` for native callback handling.

After this setup, users can use "Continue with Google" on the auth screen.

### Forgot Password Setup (Supabase)

The app sends password reset emails with this redirect path:

- `smashnotes://auth/reset-password`
- `http://localhost:19006/auth/reset-password`

Add both URLs in Supabase Dashboard:

- Authentication -> URL Configuration -> Additional Redirect URLs

Then users can tap "Forgot Password?" on the login screen, open the email link, and set a new password in-app.

### Captcha For Sign Up (Supabase Bot Detection)

Sign-up now requires captcha completion (web flow) before account creation.

1. Create a Cloudflare Turnstile site key.
2. In Supabase Dashboard, enable Bot Detection for Auth and configure Turnstile keys.
3. Add `EXPO_PUBLIC_TURNSTILE_SITE_KEY` to `.env`.

Without the site key, sign-up will show a configuration error.

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

### Start.gg API Integration (Optional)

The app now includes integration with the Start.gg API for tournament and player data. This allows you to:

- Search for tournaments and view brackets
- Look up players and analyze their tournament history
- View character usage statistics
- Auto-generate matchup notes from tournament data

#### Setup Start.gg Integration

1. **Get a Start.gg API Token:**
   - Visit [Start.gg Developer Settings](https://start.gg/admin/profile/developer)
   - Click "Create new token"
   - Enter a description for your token
   - Copy the generated token (you won't see it again!)

2. **Add the token to your environment:**
   
   Add this line to your `.env` file:
   ```
   EXPO_PUBLIC_START_GG_API_TOKEN=your_start_gg_api_token_here
   ```
   
   Or see `.env.example` for a template.

3. **Restart your development server** to load the new environment variable.

#### Using Start.gg Features

Once configured, you can access Start.gg features through:

- **Tournament Browser**: Search for tournaments, view events and brackets
- **Player Lookup**: Search for players, view their sets and character usage
- **Auto-Note Generation**: Create matchup notes with pre-filled tournament data
- **Settings**: Check connection status and view setup instructions

The integration provides read-only access to public tournament data and respects Start.gg's rate limits.

#### Supported Features

- 🏆 **Tournament Search**: Find tournaments by name, location, or game
- 🎮 **Player Analysis**: View player profiles, rankings, and recent sets
- 📊 **Character Statistics**: Analyze character usage and win rates
- 📝 **Smart Note Generation**: Create notes with tournament insights
- ⚡ **Offline Mode**: App works without Start.gg integration if API is unavailable

Note: Start.gg integration is completely optional. All core note-taking features work independently.
