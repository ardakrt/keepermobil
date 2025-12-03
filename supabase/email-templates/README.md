# Keeper - Email Şablonları

Bu klasör, Keeper uygulaması için özel tasarlanmış Supabase email template'lerini içerir.

## 📧 Şablonlar

### 1. **change-email.html** - E-posta Değiştirme
Kullanıcı e-posta adresini değiştirmek istediğinde gönderilen onay maili.

**Kullanım Yeri:** Supabase Dashboard → Authentication → Email Templates → **Change Email**

**Değişkenler:**
- `{{ .Email }}` - Yeni e-posta adresi
- `{{ .ConfirmationURL }}` - Onay linki
- `{{ .SentAt }}` - Gönderim tarihi

---

### 2. **confirm-signup.html** - Kayıt Onaylama
Yeni kullanıcılar kayıt olduğunda e-posta adresini onaylamak için gönderilen mail.

**Kullanım Yeri:** Supabase Dashboard → Authentication → Email Templates → **Confirm Signup**

**Değişkenler:**
- `{{ .ConfirmationURL }}` - Onay linki
- `{{ .SentAt }}` - Gönderim tarihi

---

### 3. **invite.html** - Kullanıcı Daveti
Admin tarafından yeni kullanıcı davet edildiğinde gönderilen mail.

**Kullanım Yeri:** Supabase Dashboard → Authentication → Email Templates → **Invite User**

**Değişkenler:**
- `{{ .ConfirmationURL }}` - Davet kabul linki
- `{{ .SentAt }}` - Gönderim tarihi

---

### 4. **magic-link.html** - Sihirli Link (Passwordless Login)
Kullanıcı şifresiz giriş yapmak istediğinde gönderilen tek kullanımlık link.

**Kullanım Yeri:** Supabase Dashboard → Authentication → Email Templates → **Magic Link**

**Değişkenler:**
- `{{ .ConfirmationURL }}` - Giriş linki
- `{{ .SentAt }}` - Gönderim tarihi

---

## 🚀 Kurulum

### Adım 1: Supabase Dashboard'a Giriş
1. [Supabase Dashboard](https://app.supabase.com) adresine gidin
2. Projenizi seçin

### Adım 2: Email Templates Sayfasına Git
1. Sol menüden **Authentication** seçeneğine tıklayın
2. **Email Templates** sekmesine geçin

### Adım 3: Template'leri Yükle
Her bir template için:

1. İlgili template tipini seçin (örn: "Change Email")
2. **"Enable custom email template"** kutucuğunu işaretleyin
3. HTML içeriğini yapıştırın:
   - `change-email.html` içeriğini kopyalayın
   - Template editöre yapıştırın
4. **"Save"** butonuna tıklayın

### Adım 4: Test Edin
1. Uygulamadan ilgili işlemi yapın (örn: e-posta değiştir)
2. E-postanızı kontrol edin
3. Tasarımın doğru göründüğünden emin olun

---

## 🎨 Özelleştirme

Tüm template'ler aşağıdaki özelliklere sahiptir:

- **Modern Gradient Tasarım** (mor tonları)
- **Responsive** - Mobil uyumlu
- **Türkçe Dil Desteği**
- **Güvenlik Uyarıları**
- **Alternatif Link Gösterimi** (buton çalışmazsa)
- **Kolay Okunabilir Tipografi**

### Renk Paleti
```css
Primary Gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
Background: #f7fafc
Text Primary: #2d3748
Text Secondary: #4a5568
Border: #e2e8f0
```

### Marka Logosu Değiştirme
Logo için emoji kullanılıyor (🔐). Bunu değiştirmek için:

```html
<div class="logo">🔐</div>
```

Bunun yerine bir resim kullanmak isterseniz:

```html
<div class="logo">
  <img src="https://your-domain.com/logo.png" alt="Keeper Logo" style="width: 60px; height: 60px;" />
</div>
```

---

## 🔒 Güvenlik Notları

- Template'lerde **{{ .ConfirmationURL }}** mutlaka HTTPS olmalıdır
- Supabase Site URL ayarlarını kontrol edin:
  - **Site URL:** `https://ardakaratas.com.tr`
  - **Redirect URLs:**
    - `kisiselnot://auth`
    - `https://ardakaratas.com.tr/auth`

---

## 📝 Supabase Değişkenleri

Supabase email template'lerinde kullanılabilecek değişkenler:

| Değişken | Açıklama | Kullanıldığı Yerler |
|----------|----------|---------------------|
| `{{ .Email }}` | Kullanıcının e-posta adresi | Change Email |
| `{{ .ConfirmationURL }}` | Onay/giriş linki | Tüm template'ler |
| `{{ .Token }}` | Onay token'ı | Manuel link oluşturma |
| `{{ .SentAt }}` | Mailin gönderim tarihi/saati | Tüm template'ler |
| `{{ .SiteURL }}` | Supabase Site URL | Manuel link oluşturma |

---

## 🧪 Test Komutları

E-posta template'lerini test etmek için:

```bash
# Change Email testi
# 1. ProfileScreen'den e-posta değiştirme işlemi yapın
# 2. Yeni e-postaya gelen maili kontrol edin

# Confirm Signup testi
# 1. AuthScreen'den yeni hesap oluşturun
# 2. Kayıt e-postasına gelen onay mailini kontrol edin

# Reset Password testi
# 1. AuthScreen'den "Şifremi Unuttum" kullanın
# 2. E-postanıza gelen PIN sıfırlama mailini kontrol edin
```

---

## 📱 Deep Link Yönlendirme

Password reset için özel web sayfası kullanılıyor (`web/auth.html`):

1. Kullanıcı şifre sıfırlama isteği yapar
2. Supabase `https://ardakaratas.com.tr/auth` linkine yönlendirir
3. Web sayfası otomatik olarak `kisiselnot://auth` deep link'ini açar
4. Uygulama ResetPasswordScreen'i açar
5. Kullanıcı yeni 6 haneli PIN'ini girer

---

## 🐛 Sorun Giderme

### E-posta Gelmiyor
1. Spam klasörünü kontrol edin
2. Supabase dashboard'dan "Email Rate Limits" kontrolü yapın
3. SMTP ayarlarını kontrol edin (Supabase free tier Supabase SMTP kullanır)

### Template Düzgün Görünmüyor
1. HTML'i doğru yapıştırdığınızdan emin olun
2. "Enable custom email template" işaretli olmalı
3. Template'i test edin (Supabase'de "Send test email" butonu var)

### Deep Link Çalışmıyor
1. `app.json` dosyasındaki scheme kontrolü: `"scheme": "kisiselnot"`
2. Supabase Redirect URLs kontrolü
3. `web/auth.html` dosyasının doğru yerde olduğunu kontrol edin

---

## 📚 Referanslar

- [Supabase Email Templates Docs](https://supabase.com/docs/guides/auth/auth-email-templates)
- [React Native Deep Linking](https://reactnavigation.org/docs/deep-linking/)
- [Expo Linking](https://docs.expo.dev/guides/linking/)

---

**Hazırlayan:** Claude Code
**Tarih:** 2025-11-09
**Versiyon:** 1.0
