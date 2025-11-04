-- Add theme preferences to user_tokens table
-- Run this in Supabase SQL Editor

-- Make expo_token nullable (kullanıcı henüz bildirim izni vermeden tema değiştirebilir)
alter table public.user_tokens
  alter column expo_token drop not null;

-- Add columns for theme preferences
alter table public.user_tokens
  add column if not exists theme_mode text default 'system',
  add column if not exists accent_color text;

-- Add check constraint for theme_mode
alter table public.user_tokens
  drop constraint if exists theme_mode_check;

alter table public.user_tokens
  add constraint theme_mode_check
  check (theme_mode in ('system', 'light', 'dark'));

-- Add check constraint for accent_color (hex format)
alter table public.user_tokens
  drop constraint if exists accent_color_check;

alter table public.user_tokens
  add constraint accent_color_check
  check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$');
