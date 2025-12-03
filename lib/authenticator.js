import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabaseClient';
import { BasisTheory } from '@basis-theory/basis-theory-js';

const AuthenticatorContext = createContext({
  otpCodes: [],
  secrets: {},
  loading: true,
  reload: () => {},
});

export const useAuthenticator = () => useContext(AuthenticatorContext);

const btApiKey = Constants.expoConfig?.extra?.basisTheoryApiKey || process.env.EXPO_PUBLIC_BASIS_THEORY_API_KEY;
let bt;

export function AuthenticatorProvider({ children, userId }) {
  const [otpCodes, setOtpCodes] = useState([]);
  const [secrets, setSecrets] = useState({});
  const [loading, setLoading] = useState(true);

  const loadSecrets = useCallback(async (codes) => {
    const loadedSecrets = {};

    if (!bt) {
      console.error('Basis Theory not initialized');
      return;
    }

    for (const code of codes) {
      try {
        const token = await bt.tokens.retrieve(code.bt_token_id_secret);

        if (token?.data) {
          loadedSecrets[code.id] = token.data;
        }
      } catch (error) {
        console.error(`Failed to load secret for ${code.service_name}:`, error);
      }
    }

    setSecrets(loadedSecrets);
  }, []);

  const loadOTPCodes = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Initialize Basis Theory if not already initialized
      if (!bt && btApiKey) {
        bt = await new BasisTheory().init(btApiKey);
      }

      const { data, error } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });


      if (error) {
        throw new Error('Database error: ' + error.message);
      }

      setOtpCodes(data || []);
      setLoading(false);


      // Load secrets progressively in background
      if (data && data.length > 0) {
        loadSecrets(data);
      }
    } catch (error) {
      console.error('Load OTP codes error:', error);
      setLoading(false);
      Alert.alert('Hata', 'Kod listesi yüklenirken hata oluştu: ' + error.message);
    }
  }, [userId, loadSecrets]);

  // Auto-load when userId changes
  useEffect(() => {
    loadOTPCodes();
  }, [loadOTPCodes]);

  const value = {
    otpCodes,
    secrets,
    loading,
    reload: loadOTPCodes,
  };

  return (
    <AuthenticatorContext.Provider value={value}>
      {children}
    </AuthenticatorContext.Provider>
  );
}
