-- Enable RLS and policies for public.notes.
-- This migration is idempotent and safe to re-run.

alter table public.notes enable row level security;

-- Ensure authenticated users can use the table (actual row access is still controlled by RLS).
grant select, insert, update, delete on table public.notes to authenticated;

-- Optional: keep anon role blocked by default.
revoke all on table public.notes from anon;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notes'
      and policyname = 'users can read own notes'
  ) then
    create policy "users can read own notes"
      on public.notes
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notes'
      and policyname = 'users can insert own notes'
  ) then
    create policy "users can insert own notes"
      on public.notes
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notes'
      and policyname = 'users can update own notes'
  ) then
    create policy "users can update own notes"
      on public.notes
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notes'
      and policyname = 'users can delete own notes'
  ) then
    create policy "users can delete own notes"
      on public.notes
      for delete
      using (auth.uid() = user_id);
  end if;
end
$$;