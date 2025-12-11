-- Supabase SQL: Create automatic reminder notification scheduler
-- Bu script Supabase SQL Editor'de çalıştırılmalıdır

-- 1. pg_cron extension'ı aktif et (Supabase'de zaten aktif)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. notification_logs tablosu oluştur (gönderilen bildirimleri takip etmek için)
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_reminder ON notification_logs(reminder_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

-- 4. Vadesi gelen hatırlatmaları bulan fonksiyon
CREATE OR REPLACE FUNCTION get_due_reminders()
RETURNS TABLE (
  reminder_id UUID,
  user_id UUID,
  title TEXT,
  firebase_token TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id as reminder_id,
    r.user_id,
    r.title,
    ut.firebase_token
  FROM reminders r
  INNER JOIN user_tokens ut ON r.user_id = ut.user_id
  LEFT JOIN notification_logs nl ON r.id = nl.reminder_id
  WHERE 
    r.due_at <= NOW() + INTERVAL '1 minute'  -- 1 dakika içinde vadesi gelecek
    AND r.due_at > NOW() - INTERVAL '5 minutes'  -- Son 5 dakika içinde vadesi gelmiş
    AND r.is_done = false
    AND ut.firebase_token IS NOT NULL
    AND nl.id IS NULL;  -- Henüz bildirim gönderilmemiş
END;
$$ LANGUAGE plpgsql;

-- 5. HTTP request gönderen fonksiyon (Supabase Edge Function'ı çağırmak için)
-- Bu fonksiyon, supabase_functions.http_request kullanır
CREATE OR REPLACE FUNCTION send_reminder_notifications()
RETURNS void AS $$
DECLARE
  reminder RECORD;
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Supabase URL ve Service Role Key'i environment'tan al
  edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-reminder-push';
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Vadesi gelen her hatırlatma için
  FOR reminder IN SELECT * FROM get_due_reminders()
  LOOP
    -- Notification log'a kaydet
    INSERT INTO notification_logs (reminder_id, user_id, status)
    VALUES (reminder.reminder_id, reminder.user_id, 'pending');
    
    -- Edge Function'ı çağır (http extension gerekli)
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'reminderId', reminder.reminder_id::text,
        'userId', reminder.user_id::text
      )
    );
    
    -- Log'u güncelle
    UPDATE notification_logs 
    SET status = 'sent', sent_at = NOW()
    WHERE reminder_id = reminder.reminder_id AND status = 'pending';
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. Cron job oluştur (her dakika çalışır)
-- NOT: Bu Supabase Dashboard > SQL Editor'de çalıştırılmalı
-- SELECT cron.schedule(
--   'send-reminder-notifications',  -- job name
--   '* * * * *',                    -- every minute
--   'SELECT send_reminder_notifications()'
-- );

-- Alternatif: Database Webhook kullanarak trigger oluştur
-- Bu daha güvenilir çünkü Supabase'in kendi webhook sistemini kullanır

-- 7. Supabase Realtime trigger (alternatif yöntem)
CREATE OR REPLACE FUNCTION trigger_reminder_check()
RETURNS trigger AS $$
BEGIN
  -- Hatırlatma eklendi veya güncellendi
  -- Burada direkt SDK üzerinden edge function çağrılabilir
  -- Ama cron job daha güvenilir
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
