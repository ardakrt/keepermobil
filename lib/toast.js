import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAppTheme } from './theme';

const ToastContext = createContext({
  showToast: (title, body, duration) => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const { theme } = useAppTheme();
  const [toast, setToast] = useState(null); // { title, body }
  const timeoutRef = useRef(null);
  const anim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible

  const showToast = useCallback((title, body = null, duration = 2000) => {
    if (!title) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setToast({ title, body });
    anim.stopAnimation();
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    timeoutRef.current = setTimeout(() => setToast(null), duration);
    // Animate out slightly before removal
    const outDelay = Math.max(0, duration - 180);
    setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }, outDelay);
  }, [anim]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        toastContainer: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 32,
          padding: 16,
          borderRadius: 14,
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
          gap: 6,
        },
        toastTitle: {
          color: theme.colors.text,
          fontWeight: '700',
          fontSize: 15,
        },
        toastBody: {
          color: theme.colors.textSecondary,
          fontSize: 14,
        },
      }),
    [theme],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
                },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastTitle}>{toast.title}</Text>
          {toast.body ? <Text style={styles.toastBody}>{toast.body}</Text> : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};
