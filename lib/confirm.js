import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from './theme';
import { usePrefs } from './prefs';

const ConfirmContext = createContext({
  confirm: async () => false,
  alert: async () => {},
});

export const useConfirm = () => useContext(ConfirmContext);

// Alert türleri ve ikonları
const ALERT_TYPES = {
  error: { icon: 'close-circle', color: '#FF3B30', haptic: 'Error' },
  warning: { icon: 'warning', color: '#FF9500', haptic: 'Warning' },
  success: { icon: 'checkmark-circle', color: '#34C759', haptic: 'Success' },
  info: { icon: 'information-circle', color: '#007AFF', haptic: 'Success' },
};

export const ConfirmProvider = ({ children }) => {
  const { theme } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  
  // Confirm state
  const [state, setState] = useState({
    visible: false,
    title: 'Onay',
    message: '',
    confirmText: 'Onayla',
    cancelText: 'İptal',
    destructive: false,
    resolver: null,
  });

  // Alert state
  const [alertState, setAlertState] = useState({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttonText: 'Tamam',
    resolver: null,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Confirm styles
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
        // Alert styles
        alertOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        },
        alertContainer: {
          width: '100%',
          maxWidth: 320,
          backgroundColor: theme.colors.surface,
          borderRadius: 20,
          padding: 24,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 10,
        },
        alertIconContainer: {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        alertTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: 8,
        },
        alertMessage: {
          fontSize: 15,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 20,
        },
        alertButton: {
          width: '100%',
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        alertButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: '#FFFFFF',
        },
      }),
    [theme],
  );

  const close = useCallback(() => setState((s) => ({ ...s, visible: false })), []);
  const closeAlert = useCallback(() => setAlertState((s) => ({ ...s, visible: false })), []);

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

  // Alert fonksiyonu - type: 'error' | 'warning' | 'success' | 'info'
  const alert = useCallback((options = {}) => {
    return new Promise((resolve) => {
      const type = options.type ?? 'info';
      const alertConfig = ALERT_TYPES[type] || ALERT_TYPES.info;
      
      try { 
        if (hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType[alertConfig.haptic]); 
        }
      } catch {}
      
      setAlertState({
        visible: true,
        type,
        title: options.title ?? '',
        message: options.message ?? '',
        buttonText: options.buttonText ?? 'Tamam',
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

  const onAlertDismiss = useCallback(() => {
    alertState.resolver?.();
    closeAlert();
  }, [closeAlert, alertState.resolver]);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  const alertConfig = ALERT_TYPES[alertState.type] || ALERT_TYPES.info;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      
      {/* Confirm Modal */}
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

      {/* Alert Modal */}
      <Modal
        visible={alertState.visible}
        transparent
        animationType="fade"
        onRequestClose={onAlertDismiss}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <View style={[styles.alertIconContainer, { backgroundColor: alertConfig.color + '15' }]}>
              <Ionicons name={alertConfig.icon} size={40} color={alertConfig.color} />
            </View>
            <Text style={styles.alertTitle}>{alertState.title}</Text>
            {!!alertState.message && <Text style={styles.alertMessage}>{alertState.message}</Text>}
            <TouchableOpacity 
              style={[styles.alertButton, { backgroundColor: alertConfig.color }]} 
              onPress={onAlertDismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.alertButtonText}>{alertState.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
};
