import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'PREFS_HAPTICS_ENABLED';
const MOTION_KEY = 'PREFS_REDUCE_MOTION';

const PrefsContext = createContext({
  hapticsEnabled: true,
  setHapticsEnabled: (_v) => {},
  toggleHaptics: () => {},
  reduceMotion: false,
  setReduceMotion: (_v) => {},
  toggleReduceMotion: () => {},
});

export const usePrefs = () => useContext(PrefsContext);

export const PrefsProvider = ({ children }) => {
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'true' || stored === 'false') {
          setHapticsEnabled(stored === 'true');
        }
        const rm = await AsyncStorage.getItem(MOTION_KEY);
        if (rm === 'true' || rm === 'false') {
          setReduceMotion(rm === 'true');
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, String(hapticsEnabled)).catch(() => undefined);
  }, [hapticsEnabled]);

  useEffect(() => {
    AsyncStorage.setItem(MOTION_KEY, String(reduceMotion)).catch(() => undefined);
  }, [reduceMotion]);


  const toggleHaptics = useCallback(() => setHapticsEnabled((s) => !s), []);
  const toggleReduceMotion = useCallback(() => setReduceMotion((s) => !s), []);

  const value = useMemo(
    () => ({ hapticsEnabled, setHapticsEnabled, toggleHaptics, reduceMotion, setReduceMotion, toggleReduceMotion }),
    [hapticsEnabled, toggleHaptics, reduceMotion, toggleReduceMotion],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
};
