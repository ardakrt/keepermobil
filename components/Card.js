import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../lib/theme';

export const Card = ({ children, style }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          width: '100%',
          maxWidth: 520,
          padding: theme.spacing.xl * 1.25,
          borderRadius: 16,
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 6,
          gap: theme.spacing.lg,
        },
      }),
    [theme],
  );

  return <View style={[styles.card, style]}>{children}</View>;
};

export default Card;
