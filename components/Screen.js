import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from '../lib/theme';

export const Screen = ({ children, padded = true, style }) => {
  const { theme, mode } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        container: {
          flex: 1,
        },
        padded: {
          padding: theme.spacing.xl,
        },
      }),
    [theme],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.container, padded && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
};

export default Screen;
