import React, { useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../lib/theme';

// Usage: <BlurHeader ref={ref} title="..." onBack={...} actions={...} />
// ref exposes: ref.current.pulse()
const BlurHeader = forwardRef(({ title, onBack, actions }, ref) => {
  const { theme } = useAppTheme();
  const pulse = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    pulse: () => {
      pulse.value = 0;
      pulse.value = withSequence(withTiming(1, { duration: 220 }), withTiming(0, { duration: 260 }));
    },
  }));

  const aStyle = useAnimatedStyle(() => ({
    opacity: 1,
    shadowOpacity: Platform.OS === 'ios' ? 0 : 0,
    transform: [
      { scale: 1 },
    ],
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingTop: Platform.OS === 'android' ? 8 : 12,
          paddingHorizontal: 12,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        backButton: { padding: 8, borderRadius: 10 },
        title: { flex: 1, color: theme.colors.text, fontSize: 18, fontWeight: '700' },
        rightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        highlight: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          backgroundColor: theme.colors.primary,
          opacity: 0,
        },
      }),
    [theme],
  );

  return (
    <BlurView
      intensity={40}
      tint={theme.colors.surface === '#ffffff' ? 'light' : 'dark'}
      style={styles.container}
    >
      <Animated.View style={[styles.row, aStyle]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton} accessibilityLabel="Geri">
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rightRow}>{actions}</View>
      </Animated.View>
      <Animated.View style={[styles.highlight, highlightStyle]} />
    </BlurView>
  );
});

export default BlurHeader;
