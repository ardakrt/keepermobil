-- Kullanıcı hesabını silmek için RPC fonksiyonu
-- Bu fonksiyon kullanıcının kendi hesabını silmesine izin verir

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Mevcut kullanıcı ID'sini al
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Oturum açmış kullanıcı bulunamadı';
  END IF;

  -- Tüm kullanıcı verilerini sil (foreign key sıralamasına dikkat)
  DELETE FROM public.notes WHERE user_id = current_user_id;
  DELETE FROM public.reminders WHERE user_id = current_user_id;
  DELETE FROM public.cards WHERE user_id = current_user_id;
  DELETE FROM public.accounts WHERE user_id = current_user_id;
  DELETE FROM public.ibans WHERE user_id = current_user_id;
  DELETE FROM public.user_preferences WHERE user_id = current_user_id;
  DELETE FROM public.user_tokens WHERE user_id = current_user_id;
  DELETE FROM public.todos WHERE user_id = current_user_id;
  DELETE FROM public.subscriptions WHERE user_id = current_user_id;
  
  -- Auth kullanıcısını sil (bu admin yetkisi gerektirir)
  -- Not: Bu satır için service_role key gerekebilir
  -- Alternatif olarak Supabase Dashboard'dan manuel silinebilir
  DELETE FROM auth.users WHERE id = current_user_id;
  
END;
$$;

-- Fonksiyona sadece authenticated kullanıcılar erişebilsin
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
REVOKE EXECUTE ON FUNCTION delete_user_account() FROM anon;
REVOKE EXECUTE ON FUNCTION delete_user_account() FROM public;
