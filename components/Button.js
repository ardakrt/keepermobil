import React, { useRef } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useAppTheme } from '../lib/theme';

export const Button = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // primary | success | outline | ghost
  style,
  textStyle,
  animatedPress = true,
}) => {
  const { theme } = useAppTheme();
  const getVariant = () => {
    switch (variant) {
      case 'success':
        return { bg: theme.colors.success, fg: theme.colors.background, border: theme.colors.success };
      case 'outline':
        return { bg: 'transparent', fg: theme.colors.text, border: theme.colors.border };
      case 'ghost':
        return { bg: 'transparent', fg: theme.colors.textSecondary, border: 'transparent' };
      default:
        return { bg: theme.colors.primary, fg: theme.colors.background, border: theme.colors.primary };
    }
  };

  const v = getVariant();
  const isDisabled = disabled || loading;

  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    if (!animatedPress || isDisabled) return;
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };
  const handlePressOut = () => {
    if (!animatedPress) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={typeof title === 'string' ? title : undefined}
        style={[
          styles.base,
          { backgroundColor: v.bg, borderColor: v.border, opacity: isDisabled ? 0.7 : 1 },
          style,
        ]}
      >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.title, { color: v.fg }, textStyle]}>{title}</Text>
      )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontWeight: '700',
    fontSize: 16,
  },
});

export default Button;
