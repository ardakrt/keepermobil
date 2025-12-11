/**
 * PIN yönetimi - Supabase user_preferences tablosu ile çalışır
 * Web uygulaması ile tam uyumlu - aynı PIN hem web hem mobilde geçerli
 * PIN'ler Supabase'de bcrypt hash olarak saklanır (salt rounds: 10)
 */

import { supabase } from './supabaseClient';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import bcrypt from 'bcryptjs';
import { PIN_SESSION_KEY } from './storageKeys';

// React Native için bcryptjs'e random fallback ayarla
bcrypt.setRandomFallback((len) => {
  const buf = new Uint8Array(len);
  // expo-crypto ile random bytes üret
  const randomBytes = Crypto.getRandomBytes(len);
  for (let i = 0; i < len; i++) {
    buf[i] = randomBytes[i];
  }
  return Array.from(buf);
});

/**
 * PIN'i Supabase'e kaydet (user_preferences.pin - bcrypt hash)
 * Web uygulaması ile tam uyumlu (aynı bcryptjs kütüphanesi, salt rounds: 10)
 * @param {string} pin - 6 haneli PIN
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function savePinToCloud(pin) {
  try {
    // PIN'in string olduğundan emin ol
    const pinString = String(pin || '');
    
    if (!pinString || pinString.length !== 6) {
      console.error('Geçersiz PIN formatı:', pinString);
      return { success: false, error: 'PIN 6 haneli olmalıdır' };
    }

    // Kullanıcı ID'sini al
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Kullanıcı bilgisi alınamadı:', userError);
      return { success: false, error: 'Oturum bulunamadı' };
    }

    console.log('PIN kaydetme - userId:', user.id);
    console.log('PIN kaydetme - PIN:', pinString);

    // 1. YÖNTEM: RPC ile kaydetmeyi dene (Server-side hashing)
    // Bu yöntem daha güvenlidir ve istemci taraflı kütüphane sorunlarından etkilenmez
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('save_user_pin', { p_pin: pinString });
      
      // Eğer RPC fonksiyonu yoksa (PGRST202) veya başka bir hata varsa client-side'a düş
      if (!rpcError) {
        console.log('PIN başarıyla kaydedildi (RPC)');
        return { success: true };
      }
      
      console.warn('PIN kaydetme RPC hatası, client-side denenecek:', rpcError.code, rpcError.message);
    } catch (rpcEx) {
      console.warn('PIN kaydetme RPC exception:', rpcEx);
    }

    // 2. YÖNTEM: Client-side hashing (Fallback)
    // Web uygulaması ile tam uyumlu (aynı bcryptjs kütüphanesi, salt rounds: 10)
    const hashedPin = await bcrypt.hash(pinString, 10);
    console.log('PIN kaydetme - hash oluşturuldu (Client-side)');

    // user_preferences tablosuna kaydet (upsert)
    // Yeni kayıtlarda varsayılan tema dark olsun
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        pin: hashedPin,
        theme_mode_mobile: 'dark',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('PIN kaydetme hatası:', error);
      return { success: false, error: error.message };
    }
    
    console.log('PIN başarıyla kaydedildi');
    return { success: true };
  } catch (err) {
    console.error('PIN kaydetme exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * PIN'i Supabase'den doğrula - bcryptjs ile client-side karşılaştırma
 * Web uygulaması ile tam uyumlu (aynı bcryptjs kütüphanesi)
 * @param {string} pin - 6 haneli PIN
 * @param {string} userId - Kullanıcı ID'si (opsiyonel - session yoksa kullanılır)
 * @returns {Promise<{success: boolean, valid: boolean, not_found?: boolean, error?: string}>}
 */
export async function verifyPinFromCloud(pin, userId = null) {
  try {
    // Kullanıcı ID'sini belirle - parametre verilmişse onu kullan, yoksa session'dan al
    let targetUserId = userId;
    
    if (!targetUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Kullanıcı bilgisi alınamadı:', userError);
        return { success: false, valid: false, error: 'Oturum bulunamadı' };
      }
      targetUserId = user.id;
    }

    const { data: pref, error: prefError } = await supabase
      .from('user_preferences')
      .select('pin')
      .eq('user_id', targetUserId)
      .maybeSingle();

    // PGRST116 = no rows found - bu durumda PIN yok demektir
    if (prefError && prefError.code !== 'PGRST116') {
      console.error('PIN alınamadı:', prefError);
      return { success: false, valid: false, error: prefError.message };
    }

    if (!pref || !pref.pin) {
      return { success: false, valid: false, not_found: true, error: 'PIN ayarlanmamış' };
    }

    // 1. YÖNTEM: RPC ile doğrulamayı dene
    try {
      // Sadece kendi kullanıcımız için RPC çalışır, başkası için client-side devam et
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === targetUserId) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('verify_user_pin', { p_pin: pin });
        
        if (!rpcError && rpcData) {
          console.log('PIN doğrulama (RPC) - sonuç:', rpcData.valid);
          return { success: true, valid: rpcData.valid };
        }
        console.warn('PIN doğrulama RPC hatası, client-side denenecek:', rpcError);
      }
    } catch (rpcEx) {
      console.warn('PIN doğrulama RPC exception:', rpcEx);
    }

    // 2. YÖNTEM: Client-side verification (Fallback)
    // Debug: PIN hash'ini ve girilen PIN'i logla
    console.log('PIN doğrulama - userId:', targetUserId);
    console.log('PIN doğrulama - girilen PIN:', pin);
    console.log('PIN doğrulama - kayıtlı hash:', pref.pin?.substring(0, 20) + '...');

    // bcryptjs ile karşılaştır (web ile aynı)
    const isValid = await bcrypt.compare(pin, pref.pin);
    console.log('PIN doğrulama (Client-side) - sonuç:', isValid);

    return { 
      success: true, 
      valid: isValid 
    };
  } catch (err) {
    console.error('PIN doğrulama exception:', err);
    return { success: false, valid: false, error: err.message };
  }
}

/**
 * Kullanıcının Supabase'de PIN'i var mı kontrol et
 * @param {string} userId - Kullanıcı ID'si (opsiyonel - session yoksa kullanılır)
 * @returns {Promise<{success: boolean, has_pin: boolean, error?: string}>}
 */
export async function hasCloudPin(userId = null) {
  try {
    // Kullanıcı ID'sini belirle - parametre verilmişse onu kullan, yoksa session'dan al
    let targetUserId = userId;
    
    if (!targetUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Kullanıcı bilgisi alınamadı:', userError);
        return { success: false, has_pin: false, error: 'Oturum bulunamadı' };
      }
      targetUserId = user.id;
    }

    const { data: pref, error: prefError } = await supabase
      .from('user_preferences')
      .select('pin')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (prefError && prefError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('PIN kontrol hatası:', prefError);
      return { success: false, has_pin: false, error: prefError.message };
    }

    const hasPin = !!(pref && pref.pin);
    
    return { success: true, has_pin: hasPin };
  } catch (err) {
    console.error('PIN kontrol exception:', err);
    return { success: false, has_pin: false, error: err.message };
  }
}

/**
 * Supabase'deki PIN'i sil
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteCloudPin() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Kullanıcı bilgisi alınamadı:', userError);
      return { success: false, error: 'Oturum bulunamadı' };
    }

    const { error } = await supabase
      .from('user_preferences')
      .update({ pin: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      console.error('PIN silme hatası:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err) {
    console.error('PIN silme exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * PIN'i Supabase'e kaydet (Web ile uyumlu)
 * @param {string} pin - 6 haneli PIN
 * @param {string} userId - Kullanıcı ID'si (kullanılmıyor, uyumluluk için)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function savePin(pin, userId) {
  return await savePinToCloud(pin);
}

/**
 * PIN'i Supabase'den doğrula (bcryptjs ile client-side karşılaştırma)
 * @param {string} pin - 6 haneli PIN
 * @param {string} userId - Kullanıcı ID'si (session yoksa bu ID kullanılır)
 * @returns {Promise<{success: boolean, valid: boolean, error?: string}>}
 */
export async function verifyPin(pin, userId) {
  return await verifyPinFromCloud(pin, userId);
}

/**
 * Kullanıcının PIN'i var mı kontrol et (cloud'dan)
 * @param {string} userId - Kullanıcı ID'si (session yoksa bu ID kullanılır)
 * @returns {Promise<{has_pin: boolean, source: string}>}
 */
export async function hasPin(userId) {
  const cloudResult = await hasCloudPin(userId);
  
  return { 
    has_pin: cloudResult.has_pin || false, 
    source: cloudResult.has_pin ? 'cloud' : 'none' 
  };
}

/**
 * Lokal PIN session'ı temizle (çıkış yapılırken)
 * @param {string} userId - Kullanıcı ID'si (kullanılmıyor)
 */
export async function clearLocalPin(userId) {
  try {
    await SecureStore.deleteItemAsync(PIN_SESSION_KEY);
  } catch (err) {
    console.warn('PIN session temizleme hatası:', err);
  }
}

export default {
  savePin,
  verifyPin,
  hasPin,
  savePinToCloud,
  verifyPinFromCloud,
  hasCloudPin,
  deleteCloudPin,
  clearLocalPin,
};
