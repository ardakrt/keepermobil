# Supabase Edge Function - Push Notification Scheduler

Bu Edge Function, vadesi gelen hatırlatmaları kontrol eder ve FCM v1 API ile push notification gönderir.

## Kurulum Adımları

### 1. Supabase SQL Editor'de çalıştırın:

```sql
-- notification_sent kolonu ekle
ALTER TABLE reminders 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;

-- Geçmiş kayıtları güncelle
UPDATE reminders SET notification_sent = true WHERE due_at < NOW();

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_reminders_notification_pending 
ON reminders(due_at) 
WHERE is_done = false AND notification_sent = false;
```

### 2. Edge Function'ı deploy edin:

```bash
cd g:\keeper\keeper
npx supabase functions deploy check-reminders
```

### 3. Cron Job oluşturun (Supabase Dashboard > SQL Editor):

```sql
-- pg_net extension'ı aktifleştir (gerekiyorsa)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Her dakika çalışan cron job
SELECT cron.schedule(
  'check-reminders-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**NOT:** YOUR_PROJECT_REF ve YOUR_ANON_KEY'i kendi değerlerinizle değiştirin.

### 4. Test edin:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-reminders \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Nasıl Çalışır?

1. Cron job her dakika çalışır
2. Edge Function vadesi gelen hatırlatmaları bulur
3. FCM v1 API ile HIGH priority bildirim gönderir
4. Android pil optimizasyonu bypass edilir
5. Bildirim zamanında ulaşır!

## Güvenlik Notu

`firebase-service-account.json` dosyası hassas bilgiler içerir ve Git'e commit edilmemelidir.
`.gitignore` dosyasına eklenmiştir.
