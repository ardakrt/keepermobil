import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Resolve Supabase credentials from Expo's environment-aware config.
// Also fallback to NEXT_PUBLIC_ variables for compatibility with web .env
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  Constants.expoConfig?.extra?.supabaseUrl ??
  Constants.manifest?.extra?.supabaseUrl;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  Constants.manifest?.extra?.supabaseAnonKey;

// Fail fast so we spot missing configuration during development builds.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_...) before using the client.',
  );
}

// Supabase client instance the rest of the app can consume.
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: false, // Explicitly manage persistence in AsyncStorage via the auth screen.
    detectSessionInUrl: false,
  },
});
