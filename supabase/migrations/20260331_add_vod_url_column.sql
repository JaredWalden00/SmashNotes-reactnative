-- Add VOD URL column to notes table for linking notes to YouTube videos
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS vod_url text;
