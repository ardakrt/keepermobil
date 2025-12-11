-- Migration: Add notification_sent column to reminders table
-- Run this in Supabase SQL Editor

-- 1. notification_sent kolonu ekle
ALTER TABLE reminders 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

-- 2. Mevcut kayıtları güncelle (geçmiş tarihli olanlar için true yap)
UPDATE reminders 
SET notification_sent = true 
WHERE due_at < NOW();

-- 3. Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_reminders_notification_pending 
ON reminders(due_at) 
WHERE is_done = false AND notification_sent = false;

-- 4. Supabase pg_cron ile cron job oluştur
-- NOT: Bu sadece Supabase Pro/Team planlarında çalışır
-- Dashboard > SQL Editor'de çalıştırın:

-- Önce mevcut job varsa sil
SELECT cron.unschedule('check-reminders-job');

-- Her dakika çalışan job oluştur
SELECT cron.schedule(
  'check-reminders-job',
  '* * * * *',  -- Her dakika
  $$
  SELECT net.http_post(
    url := 'https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/check-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Job'ı kontrol et
SELECT * FROM cron.job;
