-- Mobil PIN entegrasyonu - Web ile uyumlu
-- Web'deki user_preferences.pin alanını kullanır (Bcrypt hash, salt rounds: 10)
-- MEVCUT TABLOYA FONKSİYONLAR EKLER, YENİ TABLO OLUŞTURMAZ

-- pgcrypto extension (bcrypt için gerekli)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PIN kaydetme fonksiyonu (Web ile uyumlu - user_preferences.pin kullanır)
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
  -- Kullanıcı ID'sini al
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Oturum açık değil');
  END IF;
  
  -- PIN hash'le (bcrypt, salt rounds: 10 - Web ile uyumlu)
  v_pin_hash := crypt(p_pin, gen_salt('bf', 10));
  
  -- user_preferences tablosuna upsert
  INSERT INTO public.user_preferences (user_id, pin, updated_at)
  VALUES (v_user_id, v_pin_hash, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET pin = EXCLUDED.pin, updated_at = now();
  
  RETURN json_build_object('success', true);
END;
$$;

-- PIN doğrulama fonksiyonu (Web ile uyumlu - bcryptjs hash'lerini destekler)
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
  -- Kullanıcı ID'sini al
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Oturum açık değil', 'valid', false);
  END IF;
  
  -- Kayıtlı PIN hash'i user_preferences tablosundan al
  SELECT pin INTO v_stored_hash
  FROM public.user_preferences
  WHERE user_id = v_user_id;
  
  IF v_stored_hash IS NULL OR v_stored_hash = '' THEN
    RETURN json_build_object('success', false, 'error', 'PIN bulunamadı', 'valid', false, 'not_found', true);
  END IF;
  
  -- PIN'i doğrula (bcrypt - stored hash'i salt olarak kullan)
  -- bcryptjs ve pgcrypto aynı formatı kullanır: $2a$ veya $2b$ prefix
  v_computed_hash := crypt(p_pin, v_stored_hash);
  v_is_valid := (v_stored_hash = v_computed_hash);
  
  -- Debug için hash bilgilerini logla (production'da kaldırılmalı)
  -- RAISE NOTICE 'Stored: %, Computed: %, Valid: %', v_stored_hash, v_computed_hash, v_is_valid;
  
  RETURN json_build_object('success', true, 'valid', v_is_valid);
END;
$$;

-- Kullanıcının PIN'i var mı kontrol fonksiyonu
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
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Oturum açık değil', 'has_pin', false);
  END IF;
  
  -- user_preferences tablosunda pin var mı kontrol et
  SELECT EXISTS(
    SELECT 1 FROM public.user_preferences 
    WHERE user_id = v_user_id AND pin IS NOT NULL AND pin != ''
  ) INTO v_has_pin;
  
  RETURN json_build_object('success', true, 'has_pin', v_has_pin);
END;
$$;

-- PIN silme fonksiyonu
CREATE OR REPLACE FUNCTION public.delete_user_pin()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Oturum açık değil');
  END IF;
  
  -- user_preferences tablosundaki pin'i null yap
  UPDATE public.user_preferences 
  SET pin = NULL, updated_at = now()
  WHERE user_id = v_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;
