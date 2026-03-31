-- Add set identity columns to notes table for linking notes to start.gg sets
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS set_id text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS set_tournament text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS set_event text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS set_score text;
