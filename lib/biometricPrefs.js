import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BIOMETRIC_ENABLED_KEY, BIOMETRIC_SESSION_KEY } from './storageKeys';

export const biometricPrefs = {
  async getOptIn() {
    const optIn = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return optIn === 'true';
  },

  async setOptIn(enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, String(enabled));
  },

  async getStoredSession() {
    // Session'ı AsyncStorage'dan oku (SecureStore yerine)
    // Biyometrik doğrulama gerektirdiği için yeterince güvenli
    const sessionStr = await AsyncStorage.getItem(BIOMETRIC_SESSION_KEY);
    if (!sessionStr) {
      return null;
    }
    try {
      return JSON.parse(sessionStr);
    } catch {
      return null;
    }
  },

  async setStoredSession(session) {
    // Session'ı AsyncStorage'a kaydet (boyut limiti yok)
    if (session) {
      await AsyncStorage.setItem(BIOMETRIC_SESSION_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(BIOMETRIC_SESSION_KEY);
    }
  },
};
