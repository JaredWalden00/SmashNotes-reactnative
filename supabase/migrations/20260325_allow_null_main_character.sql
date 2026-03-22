-- Allow users to keep no selected main fighter.

alter table if exists public.user_profiles
  alter column main_character drop not null,
  alter column main_character drop default;