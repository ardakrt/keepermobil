import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { RealtimeChannel, createClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { PIN_SESSION_KEY } from './storageKeys';
import * as SecureStore from 'expo-secure-store';

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
  setEnabled: async () => { },
  requireBiometric: false,
  setRequireBiometric: async () => { },
  pendingRequest: null,
  approveRequest: async () => { },
  rejectRequest: async () => { },
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
  // Default to true for better UX during testing, or ensure it loads fast
  const [enabled, setEnabledState] = useState<boolean>(true);
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
  // ============================================
  // SETUP NOTIFICATION CATEGORIES
  // ============================================
  useEffect(() => {
    setupNotificationCategories();
    setupNotificationResponseListener();

    // Cold start'ta AsyncStorage'dan pending request kontrol et
    const checkPendingLoginRequest = async () => {
      try {
        const pendingRequestId = await AsyncStorage.getItem('PENDING_LOGIN_REQUEST_ID');
        if (pendingRequestId) {
          console.log('🔔 Found pending login request from AsyncStorage:', pendingRequestId);

          // Helper to get client (either global or temp from PIN)
          let client = supabase;
          let currentUserId = userId;

          // If no active session, try to use PIN session
          if (!currentUserId) {
            console.log('⏳ No active session, checking PIN session for cold start request...');
            const temp = await getTempClient();
            if (temp) {
              client = temp.client;
              currentUserId = temp.userId;
              console.log('🔓 Using PIN session (temp client) for processing request');
            } else {
              console.log('🔒 No PIN session available, keeping request for later');
              return;
            }
          }

          // Temizle
          await AsyncStorage.removeItem('PENDING_LOGIN_REQUEST_ID');

          // İsteğin güncel durumunu çek
          const { data, error } = await client
            .from('login_requests')
            .select('*')
            .eq('id', pendingRequestId)
            .maybeSingle();

          if (data && data.status === 'pending') {
            console.log('✅ Setting pending request from storage');
            setPendingRequest(data);
          } else {
            if (error) console.error('Error fetching request', error);
            else console.log('Request not found or not pending');
          }
        }
      } catch (e) {
        console.warn('Failed to check pending login request', e);
      }
    };

    // Biraz gecikme ile kontrol et (modüller yüklensin)
    const timeoutId = setTimeout(checkPendingLoginRequest, 500);

    return () => {
      clearTimeout(timeoutId);
      // Cleanup notification listener
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
    };
  }, [userId]); // userId değiştiğinde listener'ı yeniden kur

  // Refs for accessing latest state in callbacks/listeners without dependency issues
  const userIdRef = useRef(userId);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Load preferences on mount
  useEffect(() => {
    if (!userId) return;

    const checkAfterLogin = async () => {
      try {
        const pendingRequestId = await AsyncStorage.getItem('PENDING_LOGIN_REQUEST_ID');
        if (pendingRequestId) {
          console.log('🔔 Found pending login request after login:', pendingRequestId);
          await AsyncStorage.removeItem('PENDING_LOGIN_REQUEST_ID');

          // Helper not needed here since we have userId but good practice
          const { data, error } = await supabase
            .from('login_requests')
            .select('*')
            .eq('id', pendingRequestId)
            .maybeSingle();

          if (data && data.status === 'pending') {
            console.log('✅ Setting pending request after login');
            setPendingRequest(data);
          } else {
            // ... error handling
          }
        }
      } catch (e) {
        console.warn('Failed to check pending login request after login', e);
      }
    };

    const timeoutId = setTimeout(checkAfterLogin, 300);
    return () => clearTimeout(timeoutId);
  }, [userId]);

  // ============================================
  // HELPERS
  // ============================================
  // ============================================
  // HELPERS
  // ============================================
  const getTempClient = async () => {
    try {
      const pinSessionRaw = await SecureStore.getItemAsync(PIN_SESSION_KEY);
      if (!pinSessionRaw) return null;
      const pinSession = JSON.parse(pinSessionRaw);

      if (!pinSession?.access_token) return null;

      // Resolve variables again locally to avoid circular dependencies with supabaseClient
      const supabaseUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL ??
        process.env.NEXT_PUBLIC_SUPABASE_URL ??
        Constants.expoConfig?.extra?.supabaseUrl ??
        Constants.manifest?.extra?.supabaseUrl;

      const supabaseAnonKey =
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        Constants.expoConfig?.extra?.supabaseAnonKey ??
        Constants.manifest?.extra?.supabaseAnonKey;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Missing Supabase credentials in getTempClient');
        return null;
      }

      // Create isolated client
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      // Set session
      await client.auth.setSession({
        access_token: pinSession.access_token,
        refresh_token: pinSession.refresh_token,
      });

      return { client, userId: pinSession.user?.id };
    } catch (e) {
      console.warn('Failed to create temp client', e);
      return null;
    }
  };

  const setupNotificationCategories = async () => {
    try {
      await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
        {
          identifier: 'APPROVE',
          buttonTitle: 'Onayla',
          options: {
            // Uygulamayı açmadan arka planda onayla
            opensAppToForeground: false,
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
      console.log('✅ Notification categories set up successfully');
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

        // Helper
        let activeClient = supabase;
        let activeUserId = userId;

        // If locked, try temp client
        if (!activeUserId) {
          const temp = await getTempClient();
          if (temp) {
            activeClient = temp.client;
            activeUserId = temp.userId;
          }
        }

        // Handle action
        if (actionIdentifier === 'APPROVE') {
          console.log('✅ User approved from notification');
          await approveRequestFromBackground(requestId);
        } else if (actionIdentifier === 'REJECT') {
          console.log('❌ User rejected from notification');
          await rejectRequest(requestId);
        } else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          console.log('🔔 Notification body tapped, fetching request details...');

          if (!activeUserId) {
            console.log('🔒 No session (even PIN) found, saving to AsyncStorage');
            try {
              await AsyncStorage.setItem('PENDING_LOGIN_REQUEST_ID', requestId);
            } catch (e) {
              console.warn('Failed to save pending request', e);
            }
            return;
          }

          // Fetch request
          const { data, error } = await activeClient
            .from('login_requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

          if (data && data.status === 'pending') {
            setPendingRequest(data);
          } else {
            if (error) console.error('Error fetching request', error);
            else console.log('Request not found or not pending');
          }
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
      // Use refs to avoid stale closures
      const currentEnabled = enabledRef.current;
      const currentUserId = userIdRef.current;

      console.log('⚡ handleLoginRequest called. Enabled:', currentEnabled, 'UserId:', currentUserId);

      if (!currentEnabled || !currentUserId) {
        console.log('⚠️ Push Auth disabled or no user, ignoring request. Details:', { enabled: currentEnabled, userId: currentUserId });
        // Force continue if userId is present but enabled is false (for testing)
        if (!currentUserId) return;
        console.log('⚠️ Ignoring enabled check for debugging purposes');
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

      // Only trigger notification if app is in background
      // When app is in foreground (active), the modal is enough
      console.log('📬 App State:', AppState.currentState);

      // Show in-app modal
      setPendingRequest(request);

      // Always trigger notification for now to ensure user gets it, 
      // even if modal fails to appear.
      await triggerLoginNotification(request);
      console.log('📬 Notification triggered regardless of state');
    },
    [enabled, userId]
  );

  // ============================================
  // APPROVE REQUEST
  // ============================================
  // ============================================
  // APPROVE REQUEST (SERVER-SIDE / PUBLIC RPC)
  // ============================================
  const approveRequest = useCallback(
    async (requestId: string) => {
      // Artık Session kontrolü, Temp Client, Token vb. İHTİYAÇ YOK.
      // Sadece Request ID'yi sunucuya gönderiyoruz. Token güvenliği yerine UUID güvenliği kullanıyoruz.

      setIsProcessing(true);

      try {
        // Biometric Check (Sadece donanımsal onay için, veritabanı yetkisi için değil)
        if (requireBiometric) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          if (hasHardware && isEnrolled) {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Web Girişini Onaysla',
              fallbackLabel: 'PIN Kullan',
            });

            if (!result.success) {
              setPendingRequest(null);
              setIsProcessing(false);
              Alert.alert('İptal', 'Doğrulama sağlanamadı.');
              return;
            }
          }
        }

        console.log('🔄 Approving via Public RPC (Session Independent)...', requestId);

        // PUBLIC RPC CALL - Token gerektirmez, anon key yeterlidir (Supabase client'ında yüklü)
        const { data: rpcData, error } = await supabase.rpc('approve_login_request_public', {
          p_request_id: requestId
        });

        if (error) throw error;

        if (rpcData && rpcData.success === false) {
          throw new Error(rpcData.error || 'Onay işlemi başarısız oldu');
        }

        console.log('✅ Login request approved via Public RPC!');

        // UI Feedback
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) { }

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
    [requireBiometric]
  );


  // ============================================
  // APPROVE REQUEST FROM BACKGROUND (No Biometric)
  // ============================================
  const approveRequestFromBackground = useCallback(
    async (requestId: string) => {
      console.log('🔄 Approving from background notification...');

      // Oturumu kontrol et
      let currentUserId = userIdRef.current;
      let activeClient = supabase;

      // Check session validity for background approval too
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        console.log('🔒 (Background) Global session invalid, trying temp client...');
        const temp = await getTempClient();
        if (temp) {
          activeClient = temp.client;
          currentUserId = temp.userId;
          console.log('🔓 (Background) Using temporary client.');
        }
      } else {
        currentUserId = sessionData.session?.user?.id || currentUserId;
      }

      if (!currentUserId) {
        console.error('❌ No session for background approval');
        return;
      }

      try {
        // Biyometrik kontrolü ATLA - doğrudan onayla (RPC ile)
        const { data: rpcData, error } = await activeClient.rpc('approve_login_request', {
          request_id: requestId
        });

        if (error) throw error;

        if (rpcData && rpcData.success === false) {
          console.warn('⚠️ Background approve RPC failed:', rpcData.error);
          // UI olmadığı için throw etmiyoruz ama logluyoruz
          return;
        }

        console.log('✅ Login request approved from background via RPC:', requestId);

        // Haptic feedback (arka planda çalışmayabilir ama deneyelim)
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
          // Arka planda haptic çalışmayabilir
        }

        // Pending request'i temizle
        setPendingRequest(null);
      } catch (error: any) {
        console.error('❌ Failed to approve from background:', error);
      }
    },
    [userId]
  );

  // ============================================
  // REJECT REQUEST
  // ============================================
  const rejectRequest = useCallback(
    async (requestId: string) => {
      // Oturumu kontrol et
      let currentUserId = userId;
      let activeClient = supabase;

      if (!currentUserId) {
        const { data } = await supabase.auth.getSession();
        currentUserId = data.session?.user?.id ?? null;

        if (!currentUserId) {
          const temp = await getTempClient();
          if (temp) {
            activeClient = temp.client;
            currentUserId = temp.userId;
          }
        }
      }

      if (!currentUserId) {
        Alert.alert('Hata', 'Oturum bilgisi bulunamadı. Lütfen önce giriş yapın.');
        return;
      }

      setIsProcessing(true);

      try {
        // Update request status to rejected using RPC
        const { data: rpcData, error } = await activeClient.rpc('reject_login_request', {
          request_id: requestId
        });

        if (error) throw error;

        console.log('❌ Login request rejected via RPC:', requestId);

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
    // Force cleanup if userId changes, although useEffect cleanup handles it.
    // Ensure we don't block subscription if ref was stuck
    if (isSubscribedRef.current && channelRef.current) {
      // This might happen if useEffect re-runs. 
      // Let's rely on standard useEffect cleanup flow.
    }

    console.log('🔌 Subscribing to Login Requests for user:', userId);

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
          if (newRequest.status === 'pending') {
            // Force modal visible check
            console.log('⚡ Triggering handleLoginRequest');
            handleLoginRequest(newRequest);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔌 Realtime Subscription Status:', status);
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Realtime subscription warning:', status);
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
