import * as SecureStore from 'expo-secure-store';
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
    const sessionStr = await SecureStore.getItemAsync(BIOMETRIC_SESSION_KEY);
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
    if (session) {
      await SecureStore.setItemAsync(BIOMETRIC_SESSION_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY);
    }
  },
};
