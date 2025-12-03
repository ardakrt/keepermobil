import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface LoginRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  ip_address: string | null;
  device_info: string | null;
  browser_info: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface PushAuthContextType {
  enabled: boolean;
  setEnabled: (value: boolean) => Promise<void>;
  requireBiometric: boolean;
  setRequireBiometric: (value: boolean) => Promise<void>;
  pendingRequest: LoginRequest | null;
  approveRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  isProcessing: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEYS = {
  PUSH_AUTH_ENABLED: '@keeper_push_auth_enabled',
  PUSH_AUTH_REQUIRE_BIOMETRIC: '@keeper_push_auth_require_biometric',
} as const;

const NOTIFICATION_CATEGORY_ID = 'LOGIN_REQUEST';

// ============================================
// CONTEXT CREATION
// ============================================

const PushAuthContext = createContext<PushAuthContextType>({
  enabled: false,
  setEnabled: async () => {},
  requireBiometric: false,
  setRequireBiometric: async () => {},
  pendingRequest: null,
  approveRequest: async () => {},
  rejectRequest: async () => {},
  isProcessing: false,
});

export const usePushAuth = () => {
  const context = useContext(PushAuthContext);
  if (!context) {
    throw new Error('usePushAuth must be used within PushAuthProvider');
  }
  return context;
};

// ============================================
// PROVIDER COMPONENT
// ============================================

interface PushAuthProviderProps {
  children: React.ReactNode;
  userId: string | null;
}

export function PushAuthProvider({ children, userId }: PushAuthProviderProps) {
  // ========== STATE ==========
  const [enabled, setEnabledState] = useState<boolean>(false);
  const [requireBiometric, setRequireBiometricState] = useState<boolean>(false);
  const [pendingRequest, setPendingRequest] = useState<LoginRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // ========== REFS ==========
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);
  const notificationListenerRef = useRef<Notifications.Subscription | null>(null);

  // ============================================
  // SETUP NOTIFICATION CATEGORIES
  // ============================================
  useEffect(() => {
    setupNotificationCategories();
    setupNotificationResponseListener();

    return () => {
      // Cleanup notification listener
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
    };
  }, []);

  const setupNotificationCategories = async () => {
    try {
      await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
        {
          identifier: 'APPROVE',
          buttonTitle: 'Onayla',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'REJECT',
          buttonTitle: 'Reddet',
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
      ]);
    } catch (error) {
      console.error('❌ Failed to setup notification categories:', error);
    }
  };

  const setupNotificationResponseListener = () => {
    notificationListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const { actionIdentifier, notification } = response;
        const requestId = notification.request.content.data?.requestId as string | undefined;

        console.log('📱 Notification action received:', {
          action: actionIdentifier,
          requestId,
        });

        if (!requestId) {
          console.warn('⚠️ No requestId in notification data');
          return;
        }

        // Handle action
        if (actionIdentifier === 'APPROVE') {
          console.log('✅ User approved from notification');
          await approveRequest(requestId);
        } else if (actionIdentifier === 'REJECT') {
          console.log('❌ User rejected from notification');
          await rejectRequest(requestId);
        }

        // Dismiss the notification
        await Notifications.dismissNotificationAsync(notification.request.identifier);
      }
    );
  };

  // ============================================
  // TRIGGER INTERACTIVE NOTIFICATION
  // ============================================
  const triggerLoginNotification = async (request: LoginRequest) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Web Giriş İsteği',
          body: 'Girişi onaylıyor musun?',
          data: { requestId: request.id },
          categoryIdentifier: NOTIFICATION_CATEGORY_ID,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // Show immediately
      });

      console.log('✅ Interactive notification triggered for request:', request.id);
    } catch (error) {
      console.error('❌ Failed to trigger notification:', error);
    }
  };

  // ============================================
  // LOAD PREFERENCES FROM ASYNCSTORAGE
  // ============================================
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const [enabledValue, biometricValue] = await AsyncStorage.multiGet([
        STORAGE_KEYS.PUSH_AUTH_ENABLED,
        STORAGE_KEYS.PUSH_AUTH_REQUIRE_BIOMETRIC,
      ]);

      const isEnabled = enabledValue[1] === 'true';
      const isBiometricRequired = biometricValue[1] === 'true';

      setEnabledState(isEnabled);
      setRequireBiometricState(isBiometricRequired);
    } catch (error) {
      console.error('❌ Failed to load push auth preferences:', error);
    }
  };

  // ============================================
  // SAVE ENABLED PREFERENCE
  // ============================================
  const setEnabled = useCallback(async (value: boolean) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PUSH_AUTH_ENABLED,
        value ? 'true' : 'false'
      );
      setEnabledState(value);
      console.log('✅ Push Auth Enabled:', value);
    } catch (error) {
      console.error('❌ Failed to save push auth enabled preference:', error);
      Alert.alert('Hata', 'Ayar kaydedilemedi');
    }
  }, []);

  // ============================================
  // SAVE BIOMETRIC PREFERENCE
  // ============================================
  const setRequireBiometric = useCallback(async (value: boolean) => {
    try {
      // Check if device supports biometrics
      if (value) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
          Alert.alert(
            'Biyometrik Doğrulama Yok',
            'Cihazınızda biyometrik doğrulama ayarlanmamış. Lütfen önce ayarlardan parmak izi veya yüz tanıma ekleyin.'
          );
          return;
        }
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.PUSH_AUTH_REQUIRE_BIOMETRIC,
        value ? 'true' : 'false'
      );
      setRequireBiometricState(value);
      console.log('✅ Require Biometric:', value);
    } catch (error) {
      console.error('❌ Failed to save biometric preference:', error);
      Alert.alert('Hata', 'Ayar kaydedilemedi');
    }
  }, []);

  // ============================================
  // HANDLE INCOMING LOGIN REQUEST
  // ============================================
  const handleLoginRequest = useCallback(
    async (request: LoginRequest) => {
      if (!enabled || !userId) {
        console.log('⚠️ Push Auth disabled or no user, ignoring request');
        return;
      }

      console.log('📩 New login request received:', {
        id: request.id,
        ip: request.ip_address,
        device: request.device_info,
        browser: request.browser_info,
      });

      // Haptic feedback
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning
        );
      } catch (error) {
        console.warn('⚠️ Haptic feedback failed:', error);
      }

      // Show in-app modal
      setPendingRequest(request);

      // ALSO trigger interactive notification
      await triggerLoginNotification(request);
    },
    [enabled, userId]
  );

  // ============================================
  // APPROVE REQUEST
  // ============================================
  const approveRequest = useCallback(
    async (requestId: string) => {
      if (!userId) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı');
        return;
      }

      setIsProcessing(true);

      try {
        // Check if biometric is required
        if (requireBiometric) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          if (hasHardware && isEnrolled) {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Web girişini onaylamak için kimliğinizi doğrulayın',
              cancelLabel: 'İptal',
              disableDeviceFallback: false,
              fallbackLabel: 'PIN Kullan',
            });

            if (!result.success) {
              console.log('🔐 Biometric authentication failed or cancelled');

              // Reject the request if biometric fails
              await supabase
                .from('login_requests')
                .update({ status: 'rejected' })
                .eq('id', requestId)
                .eq('user_id', userId);

              setPendingRequest(null);
              setIsProcessing(false);

              Alert.alert(
                '🔒 Doğrulama İptal Edildi',
                'Parmak izi doğrulaması tamamlanmadı.\n\nWeb girişi güvenlik nedeniyle reddedildi.',
                [{ text: 'Anladım', style: 'default' }]
              );
              return;
            }

            console.log('✅ Biometric authentication successful');
          } else {
            Alert.alert(
              'Biyometrik Doğrulama Yok',
              'Cihazınızda biyometrik doğrulama ayarlanmamış.'
            );
            setIsProcessing(false);
            return;
          }
        }

        // Update request status to approved
        const { error } = await supabase
          .from('login_requests')
          .update({
            status: 'approved',
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId)
          .eq('user_id', userId);

        if (error) {
          throw error;
        }

        console.log('✅ Login request approved:', requestId);

        // Success haptic feedback
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        // Clear pending request
        setPendingRequest(null);
      } catch (error: any) {
        console.error('❌ Failed to approve request:', error);
        Alert.alert(
          'Hata',
          'Giriş isteği onaylanamadı: ' + (error.message || 'Bilinmeyen hata')
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [userId, requireBiometric]
  );

  // ============================================
  // REJECT REQUEST
  // ============================================
  const rejectRequest = useCallback(
    async (requestId: string) => {
      if (!userId) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı');
        return;
      }

      setIsProcessing(true);

      try {
        // Update request status to rejected
        const { error } = await supabase
          .from('login_requests')
          .update({
            status: 'rejected',
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId)
          .eq('user_id', userId);

        if (error) {
          throw error;
        }

        console.log('❌ Login request rejected:', requestId);

        // Warning haptic feedback
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning
        );

        // Clear pending request
        setPendingRequest(null);
      } catch (error: any) {
        console.error('❌ Failed to reject request:', error);
        Alert.alert(
          'Hata',
          'Giriş isteği reddedilemedi: ' + (error.message || 'Bilinmeyen hata')
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [userId]
  );

  // ============================================
  // SUBSCRIBE TO REALTIME LOGIN REQUESTS
  // ============================================
  useEffect(() => {
    // Only subscribe if enabled and user is logged in
    if (!enabled || !userId || isSubscribedRef.current) {
      return;
    }


    const channel = supabase
      .channel(`login_requests:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'login_requests',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📡 Realtime INSERT event received:', payload);

          const newRequest = payload.new as LoginRequest;

          // Only handle pending requests
          if (newRequest.status === 'pending') {
            handleLoginRequest(newRequest);
          }
        }
      )
      .subscribe((status) => {

        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error');
          isSubscribedRef.current = false;
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Realtime subscription timed out');
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [enabled, userId, handleLoginRequest]);

  // ============================================
  // CLEANUP ON LOGOUT
  // ============================================
  useEffect(() => {
    // If user logs out, cleanup everything
    if (!userId) {

      // Clear pending request
      setPendingRequest(null);

      // Unsubscribe from realtime
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    }
  }, [userId]);

  // ============================================
  // CONTEXT VALUE
  // ============================================
  const value: PushAuthContextType = {
    enabled,
    setEnabled,
    requireBiometric,
    setRequireBiometric,
    pendingRequest,
    approveRequest,
    rejectRequest,
    isProcessing,
  };

  return (
    <PushAuthContext.Provider value={value}>
      {children}
    </PushAuthContext.Provider>
  );
}
