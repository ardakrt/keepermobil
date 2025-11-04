import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from './theme';

const HUDContext = createContext({
  showHUD: (type = 'success', duration = 1200) => {},
});

export const useHUD = () => useContext(HUDContext);

export const HUDProvider = ({ children }) => {
  const { theme } = useAppTheme();
  const [state, setState] = useState({ visible: false, type: 'success' });
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const timeoutRef = useRef(null);

  const showHUD = useCallback((type = 'success', duration = 1200) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState({ visible: true, type });
    opacity.setValue(0);
    scale.setValue(0.9);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
    ]).start();
    timeoutRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setState((s) => ({ ...s, visible: false }));
      });
    }, duration);
  }, [opacity, scale]);

  const value = useMemo(() => ({ showHUD }), [showHUD]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
        },
        bubble: {
          width: 88,
          height: 88,
          borderRadius: 44,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
      }),
    [],
  );

  const tint = state.type === 'success' ? theme.colors.success : theme.colors.danger;
  const icon = state.type === 'success' ? 'check' : 'close';

  return (
    <HUDContext.Provider value={value}>
      {children}
      {state.visible ? (
        <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
          <Animated.View style={[styles.bubble, { backgroundColor: tint, transform: [{ scale }] }]}>
            <MaterialCommunityIcons name={icon} size={46} color={'#fff'} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </HUDContext.Provider>
  );
};
