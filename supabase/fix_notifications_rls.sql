-- Create user_tokens table if it doesn't exist
create table if not exists public.user_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expo_token text,
  firebase_token text,
  updated_at timestamptz default now()
);

-- Enable RLS logic for user_tokens
alter table public.user_tokens enable row level security;

-- Create policy to allow users to insert/update their own tokens
drop policy if exists "Users can manage their own tokens" on public.user_tokens;
create policy "Users can manage their own tokens"
on public.user_tokens
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Create login_requests table if it doesn't exist
create table if not exists public.login_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  status text default 'pending', -- pending, approved, rejected, expired
  ip_address text,
  device_info text,
  browser_info text,
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '5 minutes')
);

-- Enable RLS for login_requests
alter table public.login_requests enable row level security;

-- Create policy to allow users to view and update their own login requests
drop policy if exists "Users can manage their own login requests" on public.login_requests;
create policy "Users can manage their own login requests"
on public.login_requests
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Grant permissions to authenticated users
grant all on public.user_tokens to authenticated;
grant all on public.login_requests to authenticated;

-- Enable realtime safely
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'login_requests'
  ) then
    alter publication supabase_realtime add table login_requests;
  end if;
end $$;
