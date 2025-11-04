import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from './theme';
import { usePrefs } from './prefs';

const ConfirmContext = createContext({
  confirm: async () => false,
});

export const useConfirm = () => useContext(ConfirmContext);

export const ConfirmProvider = ({ children }) => {
  const { theme } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const [state, setState] = useState({
    visible: false,
    title: 'Onay',
    message: '',
    confirmText: 'Onayla',
    cancelText: 'İptal',
    destructive: false,
    resolver: null,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          gap: 14,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        title: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
        message: { color: theme.colors.textSecondary },
        actions: { flexDirection: 'row', gap: 12 },
        action: {
          flex: 1,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cancel: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        confirm: {
          backgroundColor: theme.colors.primary,
        },
        confirmDestructive: {
          backgroundColor: theme.colors.danger,
        },
        actionText: {
          color: theme.colors.background,
          fontWeight: '700',
        },
        actionTextOnSurface: { color: theme.colors.text, fontWeight: '700' },
      }),
    [theme],
  );

  const close = useCallback(() => setState((s) => ({ ...s, visible: false })), []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      try { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      setState({
        visible: true,
        title: options.title ?? 'Onay',
        message: options.message ?? '',
        confirmText: options.confirmText ?? 'Onayla',
        cancelText: options.cancelText ?? 'İptal',
        destructive: !!options.destructive,
        resolver: resolve,
      });
    });
  }, [hapticsEnabled]);

  const onCancel = useCallback(() => {
    state.resolver?.(false);
    close();
  }, [close, state.resolver]);

  const onConfirm = useCallback(() => {
    try { if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    state.resolver?.(true);
    close();
  }, [close, state.resolver, hapticsEnabled]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        visible={state.visible}
        transparent
        animationType="fade"
        onRequestClose={onCancel}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{state.title}</Text>
            {!!state.message && <Text style={styles.message}>{state.message}</Text>}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.action, styles.cancel]} onPress={onCancel}>
                <Text style={styles.actionTextOnSurface}>{state.cancelText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.action, state.destructive ? styles.confirmDestructive : styles.confirm]}
                onPress={onConfirm}
              >
                <Text style={styles.actionText}>{state.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ConfirmContext.Provider>
  );
};
