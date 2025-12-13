-- 1. pg_net eklentisini aç (HTTP istekleri için gerekli)
create extension if not exists pg_net with schema extensions;

-- 2. login_requests tablosu yoksa oluştur (Varsa hata vermez)
create table if not exists public.login_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  status text check (status in ('pending', 'approved', 'rejected', 'expired')) default 'pending',
  ip_address text,
  device_info text,
  browser_info text,
  location text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  expires_at timestamp with time zone default (now() + interval '5 minutes')
);

-- RLS (Güvenlik) Politikaları
alter table public.login_requests enable row level security;

create policy "Users can view own requests" on public.login_requests
  for select using (auth.uid() = user_id);

create policy "Users can update own requests" on public.login_requests
  for update using (auth.uid() = user_id);
  
-- Not: Insert yetkisi Service Role (Web Backend) için olmalı veya anonim isteklerde function ile yapılmalı.
-- Şimdilik user'ın kendisi insert edebilsin (Test için)
create policy "Users can insert own requests" on public.login_requests
  for insert with check (auth.uid() = user_id);


-- 3. Webhook Tetikleyici Fonksiyonu
create or replace function public.trigger_handle_login_request()
returns trigger as $$
begin
  -- Edge Function'a POST isteği at
  perform net.http_post(
    url := 'https://jpjgagpmtkuhdvvjqntd.supabase.co/functions/v1/handle-login-request',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'record', row_to_json(new),
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA
    )
  );
  return new;
end;
$$ language plpgsql security definer;

-- 4. Trigger'ı Oluştur (Her INSERT işleminde çalışsın)
drop trigger if exists on_login_request_insert on public.login_requests;

create trigger on_login_request_insert
  after insert on public.login_requests
  for each row execute procedure public.trigger_handle_login_request();
