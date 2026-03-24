-- Add per-user profile settings, including preferred Smash main character.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  main_character text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_profiles_main_character_not_general
    check (main_character is null or main_character <> 'General')
);

alter table public.user_profiles enable row level security;

grant select, insert, update on table public.user_profiles to authenticated;
revoke all on table public.user_profiles from anon;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'users can read own profile'
  ) then
    create policy "users can read own profile"
      on public.user_profiles
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'users can insert own profile'
  ) then
    create policy "users can insert own profile"
      on public.user_profiles
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'users can update own profile'
  ) then
    create policy "users can update own profile"
      on public.user_profiles
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;