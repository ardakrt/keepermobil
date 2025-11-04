import React, { useMemo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useAppTheme } from '../lib/theme';

export const Input = ({ label, helper, style, inputStyle, ...props }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        field: { gap: 8 },
        label: {
          fontSize: theme.typography.label,
          color: theme.colors.textSecondary,
          fontWeight: '600',
        },
        input: {
          height: 48,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          fontSize: 16,
        },
        helper: { color: theme.colors.muted, fontSize: theme.typography.small },
      }),
    [theme],
  );

  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.colors.muted}
        style={[styles.input, inputStyle]}
        {...props}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
};

export default Input;
