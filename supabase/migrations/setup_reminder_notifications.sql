-- =====================================================
-- KEEPER - Sunucu Tarafı Bildirim Sistemi Kurulumu
-- Bu script'i Supabase Dashboard > SQL Editor'de çalıştırın
-- =====================================================

-- ADIM 1: notification_sent kolonu ekle
ALTER TABLE reminders 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

-- ADIM 2: Geçmiş tarihi hatırlatmalar için notification_sent = true yap
UPDATE reminders 
SET notification_sent = true 
WHERE due_at < NOW();

-- ADIM 3: Performans için index ekle
CREATE INDEX IF NOT EXISTS idx_reminders_notification_pending 
ON reminders(due_at) 
WHERE is_done = false AND notification_sent = false;

-- ADIM 4: pg_net extension'ı aktifleştir (HTTP request için gerekli)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ADIM 5: Mevcut cron job varsa sil
SELECT cron.unschedule('check-reminders-every-minute') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-reminders-every-minute');

-- ADIM 6: Her dakika çalışan cron job oluştur
SELECT cron.schedule(
  'check-reminders-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jpjgagpmtkuhdvvjqntd.supabase.co/functions/v1/check-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwamdhZ3BtdGt1aGR2dmpxbnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODc4NzUsImV4cCI6MjA3NTU2Mzg3NX0.i12CJdZHkuzSA6IpwFHFTYt5pwejSAa9ws0j1SEOhyo'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ADIM 7: Cron job'ın oluşturulduğunu doğrula
SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'check-reminders-every-minute';

-- =====================================================
-- KURULUM TAMAMLANDI!
-- Şimdi Edge Function'ı deploy etmeniz gerekiyor:
-- npx supabase functions deploy check-reminders --project-ref jpjgagpmtkuhdvvjqntd
-- =====================================================
