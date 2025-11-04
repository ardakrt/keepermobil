# Kişisel Not Kasası (Expo + Supabase)

Bu proje Expo (RN) tabanlı, Supabase ile kimlik doğrulama ve veri saklama yapan çoklu özellikli bir uygulamadır.

## Kurulum

1) Bağımlılıklar

```powershell
npm install
```

2) Ortam değişkenleri (.env)

`.env` dosyası oluşturup aşağıyı doldurun (örnek `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

3) Supabase şema ve politikalar

`supabase/schema.sql` içeriğini Supabase SQL Editor ile çalıştırın. Bu, tabloları ve RLS politikalarını oluşturur.

Ek olarak, `supabase/migrations/2025-10-15-rls-user_tokens.sql` dosyası `public.user_tokens` tablosu için detaylı RLS politikalarını idempotent olarak uygular. İsterseniz bu migration dosyasını da SQL Editor üzerinden çalıştırabilirsiniz.

4) Geliştirme

```powershell
npm run start
```

Android için:

```powershell
npm run android
```

## Bildirimler

- Expo Notifications: `user_tokens.expo_token` alanı ile Expo Push kullanılır.
- Firebase Messaging: `user_tokens.firebase_token` alanı ile FCM token’ı tutulur. Android arka plan mesaj işleyicisi `index.js` içinde kayıtlıdır.

## Güvenlik Notları

- `fcm-service-account.json`, `google-services.json` gibi dosyaları repoya koymayın. `.gitignore` buna göre güncellenmiştir.
- Varsayılan Supabase anahtarlarını app.json’dan kaldırdık, `.env` üzerinden yönetiyoruz.

## Dizinler

- `lib/` Supabase istemcisi, yerel auth ve depolama anahtarları
- `screens/` Uygulama ekranları (Notes, Reminders, Cards, Accounts, Ibans, Settings)
- `supabase/` Edge function örneği ve şema

## Sorun giderme

- Arka plan FCM mesajları için handler’ın `index.js`’te kayıtlı olduğundan emin olun.
- Realtime için Supabase RLS politikalarının doğru olduğundan emin olun (auth.uid() eşleşmesi).

## RLS ve hızlı test (isteğe bağlı)

RLS kurulumunun doğru olduğunu hızlıca doğrulamak için `scripts/test-rls.js` aracını kullanabilirsiniz.

PowerShell örnekleri:

```powershell
# Zorunlu
$env:SUPABASE_URL = "https://<project>.supabase.co"
$env:SUPABASE_ANON_KEY = "<anon-key>"

# (İsteğe bağlı) Test kullanıcılarını otomatik oluşturmak için service role anahtarı
# Güvenlik: Bunu sadece lokal testte ve güvende tutarak kullanın
# $env:SERVICE_ROLE_KEY = "<service-role-key>"

# Test kullanıcıları (manuel ya da otomatik oluşturma için)
$env:TEST_USER_A_EMAIL = "user_a@example.com"
$env:TEST_USER_A_PASSWORD = "passwordA"
$env:TEST_USER_B_EMAIL = "user_b@example.com"
$env:TEST_USER_B_PASSWORD = "passwordB"

node scripts/test-rls.js
```

Script; signed-out erişimin engellendiğini, her kullanıcının yalnızca kendi satırlarını gördüğünü ve yabancı `user_id` ile upsert denemelerinin reddedildiğini doğrular.
