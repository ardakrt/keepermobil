// Centralized theme system with light/dark palettes and a provider.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from '@react-navigation/native';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'APP_THEME_MODE'; // 'light' | 'dark' | 'system'
const ACCENT_KEY = 'APP_THEME_ACCENT'; // hex color string like '#7c3aed' or null

const darkColors = {
  background: '#0b0b12',
  surface: '#111118',
  surfaceElevated: '#0e0e16',
  border: '#232335',
  text: '#e7e7ee',
  textSecondary: '#a1a1b5',
  muted: '#6b6b82',
  primary: '#ffffff',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#c084fc',
};

const lightColors = {
  background: '#f7f7fb',
  surface: '#ffffff',
  surfaceElevated: '#f2f2f7',
  border: '#f7f7fb',
  text: '#0e0e16',
  textSecondary: '#4b5563',
  muted: '#6b7280',
  primary: '#000000',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  info: '#8b5cf6',
};

export const baseTheme = {
  radii: { xs: 6, sm: 8, md: 12, lg: 16, xl: 20 },
  spacing: { xs: 6, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  typography: { title: 28, subtitle: 16, body: 15, label: 14, small: 12 },
};

// Hex to RGB helper
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Create a subtle tinted background by mixing accent color with base background
const createTintedBackground = (baseColor, accentColor, tintStrength = 0.04) => {
  const baseRgb = hexToRgb(baseColor);
  const accentRgb = hexToRgb(accentColor);

  if (!baseRgb || !accentRgb) return baseColor;

  const r = Math.round(baseRgb.r * (1 - tintStrength) + accentRgb.r * tintStrength);
  const g = Math.round(baseRgb.g * (1 - tintStrength) + accentRgb.g * tintStrength);
  const b = Math.round(baseRgb.b * (1 - tintStrength) + accentRgb.b * tintStrength);

  return `rgb(${r}, ${g}, ${b})`;
};

export const makeTheme = (mode = 'light', accentColor = null) => {
  const colors = mode === 'dark' ? darkColors : lightColors;

  // If accent color is provided, create subtle tinted variations
  if (accentColor) {
    const tintedBackground = createTintedBackground(colors.background, accentColor, 0.04);
    const tintedSurface = createTintedBackground(colors.surface, accentColor, 0.05);
    const tintedSurfaceElevated = createTintedBackground(colors.surfaceElevated, accentColor, 0.03);
    const tintedBorder = createTintedBackground(colors.border, accentColor, 0.08);

    return {
      colors: {
        ...colors,
        backgroundTinted: tintedBackground,
        surfaceTinted: tintedSurface,
        surfaceElevatedTinted: tintedSurfaceElevated,
        borderTinted: tintedBorder,
      },
      ...baseTheme,
    };
  }

  return {
    colors,
    ...baseTheme,
  };
};

export const ThemeContext = createContext({
  mode: 'light',
  theme: makeTheme('light'),
  accent: null,
  setMode: (_m) => {},
  setAccent: (_c) => {},
});

export const useAppTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ initialMode = 'light', children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState(initialMode);
  const [accent, setAccent] = useState(null); // null | '#hex'
  const [session, setSession] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const storedMode = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedMode) {
          setMode(storedMode);
        }
        const storedAccent = await AsyncStorage.getItem(ACCENT_KEY);
        if (storedAccent) {
          setAccent(storedAccent);
        }
      } catch (e) {
        console.warn('[ThemeProvider] Failed to load theme from AsyncStorage', e);
      }
    })();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN' && session?.user) {
        supabase
          .from('user_preferences')
          .select('theme_mode, accent_color')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.error('[ThemeProvider] Error fetching theme preferences:', error);
            } else if (data) {
              if (data.theme_mode) {
                setMode(data.theme_mode);
                AsyncStorage.setItem(STORAGE_KEY, data.theme_mode);
              }
              if (data.accent_color) {
                setAccent(data.accent_color);
                AsyncStorage.setItem(ACCENT_KEY, data.accent_color);
              }
            } else {
            }
          })
          .catch(err => {
            console.error('[ThemeProvider] An unexpected error occurred during theme load:', err);
          });
      } else if (event === 'SIGNED_OUT') {
        // We no longer reset the theme, so it persists on the login screen.
        // The session state is already cleared by the onAuthStateChange listener.
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (mode !== null) {
        await AsyncStorage.setItem(STORAGE_KEY, mode);
      }
      if (accent !== null) {
        await AsyncStorage.setItem(ACCENT_KEY, accent);
      }

      if (session?.user) {
        const payload = {
          user_id: session.user.id,
          theme_mode: mode,
          accent_color: accent,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('user_preferences').upsert(payload);

        if (error) {
          console.error('[ThemeProvider] Theme preferences save to Supabase failed:', error);
        } else {
        }
      }
    })();
  }, [mode, accent, session]);

  const value = useMemo(() => {
    const resolvedMode = mode === 'system' ? systemColorScheme : mode;
    const base = makeTheme(resolvedMode, accent);
    const themed = accent
      ? { ...base, colors: { ...base.colors, primary: accent } }
      : base;
    return { mode, theme: themed, accent, setMode, setAccent };
  }, [mode, accent, systemColorScheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const makeNavTheme = (mode = 'light') => {
  const palette = makeTheme(mode).colors;
  const base = mode === 'dark' ? NavigationDarkTheme : NavigationLightTheme;
  return {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      primary: palette.primary,
      border: palette.border,
      notification: palette.primary,
    },
  };
};
