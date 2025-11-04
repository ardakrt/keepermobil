// RLS test script for public.user_tokens
// Usage (PowerShell):
//   $env:SUPABASE_URL="https://<project>.supabase.co"
//   $env:SUPABASE_ANON_KEY="<anon-key>"
//   $env:TEST_USER_A_EMAIL="user_a@example.com"
//   $env:TEST_USER_A_PASSWORD="passwordA"
//   $env:TEST_USER_B_EMAIL="user_b@example.com"
//   $env:TEST_USER_B_PASSWORD="passwordB"
//   node scripts/test-rls.js

// Optional: load .env at repo root if present
try {
  require('dotenv').config();
} catch (_) {
  // dotenv not installed; environment vars can still be provided via shell
}

const { createClient } = require('@supabase/supabase-js');

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SERVICE_ROLE_KEY,
  TEST_USER_A_EMAIL,
  TEST_USER_A_PASSWORD,
  TEST_USER_B_EMAIL,
  TEST_USER_B_PASSWORD,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(2);
}

// Basic validation for SUPABASE_URL to give clearer feedback
try {
  const u = new URL(SUPABASE_URL);
  if (!/^https:$/.test(u.protocol)) {
    throw new Error('URL must start with https://');
  }
  if (!u.hostname.endsWith('.supabase.co')) {
    // Allow self-hosted domains but warn
    console.warn('Note: SUPABASE_URL does not end with .supabase.co; ensure this is correct for self-hosted setups.');
  }
} catch (e) {
  console.error('Invalid SUPABASE_URL:', e.message);
  console.error('Example: https://YOUR-PROJECT-REF.supabase.co');
  process.exit(2);
}

// Common mistake: keys pasted with angle brackets
if (/[<>]/.test(SUPABASE_ANON_KEY)) {
  console.error('SUPABASE_ANON_KEY içinde < veya > karakterleri tespit edildi. Lütfen anahtarı köşeli parantezler olmadan yapıştırın.');
  process.exit(2);
}
if (SERVICE_ROLE_KEY && /[<>]/.test(SERVICE_ROLE_KEY)) {
  console.error('SERVICE_ROLE_KEY içinde < veya > karakterleri tespit edildi. Lütfen anahtarı köşeli parantezler olmadan yapıştırın.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

function adminClient() {
  // Basit geçerlilik kontrolü: JWT benzeri (3 parça, yeterli uzunluk), placeholder değil
  const isValid =
    typeof SERVICE_ROLE_KEY === 'string' &&
    SERVICE_ROLE_KEY.split('.').length === 3 &&
    SERVICE_ROLE_KEY.length > 50 &&
    !/SERVICE-ROLE-KEY/i.test(SERVICE_ROLE_KEY);
  if (!isValid) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Not: RLS açıkken, anonim (signed-out) kullanıcı için SELECT genellikle hata dönmek yerine
// "0 satır" döndürür (policy filtresi nedeniyle). Hata da dönebilir; her iki durumda da erişim yok sayılır.
async function signedOutCannotRead() {
  const c = client();
  try {
    const { data, error } = await c.from('user_tokens').select('*');
    if (error) {
      // Ağ/DNS hatalarını RLS engeli gibi yorumlamayalım; netleştirici mesaj verelim
      if (/fetch failed/i.test(error.message || '')) {
        throw new Error('Ağ/DNS hatası: Supabase endpoint\'ine ulaşılamıyor. SUPABASE_URL doğru mu? İnternet bağlantısı/DNS kontrol edin.');
      }
      console.log('✔ Signed-out select blocked (error):', error.message);
      return;
    }
    if (Array.isArray(data) && data.length === 0) {
      console.log('✔ Signed-out cannot read any rows (0 returned)');
      return;
    }
    throw new Error(`RLS breach: signed-out received rows (count=${Array.isArray(data) ? data.length : 'unknown'})`);
  } catch (e) {
    // Supabase client bazen throw da edebilir (undici fetch). Bunu da ağ hatası olarak sınıflandıralım.
    const msg = (e && e.message) || String(e);
    if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(msg)) {
      throw new Error('Ağ/DNS hatası: Supabase endpoint\'ine ulaşılamıyor. SUPABASE_URL doğru mu? İnternet bağlantısı/DNS kontrol edin.');
    }
    throw e;
  }
}

async function signIn(email, password) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { c, user: data.user, session: data.session };
}

async function ensureUserExists(email, password) {
  const admin = adminClient();
  if (!admin) return; // No service role key provided; skip auto-creation.
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      // If user already exists, suppress; otherwise throw
      const msg = error.message || '';
      if (!/already/i.test(msg) && !/exists/i.test(msg)) throw error;
    } else if (data?.user) {
      console.log(`✔ Test kullanıcısı oluşturuldu/var: ${email}`);
    }
  } catch (e) {
    console.warn(`Test kullanıcısı oluşturulamadı (${email}):`, e.message || e);
  }
}

async function expectOwnRowsOnly(c, userId) {
  const { data, error } = await c.from('user_tokens').select('*');
  if (error) throw error;
  const others = (data || []).filter((r) => r.user_id !== userId);
  if (others.length) {
    throw new Error(`RLS breach: received rows not owned by user (${others.length})`);
  }
  console.log(`✔ User ${userId} sees only own rows (${(data||[]).length})`);
}

async function expectUpsertOwnAllowed(c, userId) {
  const payload = { user_id: userId, expo_token: 'test-token', updated_at: new Date().toISOString() };
  const { error } = await c.from('user_tokens').upsert(payload);
  if (error) throw error;
  console.log('✔ Upsert with own user_id allowed');
}

async function expectUpsertOtherDenied(c, otherUserId) {
  const payload = { user_id: otherUserId, expo_token: 'hijack', updated_at: new Date().toISOString() };
  const { error } = await c.from('user_tokens').upsert(payload);
  if (!error) {
    throw new Error('Expected upsert with foreign user_id to be denied');
  }
  console.log('✔ Upsert with foreign user_id denied as expected:', error.message);
}

async function main() {
  try {
    console.log('--- RLS quick test for public.user_tokens ---');
    // Yer tutucu/örnek URL kullanılmış olabilir, bunu erken yakalayalım
    if (/YOUR-PROJECT-REF|PROJE-REF|project\.supabase\.co|proje-ref/i.test(SUPABASE_URL)) {
      throw new Error('SUPABASE_URL yer tutucu gibi görünüyor. Dashboard > Settings > API sayfasından gerçek URL\'i kopyalayın.');
    }
  await signedOutCannotRead();

    if (!TEST_USER_A_EMAIL || !TEST_USER_A_PASSWORD || !TEST_USER_B_EMAIL || !TEST_USER_B_PASSWORD) {
      console.warn('Test users not provided, skipping authenticated checks. Provide TEST_USER_* envs to run full suite.');
      process.exit(0);
    }

    // Eğer SERVICE_ROLE_KEY sağlandıysa test kullanıcılarını admin API ile garanti altına al
    if (adminClient()) {
      console.log('SERVICE_ROLE_KEY geçerli: Test kullanıcıları hazır mı kontrol ediliyor...');
      await Promise.all([
        ensureUserExists(TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD),
        ensureUserExists(TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD),
      ]);
      await sleep(500);
    } else {
      if (SERVICE_ROLE_KEY) {
        console.warn('SERVICE_ROLE_KEY sağlandı ama geçersiz görünüyor (placeholder veya format hatası). Var olan kullanıcılarla giriş denenecek.');
      } else {
        console.log('SERVICE_ROLE_KEY sağlanmadı: Var olan test kullanıcıları ile giriş denenecek.');
      }
    }

    // Sign in as A
    let ca, ua;
    try {
      ({ c: ca, user: ua } = await signIn(TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD));
    } catch (err) {
      if (/invalid login credentials/i.test(err.message || '')) {
        if (SERVICE_ROLE_KEY) {
          await ensureUserExists(TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD);
          await sleep(300);
          ({ c: ca, user: ua } = await signIn(TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD));
        } else {
          throw new Error('Invalid login for A. Ya Dashboard > Authentication > Add user ile kullanıcı oluşturun ya da SERVICE_ROLE_KEY verin ki script otomatik oluştursun.');
        }
      } else {
        throw err;
      }
    }
    console.log('Signed in as A:', ua.id);
    await expectOwnRowsOnly(ca, ua.id);
    await expectUpsertOwnAllowed(ca, ua.id);

    // Sign in as B
    let cb, ub;
    try {
      ({ c: cb, user: ub } = await signIn(TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD));
    } catch (err) {
      if (/invalid login credentials/i.test(err.message || '')) {
        if (SERVICE_ROLE_KEY) {
          await ensureUserExists(TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD);
          await sleep(300);
          ({ c: cb, user: ub } = await signIn(TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD));
        } else {
          throw new Error('Invalid login for B. Ya Dashboard > Authentication > Add user ile kullanıcı oluşturun ya da SERVICE_ROLE_KEY verin ki script otomatik oluştursun.');
        }
      } else {
        throw err;
      }
    }
    console.log('Signed in as B:', ub.id);
    await expectOwnRowsOnly(cb, ub.id);
    await expectUpsertOtherDenied(cb, ua.id);

    console.log('All checks passed.');
  } catch (err) {
    console.error('RLS test failed:', err.message || err);
    process.exit(1);
  }
}

main();
