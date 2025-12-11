-- Update functions to include 'extensions' in search_path and ensure pgcrypto is available

-- Enable pgcrypto extension (just in case)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- PIN save function
CREATE OR REPLACE FUNCTION public.save_user_pin(p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_pin_hash text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Oturum açık değil'); END IF;
  
  -- Hash with bcrypt (salt rounds 10)
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
SET search_path = public, extensions
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
