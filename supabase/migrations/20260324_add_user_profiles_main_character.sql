-- Add a per-user profile row with editable Smash main.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  main_character text not null default 'Mario',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
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