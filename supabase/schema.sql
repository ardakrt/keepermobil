-- Tables and RLS policies for the app
-- Run in Supabase SQL editor

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  number_enc text not null,
  cvc_enc text,
  exp_month_enc text,
  exp_year_enc text,
  holder_name_enc text,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null,
  username_enc text not null,
  password_enc text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.ibans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  iban text not null,
  bank text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expo_token text,
  firebase_token text,
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.notes enable row level security;
alter table public.reminders enable row level security;
alter table public.cards enable row level security;
alter table public.accounts enable row level security;
alter table public.ibans enable row level security;
alter table public.user_tokens enable row level security;

-- Policies: owner can do everything on own rows
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notes' and policyname='notes_owner_all'
  ) then
    create policy notes_owner_all on public.notes for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reminders' and policyname='reminders_owner_all'
  ) then
    create policy reminders_owner_all on public.reminders for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='cards' and policyname='cards_owner_all'
  ) then
    create policy cards_owner_all on public.cards for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='accounts' and policyname='accounts_owner_all'
  ) then
    create policy accounts_owner_all on public.accounts for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='ibans' and policyname='ibans_owner_all'
  ) then
    create policy ibans_owner_all on public.ibans for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_tokens' and policyname='user_tokens_owner_all'
  ) then
    create policy user_tokens_owner_all on public.user_tokens for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
