// Centralized theme system with light/dark palettes and a provider.
// Theme follows system preference by default and is stored locally (no Supabase dependency)
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from '@react-navigation/native';

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
  const isDark = mode === 'dark';

  // If accent color is provided, create subtle tinted variations
  if (accentColor) {
    const tintedBackground = createTintedBackground(colors.background, accentColor, 0.04);
    const tintedSurface = createTintedBackground(colors.surface, accentColor, 0.05);
    const tintedSurfaceElevated = createTintedBackground(colors.surfaceElevated, accentColor, 0.03);
    const tintedBorder = createTintedBackground(colors.border, accentColor, 0.08);

    return {
      dark: isDark,
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
    dark: isDark,
    colors,
    ...baseTheme,
  };
};

export const ThemeContext = createContext({
  mode: 'dark',
  theme: makeTheme('dark'),
  accent: null,
  setMode: (_m) => { },
  setAccent: (_c) => { },
});

export const useAppTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ initialMode = 'system', children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState(initialMode);
  const [accent, setAccent] = useState(null); // null | '#hex'

  // Load theme from AsyncStorage on mount (local storage only, no Supabase dependency)
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

  // Save theme to AsyncStorage when it changes (local only, no Supabase)
  useEffect(() => {
    (async () => {
      if (mode !== null) {
        await AsyncStorage.setItem(STORAGE_KEY, mode);
      }

      // Always save accent to AsyncStorage (even if null to clear it)
      if (accent !== null) {
        await AsyncStorage.setItem(ACCENT_KEY, accent);
      } else {
        await AsyncStorage.removeItem(ACCENT_KEY);
      }
    })();
  }, [mode, accent]);

  const value = useMemo(() => {
    const resolvedMode = mode === 'system' ? systemColorScheme : mode;
    const base = makeTheme(resolvedMode, accent);
    const themed = accent
      ? { ...base, colors: { ...base.colors, primary: accent } }
      : base;
    return { mode, theme: themed, accent, setMode, setAccent };
  }, [mode, accent, systemColorScheme, setMode, setAccent]);
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
