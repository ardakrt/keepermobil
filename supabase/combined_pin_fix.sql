-- Create user_preferences table if it doesn't exist
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_mode text default 'system' check (theme_mode in ('system', 'light', 'dark')), 
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  pin text,
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.user_preferences enable row level security;

-- Policies
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_preferences' and policyname='user_preferences_owner_all'
  ) then
    create policy user_preferences_owner_all on public.user_preferences for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PIN save function
CREATE OR REPLACE FUNCTION public.save_user_pin(p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_pin_hash text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Oturum açık değil'); END IF;
  
  v_pin_hash := crypt(p_pin, gen_salt('bf', 10));
  
  INSERT INTO public.user_preferences (user_id, pin, updated_at)
  VALUES (v_user_id, v_pin_hash, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET pin = EXCLUDED.pin, updated_at = now();
  
  RETURN json_build_object('success', true);
END;
$$;

-- PIN verify function
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_stored_hash text;
  v_is_valid boolean;
  v_computed_hash text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Oturum açık değil', 'valid', false); END IF;
  
  SELECT pin INTO v_stored_hash FROM public.user_preferences WHERE user_id = v_user_id;
  
  IF v_stored_hash IS NULL OR v_stored_hash = '' THEN
    RETURN json_build_object('success', false, 'error', 'PIN bulunamadı', 'valid', false, 'not_found', true);
  END IF;
  
  v_computed_hash := crypt(p_pin, v_stored_hash);
  v_is_valid := (v_stored_hash = v_computed_hash);
  
  RETURN json_build_object('success', true, 'valid', v_is_valid);
END;
$$;

-- Has PIN function
CREATE OR REPLACE FUNCTION public.has_user_pin()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_has_pin boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Oturum açık değil', 'has_pin', false); END IF;
  
  SELECT EXISTS(SELECT 1 FROM public.user_preferences WHERE user_id = v_user_id AND pin IS NOT NULL AND pin != '') INTO v_has_pin;
  
  RETURN json_build_object('success', true, 'has_pin', v_has_pin);
END;
$$;