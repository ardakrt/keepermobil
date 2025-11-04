-- Idempotent migration to ensure RLS policies for public.user_tokens are present
-- Safe to run multiple times

begin;

-- Ensure table exists (matches existing schema)
create table if not exists public.user_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expo_token text,
  firebase_token text,
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.user_tokens enable row level security;

-- Granular owner-only policies (coexist with existing policies if any)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_tokens' and policyname = 'user_tokens_owner_select'
  ) then
    create policy user_tokens_owner_select
      on public.user_tokens for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_tokens' and policyname = 'user_tokens_owner_insert'
  ) then
    create policy user_tokens_owner_insert
      on public.user_tokens for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_tokens' and policyname = 'user_tokens_owner_update'
  ) then
    create policy user_tokens_owner_update
      on public.user_tokens for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

commit;
