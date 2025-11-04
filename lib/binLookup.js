/**
 * BIN Lookup Service
 * Kart numarasının ilk 6-8 hanesinden banka ve kart bilgilerini sorgular
 */

// BIN sonuç cache'i - performans için
const binResultCache = new Map();

// Troy ve Türk bankaları için statik BIN listesi (hız için)
const STATIC_BINS = {
  // Troy kartları
  '979206': { bankName: 'Ziraat Bankası', cardBrand: 'Troy', cardType: 'debit', countryCode: 'TR' },
  '979207': { bankName: 'Ziraat Bankası', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '979216': { bankName: 'Vakıfbank', cardBrand: 'Troy', cardType: 'debit', countryCode: 'TR' },
  '979217': { bankName: 'Vakıfbank', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '979226': { bankName: 'Halkbank', cardBrand: 'Troy', cardType: 'debit', countryCode: 'TR' },
  '979227': { bankName: 'Halkbank', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '979244': { bankName: 'Finansbank', cardBrand: 'Troy', cardType: 'debit', countryCode: 'TR' },
  '979245': { bankName: 'Finansbank', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '979262': { bankName: 'TEB', cardBrand: 'Troy', cardType: 'debit', countryCode: 'TR' },
  '979263': { bankName: 'TEB', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '979280': { bankName: 'ING Bank', cardBrand: 'Troy', cardType: 'debit', countryCode: 'TR' },
  '979281': { bankName: 'ING Bank', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '979290': { bankName: 'Denizbank', cardBrand: 'Troy', cardType: 'debit', countryCode: 'TR' },
  '979291': { bankName: 'Denizbank', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '650052': { bankName: 'Ziraat Bankası', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '650082': { bankName: 'Denizbank', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '650092': { bankName: 'Vakıfbank', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '650170': { bankName: 'Garanti BBVA', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  '650173': { bankName: 'Yapı Kredi', cardBrand: 'Troy', cardType: 'credit', countryCode: 'TR' },
  // Popüler Türk banka kartları (Mastercard/Visa)
  '540667': { bankName: 'Yapı Kredi', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '540668': { bankName: 'Yapı Kredi', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '545847': { bankName: 'Yapı Kredi', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '552879': { bankName: 'Garanti BBVA', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '549449': { bankName: 'Garanti BBVA', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '557113': { bankName: 'İş Bankası', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '510152': { bankName: 'Finansbank', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '518896': { bankName: 'Akbank', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '520302': { bankName: 'Akbank', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '522204': { bankName: 'Akbank', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '535601': { bankName: 'Akbank', cardBrand: 'Mastercard', cardType: 'credit', countryCode: 'TR' },
  '404591': { bankName: 'Ziraat Bankası', cardBrand: 'Visa', cardType: 'debit', countryCode: 'TR' },
  '453955': { bankName: 'Ziraat Bankası', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '454671': { bankName: 'Ziraat Bankası', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '454672': { bankName: 'Ziraat Bankası', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '411942': { bankName: 'Halkbank', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '420556': { bankName: 'Halkbank', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '420557': { bankName: 'Halkbank', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '428220': { bankName: 'Vakıfbank', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '428221': { bankName: 'Vakıfbank', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '480296': { bankName: 'İş Bankası', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '408625': { bankName: 'İş Bankası', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '418342': { bankName: 'İş Bankası', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '426886': { bankName: 'İş Bankası', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '426887': { bankName: 'İş Bankası', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
  '426888': { bankName: 'İş Bankası', cardBrand: 'Visa', cardType: 'credit', countryCode: 'TR' },
};

// Çevrimiçi tekil BIN sorgu fallback'i (binlist.net)
const fetchBinOnline = async (bin) => {
  try {
    // Timeout controller - 2 saniye max
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const resp = await fetch(`https://lookup.binlist.net/${bin}`, {
      headers: { 'Accept-Version': '3' },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      bin,
      bankName: data?.bank?.name || 'Bilinmeyen Banka',
      cardBrand: data?.brand || data?.scheme || 'Kart',
      cardProgram: data?.brand || '',
      cardType: data?.type || '',
      countryCode: data?.country?.alpha2 || 'TR',
      cardLength: data?.number?.length || 16,
    };
  } catch {
    return null;
  }
};

/**
 * Kart numarasından BIN bilgilerini sorgular (cache destekli)
 * @param {string} cardNumber - Kart numarası (en az 6 hane)
 * @returns {Promise<object|null>} BIN bilgileri veya null
 */
export const lookupBin = async (cardNumber) => {
  if (!cardNumber || cardNumber.length < 6) {
    return null;
  }

  const cleanNumber = cardNumber.replace(/\D/g, '');
  const cacheKey = cleanNumber.substring(0, 8); // İlk 8 haneyi cache anahtarı olarak kullan
  
  // Cache'te varsa direkt dön
  if (binResultCache.has(cacheKey)) {
    return binResultCache.get(cacheKey);
  }

  // Önce statik listeden kontrol et (Troy ve Türk bankaları için)
  for (let length = 8; length >= 6; length--) {
    const bin = cleanNumber.substring(0, length);
    if (STATIC_BINS[bin]) {
      const result = {
        bin,
        bankName: STATIC_BINS[bin].bankName || 'Bilinmeyen Banka',
        cardBrand: STATIC_BINS[bin].cardBrand || 'Kart',
        cardProgram: STATIC_BINS[bin].cardProgram || '',
        cardType: STATIC_BINS[bin].cardType || '',
        countryCode: STATIC_BINS[bin].countryCode || 'TR',
        cardLength: STATIC_BINS[bin].cardLength || 16,
      };
      binResultCache.set(cacheKey, result);
      return result;
    }
  }

  // Statik listede yoksa online API kullan (sadece ilk kez)
  for (let length = 8; length >= 6; length--) {
    const bin = cleanNumber.substring(0, length);
    const online = await fetchBinOnline(bin);
    if (online) {
      binResultCache.set(cacheKey, online);
      return online;
    }
  }

  // Bulunamadı, null'u da cache'le (gereksiz API çağrılarını önlemek için)
  binResultCache.set(cacheKey, null);
  return null;
};

/**
 * BIN bilgilerini formatlar ve marka ismini döndürür
 * @param {object} binInfo - BIN bilgisi
 * @returns {string} Kart markası
 */
export const getBrandFromBin = (binInfo) => {
  if (!binInfo || !binInfo.cardBrand) {
    return 'Kart';
  }

  const brand = binInfo.cardBrand.toLowerCase();

  if (brand.includes('visa')) return 'Visa';
  if (brand.includes('master')) return 'Mastercard';
  if (brand.includes('amex') || brand.includes('american')) return 'American Express';
  if (brand.includes('troy')) return 'Troy';
  if (brand.includes('discover')) return 'Discover';

  return binInfo.cardBrand;
};

/**
 * Cache'i temizler (test amaçlı)
 */
export const clearBinCache = () => {
  binResultCache.clear();
};
