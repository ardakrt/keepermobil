import Constants from 'expo-constants';

// Uygulama içi özel şema fallback
export const APP_SCHEME_RESET_URL = 'kisiselnot://auth';

// app.json -> expo.extra.resetRedirectBase
// Örn: https://kisiselnot.example.com
export function getResetRedirectURL() {
  const base = Constants.expoConfig?.extra?.resetRedirectBase;
  if (typeof base === 'string' && /^https?:\/\//.test(base)) {
    return base.replace(/\/+$/, '') + '/auth';
  }
  return APP_SCHEME_RESET_URL;
}
