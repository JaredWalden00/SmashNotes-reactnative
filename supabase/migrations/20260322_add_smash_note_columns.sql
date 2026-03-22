-- SmashNotes schema migration: add structured Smash note columns.
-- Run this in Supabase SQL Editor.

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

alter table public.notes
  add column if not exists character text,
  add column if not exists opponent text,
  add column if not exists category text,
  add column if not exists sections jsonb;

-- If notes were previously stored with encoded metadata in body,
-- decode and migrate that data into typed columns.
update public.notes
set
  title = coalesce(nullif(title, ''), nullif((substr(body, 15)::jsonb ->> 'title'), ''), title),
  character = coalesce(character, nullif((substr(body, 15)::jsonb ->> 'character'), ''), 'General'),
  opponent = coalesce(opponent, nullif((substr(body, 15)::jsonb ->> 'opponent'), '')),
  category = coalesce(nullif(category, ''), nullif((substr(body, 15)::jsonb ->> 'category'), ''), 'general'),
  sections = coalesce(
    nullif(sections, '{}'::jsonb),
    (substr(body, 15)::jsonb -> 'sections'),
    jsonb_build_object(
      'overview', coalesce(body, ''),
      'neutral', '',
      'advantage', '',
      'disadvantage', '',
      'stageNotes', '',
      'reminders', ''
    )
  ),
  body = coalesce((substr(body, 15)::jsonb #>> '{sections,overview}'), body)
where body like '__SMASHNOTE__:%';

-- Backfill any remaining legacy rows.
update public.notes
set
  character = coalesce(character, 'General'),
  category = coalesce(nullif(category, ''), case when opponent is null then 'general' else 'matchup' end),
  sections = coalesce(
    nullif(sections, '{}'::jsonb),
    jsonb_build_object(
      'overview', coalesce(body, ''),
      'neutral', '',
      'advantage', '',
      'disadvantage', '',
      'stageNotes', '',
      'reminders', ''
    )
  )
where character is null
   or category is null
   or category = ''
   or sections is null
   or sections = '{}'::jsonb;

alter table public.notes
  alter column character set not null,
  alter column category set not null,
  alter column sections set not null,
  alter column sections set default '{}'::jsonb;

-- Optional but helpful for common query patterns in the app.
create index if not exists notes_user_character_idx on public.notes (user_id, character);
create index if not exists notes_user_matchup_idx on public.notes (user_id, character, opponent);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
