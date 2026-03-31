-- Add player identity columns to notes table for linking notes to start.gg players
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS player_tag text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS startgg_player_id text;

-- Index for looking up notes by start.gg player ID
CREATE INDEX IF NOT EXISTS notes_startgg_player_id_idx ON public.notes(user_id, startgg_player_id) WHERE startgg_player_id IS NOT NULL;
