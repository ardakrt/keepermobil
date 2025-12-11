import Constants from 'expo-constants';

// Uygulama içi özel şema - web sitesi bu scheme ile uygulamaya yönlendirecek
export const APP_SCHEME = 'keeper';
export const APP_SCHEME_RESET_URL = `${APP_SCHEME}://auth`;

// app.json -> expo.extra.resetRedirectBase
// Örn: https://ardakaratas.com.tr
// Web sitesi token'ı alıp keeper://auth?token=...&type=recovery şeklinde yönlendirecek
export function getResetRedirectURL() {
  const base = Constants.expoConfig?.extra?.resetRedirectBase;
  if (typeof base === 'string' && /^https?:\/\//.test(base)) {
    return base.replace(/\/+$/, '') + '/auth';
  }
  return APP_SCHEME_RESET_URL;
}

// Doğrudan uygulama scheme'i ile URL oluştur
export function getAppSchemeURL(path = 'auth', params = {}) {
  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${APP_SCHEME}://${path}${queryString ? '?' + queryString : ''}`;
}
