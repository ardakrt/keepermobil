import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Dimensions,
  Vibration,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, withSpring, withRepeat } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { ThemeProvider, useAppTheme, makeNavTheme } from './lib/theme';
import { ToastProvider, useToast } from './lib/toast';
import { HUDProvider } from './lib/hud';
import { ConfirmProvider } from './lib/confirm';
import { PrefsProvider, usePrefs } from './lib/prefs';
import { BadgeProvider, useBadges } from './lib/badges';
import { AuthenticatorProvider } from './lib/authenticator';
import { PushAuthProvider } from './lib/PushAuthContext';
import messaging from '@react-native-firebase/messaging';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screen Imports
import AuthScreen from './screens/AuthScreen';
import NotesScreen from './screens/NotesScreen';
import NoteDetailScreen from './screens/NoteDetailScreen';
import RemindersScreen from './screens/RemindersScreen';
import SettingsScreen from './screens/SettingsScreen';
import WalletScreen from './screens/WalletScreen';
import ProfileScreen from './screens/ProfileScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import AuthenticatorScreen from './screens/AuthenticatorScreen';
import DriveScreen from './screens/DriveScreen';
import Avatar from './components/Avatar';
import PushAuthModal from './components/PushAuthModal';

// Other Imports
import { supabase } from './lib/supabaseClient';
import { BIOMETRIC_ENABLED_KEY, BIOMETRIC_SESSION_KEY, REMEMBER_KEY, REMEMBER_EMAIL_KEY, REMEMBER_PASSWORD_KEY, SESSION_KEY } from './lib/storageKeys';
import { localAuth } from './lib/localAuth';

// Setup - High importance channel for bypassing battery optimization
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// Create high importance notification channel for Android
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('reminders', {
    name: 'Hatırlatıcılar',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

const Tab = createBottomTabNavigator();
const NotesStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

// --- Child Components ---

const BlurredTabBar = ({ state, descriptors, navigation, insets, styles }) => {
  const { theme } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const bgTint = theme.dark ? 'dark' : 'light';

  const [containerWidth, setContainerWidth] = React.useState(0);
  const segmentWidth = state.routes.length > 0 ? containerWidth / state.routes.length : 0;
  const indicatorWidth = segmentWidth * 0.6;

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const targetTranslateX = (segmentWidth * state.index) + (segmentWidth / 2) - (indicatorWidth / 2);
    return {
      transform: [
        { translateX: withTiming(targetTranslateX, { duration: 300, easing: Easing.out(Easing.cubic) }) },
      ],
    };
  });

  const bottomOffset = Math.max(16, (insets?.bottom ?? 0) + 8);

  return (
    <View style={[styles.tabBarContainer, { bottom: bottomOffset }]}>
      <View
        style={[
          styles.blurViewStyle,
          { backgroundColor: theme.colors.surface }
        ]}
      >
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={styles.tabBarInnerContainer}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = options.title !== undefined ? options.title : route.name;
            const isFocused = state.index === index;

            const onPress = async () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                if (hapticsEnabled) {
                  try {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {
                    try {
                      Vibration.vibrate(50);
                    } catch {}
                  }
                }
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = async () => {
              if (hapticsEnabled) {
                try {
                  await Haptics.selectionAsync();
                } catch {
                  try {
                    Vibration.vibrate(100);
                  } catch {}
                }
              }
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabItem}
              >
                {options.tabBarIcon &&
                  options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? theme.colors.primary : theme.colors.muted,
                    size: 26,
                  })}
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused ? theme.colors.text : theme.colors.muted,
                      fontWeight: isFocused ? '700' : '500',
                    }
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const TabIcon = React.memo(({ name, color, size, focused, routeName }) => {
  const { counts } = useBadges();
  const { reduceMotion } = usePrefs();
  const { theme } = useAppTheme();
  const badge = routeName === 'Reminders' ? (counts['reminders'] || 0) : 0;

  const animatedStyle = useAnimatedStyle(() => {
      if (reduceMotion) {
        return {
          transform: [{ scale: focused ? 1.1 : 1 }],
        };
      }
      const scale = withSpring(focused ? 1.2 : 1, { damping: 10, stiffness: 100 });
      const translateY = withSpring(focused ? -5 : 0, { damping: 10, stiffness: 100 });
      const rotate = withSpring(focused ? '0deg' : '-8deg', { damping: 12, stiffness: 150 });
      return {
          transform: [{ rotate }, { scale }, { translateY }],
      };
  }, [focused, reduceMotion]);

  return (
    <Animated.View style={[animatedStyle, { alignItems: 'center' }]}>
      <MaterialCommunityIcons name={name} color={color} size={size} />
      {badge > 0 ? (
          <View style={{ position: 'absolute', top: -4, right: -12, backgroundColor: theme.colors.danger, borderRadius: 999, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.surface }}>
            <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
              {badge > 99 ? '99+' : String(badge)}
            </Text>
          </View>
      ) : null}
    </Animated.View>
  );
});

function AppInner() {
  const { theme, mode } = useAppTheme();

  const HeaderTitle = React.memo(() => {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.9);
    const iconRotate = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
      };
    });

    const iconAnimatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ rotate: `${iconRotate.value}deg` }],
      };
    });

    useEffect(() => {
      opacity.value = withTiming(1, { duration: 500 });
      scale.value = withSpring(1, { damping: 10, stiffness: 100 });
      iconRotate.value = withSequence(
        withTiming(-10, { duration: 100 }),
        withTiming(10, { duration: 200 }),
        withTiming(0, { duration: 100 })
      );
    }, []);

    return (
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, animatedStyle]}>
        <Animated.View style={[{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: theme.colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: theme.colors.primary + '30',
        }, iconAnimatedStyle]}>
          <MaterialCommunityIcons name="shield-lock" size={22} color={theme.colors.primary} />
        </Animated.View>
        <Text
          style={{
            color: theme.colors.text,
            fontWeight: '800',
            fontSize: 26,
            letterSpacing: 0.8,
          }}
        >
          Keeper
        </Text>
      </Animated.View>
    );
  });

  const HeaderPulseBackground = React.useCallback(({ pulseKey }) => {
    const pulse = useSharedValue(0);

    const pulseStyle = useAnimatedStyle(() => ({ 
      opacity: pulse.value * 0.5, // Daha hafif pulse efekti
      transform: [{ scaleX: 1 + (pulse.value * 0.02) }]
    }));

    useEffect(() => {
      if (!pulseKey) return;
      pulse.value = 0;
      pulse.value = withSequence(
        withTiming(1, { duration: 180 }), 
        withTiming(0, { duration: 260 })
      );
    }, [pulseKey]);

    // Temiz ve basit header arka planı
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: theme.colors.background,
      }}>
        {/* Çok hafif gradient efekti */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.primary,
          opacity: 0.02, // Çok hafif renk
        }} />
        
        {/* Alt kenarlık çizgisi */}
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.border,
          opacity: 0.2,
        }} />
        
        {/* Pulse efekti overlay */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: theme.colors.primary,
            },
            pulseStyle,
          ]}
        />
      </View>
    );
  }, [theme.colors.primary, theme.colors.border, theme.colors.background]);
  const navigationRef = useNavigationContainerRef();
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [firebaseToken, setFirebaseToken] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const { showToast } = useToast();
  const bannerTimeoutRef = useRef(null);
  const processedInitialUrlRef = useRef(false);
  const userId = session?.user?.id ?? null;
  const insets = useSafeAreaInsets();

  const clearStoredSession = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY).catch(() => undefined);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      try {
        const stored = await AsyncStorage.multiGet([REMEMBER_KEY, SESSION_KEY, REMEMBER_EMAIL_KEY]);
        const rememberEntry = stored.find(([key]) => key === REMEMBER_KEY)?.[1];
        const sessionEntry = stored.find(([key]) => key === SESSION_KEY)?.[1];
        const biometricEnabledFlag = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        const biometricSessionRaw = await SecureStore.getItemAsync(BIOMETRIC_SESSION_KEY);
        const biometricActive = biometricEnabledFlag === 'true' && !!biometricSessionRaw && localAuth.hasFullSupport();

        if (biometricActive) {
          try {
            const biometricSession = JSON.parse(biometricSessionRaw);
            const auth = await localAuth.authenticateAsync({ promptMessage: 'Parmak izi ile giriş yapın' });
            if (!auth.success) {
              Alert.alert('Giriş engellendi', 'Parmak izi doğrulaması iptal edildi.');
              return;
            }
            const { data, error } = await supabase.auth.setSession({ access_token: biometricSession?.access_token, refresh_token: biometricSession?.refresh_token });
            if (!error && isMounted) setSession(data.session ?? null);
            if (error) {
              console.warn('Stored biometric session expired, removing cache.', error);
              await clearStoredSession();
            }
            return;
          } catch (err) {
            console.warn('Biometric restore failed', err);
            await clearStoredSession();
          }
        }

        if (rememberEntry === 'true' && sessionEntry) {
          const parsed = JSON.parse(sessionEntry);
          const { data, error } = await supabase.auth.setSession({ access_token: parsed?.access_token, refresh_token: parsed?.refresh_token });
          if (!error && isMounted) setSession(data.session ?? null);
          if (error) {
            console.warn('Stored session expired, removing cache.', error);
            await AsyncStorage.removeItem(SESSION_KEY);
          }
        } else {
          const { data } = await supabase.auth.getSession();
          if (isMounted) setSession(data.session ?? null);
        }
      } catch (err) {
        console.warn('Session restore failed', err);
      } finally {
        if (isMounted) setInitializing(false);
      }
    };
    restoreSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession ?? null);
      if (!currentSession) {
        await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
        await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY).catch(() => undefined);
      }
    });
    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [clearStoredSession]);

  const parseParamsFromUrl = useCallback((url) => {
    try {
      if (!url) return {};
      const out = {};
      const [pathWithQuery, hashPart] = url.split('#');
      const queryPart = pathWithQuery.includes('?') ? pathWithQuery.split('?')[1] : '';
      const parse = (str) => {
        if (!str) return;
        str.split('&').filter(Boolean).forEach((kv) => {
          const [k, v] = kv.split('=');
          if (!k) return;
          out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
        });
      };
      parse(queryPart);
      parse(hashPart);
      return out;
    } catch {
      return {};
    }
  }, []);

  const handleDeepLink = useCallback(async (url) => {
    if (!url) return;
    const params = parseParamsFromUrl(url);
    const type = params.type || params['type'];
    const error = params.error;
    const errorDescription = params.error_description;
    let email = params.email || params['email'] || undefined;
    let tokenForUi = params.access_token || params.token_hash || params.code || undefined;

    // Hata varsa göster
    if (error) {
      const errorMsg = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
        : 'Bir hata oluştu';

      if (error === 'otp_expired') {
        showToast('Link Süresi Doldu', 'Bu link artık geçerli değil. Lütfen yeni bir istek oluşturun.');
      } else {
        showToast('Hata', errorMsg);
      }
      return;
    }

    try {
      if (params.access_token) {
        const { data, error } = await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
        if (error) {
          console.warn('setSession failed from deep link', error);
          showToast('Hata', 'Oturum başlatılamadı. Lütfen tekrar deneyin.');
        } else {
          email = email || data?.session?.user?.email || undefined;

          // E-posta değişikliği başarılı
          if (type === 'email_change') {
            showToast('Başarılı', `E-posta adresiniz ${email} olarak güncellendi!`);
            // Ana ekrana yönlendir
            if (navigationRef.isReady()) {
              navigationRef.reset({ index: 0, routes: [{ name: 'Main' }] });
            }
            return;
          }
        }
      } else if (params.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) console.warn('exchangeCodeForSession failed', error);
        else email = email || data?.session?.user?.email || undefined;
      }
    } catch (err) {
      console.warn('Deep link auth handling error', err);
    }

    // Şifre sıfırlama için ResetPassword ekranına yönlendir
    if (type === 'recovery' || params.recovery === 'true') {
      const nav = { screen: 'ResetPassword', params: { token: tokenForUi, email } };
      if (navigationRef.isReady()) navigationRef.navigate(nav.screen, nav.params);
      else setPendingNavigation(nav);
    }
  }, [navigationRef, parseParamsFromUrl, showToast]);

  useEffect(() => {
    (async () => {
      if (processedInitialUrlRef.current) return;
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          processedInitialUrlRef.current = true;
          await handleDeepLink(initialUrl);
        }
      } catch (e) {
        console.warn('getInitialURL failed', e);
      }
    })();
    const sub = Linking.addEventListener('url', async (event) => {
      try {
        await handleDeepLink(event.url);
      } catch (e) {
        console.warn('Link event handling failed', e);
      }
    });
    return () => sub.remove?.();
  }, [handleDeepLink]);

  const handleNavigationData = useCallback((data) => {
    if (!data || !data.screen) return;
    const params = { ...(data.reminderId ? { reminderId: data.reminderId } : {}) };
    params.pulseHeaderKey = Date.now();
    setPendingNavigation({ screen: data.screen, params });
  }, []);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      showToast(title ?? 'Yeni bildirim', body ?? 'Bir hatırlatma alındı.', 4000);
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNavigationData(response.notification.request.content.data ?? {});
    });
    (async () => {
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      const data = lastResponse?.notification?.request?.content?.data;
      if (data) handleNavigationData(data);
    })();
    return () => {
      receivedSub.remove();
      responseSub.remove();
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, [handleNavigationData]);

  useEffect(() => {
    const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
      const title = remoteMessage.notification?.title ?? remoteMessage.data?.title ?? 'Firebase bildirimi';
      const body = remoteMessage.notification?.body ?? remoteMessage.data?.body ?? '';
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      showToast(title, body, 4000);
    });
    const unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
      handleNavigationData(remoteMessage?.data ?? {});
    });
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage?.data) handleNavigationData(remoteMessage.data);
    }).catch((err) => console.warn('FCM initial notification fetch failed', err));
    return () => {
      unsubscribeOnMessage();
      unsubscribeOpened();
    };
  }, [handleNavigationData]);

  useEffect(() => {
    const canNavigate = !!pendingNavigation && navigationRef.isReady() && (session || pendingNavigation?.screen === 'ResetPassword');
    if (!canNavigate) return;
    const { screen, params } = pendingNavigation;
    navigationRef.navigate(screen, params ?? {});
    setPendingNavigation(null);
  }, [navigationRef, pendingNavigation, session]);

  const registerForPushNotificationsAsync = useCallback(async () => {
    try {
      if (!Device.isDevice) {
        Alert.alert('Push bildirimleri', 'Bildirim almak için fiziki bir cihaz kullanın.');
        return null;
      }
      const settings = await Notifications.getPermissionsAsync();
      let finalStatus = settings.status;
      if (finalStatus !== 'granted') {
        const request = await Notifications.requestPermissionsAsync();
        finalStatus = request.status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Push bildirimleri', 'Push bildirim izni verilmedi.');
        return null;
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Hatırlatmalar',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#ffffff',
          sound: 'default',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
      }
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.expoConfig?.extra?.projectId ?? Constants?.easConfig?.projectId;
      const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      return tokenResponse.data;
    } catch (err) {
      console.warn('Push token kaydı başarısız', err);
      Alert.alert('Push bildirimleri', err?.message ?? 'Push token alınamadı.');
      return null;
    }
  }, []);

  const saveExpoToken = useCallback(async (token) => {
    if (!userId || !token) return;
    try {
      const { error } = await supabase.from('user_tokens').upsert({ user_id: userId, expo_token: token, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (err) {
      console.warn('Expo push token supabase kaydı başarısız', err);
    }
  }, [userId]);

  const saveFirebaseToken = useCallback(async (token) => {
    if (!userId || !token) return;
    try {
      const { data: existing, error: fetchError } = await supabase.from('user_tokens').select('expo_token').eq('user_id', userId).maybeSingle();
      if (fetchError) throw fetchError;
      const payload = { user_id: userId, updated_at: new Date().toISOString(), expo_token: existing?.expo_token ?? token, firebase_token: token };
      const { error: upsertError } = await supabase.from('user_tokens').upsert(payload);
      if (upsertError) throw upsertError;
    } catch (err) {
      console.warn('Firebase token kaydedilemedi. user_tokens tablosunda firebase_token kolonunun olduğundan emin olun.', err?.message ?? err);
      await saveExpoToken(token);
    }
  }, [saveExpoToken, userId]);

  const registerFirebaseMessaging = useCallback(async () => {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        console.warn('Firebase messaging izni verilmedi.');
        return null;
      }
      const token = await messaging().getToken();
      return token;
    } catch (err) {
      console.warn('Firebase messaging token alınamadı', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setExpoPushToken(null);
      return;
    }
    let isMounted = true;
    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!isMounted) return;
      if (token) {
        setExpoPushToken(token);
        await saveExpoToken(token);
      }
    })();
    return () => { isMounted = false; };
  }, [registerForPushNotificationsAsync, saveExpoToken, userId]);

  useEffect(() => {
    if (!userId) {
      setFirebaseToken(null);
      return;
    }
    let isMounted = true;
    let unsubscribeRefresh = () => undefined;
    (async () => {
      const token = await registerFirebaseMessaging();
      if (!isMounted) return;
      if (token) {
        setFirebaseToken(token);
        await saveFirebaseToken(token);
      }
    })();
    unsubscribeRefresh = messaging().onTokenRefresh(async (token) => {
      setFirebaseToken(token);
      await saveFirebaseToken(token);
    });
    return () => {
      isMounted = false;
      unsubscribeRefresh();
    };
  }, [registerFirebaseMessaging, saveFirebaseToken, userId]);

  const handleAuthSuccess = (newSession) => {
    setSession(newSession ?? null);
  };

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(SESSION_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY);
      setSession(null);
      setExpoPushToken(null);
      setFirebaseToken(null);
      await messaging().deleteToken();
    } catch (err) {
      console.warn('Sign out failed', err);
    }
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    appRoot: { flex: 1, backgroundColor: theme.colors.background },
    loadingContainer: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 },
    loadingText: { color: theme.colors.textSecondary, fontSize: 16 },
    headerRightContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 16 },
    tokenBadge: { backgroundColor: theme.colors.primary, color: theme.colors.background, fontWeight: '700', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    signOutButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
    signOutText: { color: theme.colors.textSecondary, fontWeight: '700', fontSize: 12 },
    toastContainer: { position: 'absolute', left: 16, right: 16, bottom: 32, padding: 16, borderRadius: 14, backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border, gap: 6 },
    toastTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 15 },
    toastBody: { color: theme.colors.textSecondary, fontSize: 14 },
    tabBarContainer: { position: 'absolute', left: 12, right: 12, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0, borderWidth: 0 },
    blurViewStyle: { borderRadius: 24, overflow: 'hidden', borderWidth: 0 },
    tabBarInnerContainer: { flexDirection: 'row', height: 68, alignItems: 'center', position: 'relative', borderWidth: 0 },
    indicator: { position: 'absolute', height: '65%', top: '17.5%', borderRadius: 20, zIndex: 0, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    tabItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2, zIndex: 1 },
    tabLabel: { fontSize: 11 },
  }), [theme]);

  const tabScreenOptions = useMemo(() => ({
    headerTitle: () => <HeaderTitle />,
    headerStyle: {
      backgroundColor: theme.colors.background, // Şeffaf yerine arka plan rengi
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
    },
    headerShadowVisible: false,
    headerBackground: ({ route }) => <HeaderPulseBackground pulseKey={route?.params?.pulseHeaderKey ?? 0} />,
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.muted,
    tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    headerRight: () => (
      <TouchableOpacity
        onPress={() => navigationRef.navigate('Profile')}
        style={{
          marginRight: 16,
          padding: 3,
          borderRadius: 999,
          borderWidth: 2.5,
          borderColor: theme.colors.primary + '40',
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        }}
        accessibilityLabel="Profili aç"
        activeOpacity={0.7}
      >
        <Avatar name={session?.user?.user_metadata?.full_name || session?.user?.email} imageUrl={session?.user?.user_metadata?.avatar_url} size={40} />
      </TouchableOpacity>
    ),
  }), [theme, navigationRef, HeaderPulseBackground, session]);

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Oturum yükleniyor...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.appRoot}>
        <NavigationContainer ref={navigationRef} theme={makeNavTheme(mode)}>
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            {session ? (
              <RootStack.Screen name="Main">
                {() => (
                  <Tab.Navigator
                    tabBar={(tabProps) => <BlurredTabBar {...tabProps} styles={styles} insets={insets} />}
                    screenOptions={({ route }) => ({
                      ...tabScreenOptions,
                      tabBarIcon: ({ color, size, focused }) => {
                        const iconMap = {
                          Notes: focused ? 'note-text' : 'note-text-outline',
                          Reminders: focused ? 'bell-ring' : 'bell-outline',
                          Drive: focused ? 'google-drive' : 'harddisk',
                          Cüzdan: focused ? 'wallet' : 'wallet-outline',
                          Authenticator: focused ? 'shield-key' : 'shield-key-outline',
                          Settings: focused ? 'cog' : 'cog-outline',
                        };
                        const iconName = iconMap[route.name] || (focused ? 'circle' : 'circle-outline');
                        return <TabIcon name={iconName} color={color} size={size} focused={focused} routeName={route.name} />;
                      },
                    })}
                  >
                    <Tab.Screen
                      name="Notes"
                      options={{
                        headerShown: false,
                        title: 'Notlar',
                        tabBarAccessibilityLabel: 'Notlar sekmesi',
                      }}
                    >
                      {() => (
                        <NotesStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
                          <NotesStack.Screen name="NotesHome" component={NotesScreen} />
                          <NotesStack.Screen name="NoteDetail" component={NoteDetailScreen} options={{ animation: 'fade' }} />
                        </NotesStack.Navigator>
                      )}
                    </Tab.Screen>
                    <Tab.Screen name="Reminders" options={{ headerShown: false, title: 'Hatırlatmalar', tabBarAccessibilityLabel: 'Hatırlatmalar sekmesi' }}>
                      {() => (
                        <NotesStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.colors.background } }}>
                          <NotesStack.Screen name="RemindersHome" component={RemindersScreen} />
                        </NotesStack.Navigator>
                      )}
                    </Tab.Screen>
                    <Tab.Screen name="Drive" options={{ headerShown: false, title: 'Drive', tabBarAccessibilityLabel: 'Drive sekmesi' }}>
                      {() => (
                        <NotesStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.colors.background } }}>
                          <NotesStack.Screen name="DriveHome" component={DriveScreen} />
                        </NotesStack.Navigator>
                      )}
                    </Tab.Screen>
                    <Tab.Screen name="Cüzdan" options={{ headerShown: false, title: 'Cüzdan', tabBarAccessibilityLabel: 'Cüzdan sekmesi' }}>
                      {() => (
                        <NotesStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.colors.background } }}>
                          <NotesStack.Screen name="WalletHome" component={WalletScreen} />
                        </NotesStack.Navigator>
                      )}
                    </Tab.Screen>
                    <Tab.Screen name="Authenticator" options={{ headerShown: false, title: '2FA', tabBarAccessibilityLabel: 'Authenticator sekmesi' }}>
                      {() => (
                        <NotesStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.colors.background } }}>
                          <NotesStack.Screen name="AuthenticatorHome" component={AuthenticatorScreen} />
                        </NotesStack.Navigator>
                      )}
                    </Tab.Screen>
                    <Tab.Screen name="Settings" options={{ headerShown: false, title: 'Ayarlar', tabBarAccessibilityLabel: 'Ayarlar sekmesi' }}>
                      {() => (
                        <NotesStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
                          <NotesStack.Screen name="SettingsHome" component={SettingsScreen} />
                        </NotesStack.Navigator>
                      )}
                    </Tab.Screen>
                  </Tab.Navigator>
                )}
              </RootStack.Screen>
            ) : (
              <RootStack.Screen name="Auth">
                {(props) => <AuthScreen {...props} onAuthSuccess={handleAuthSuccess} />}
              </RootStack.Screen>
            )}
            <RootStack.Screen name="Profile" component={ProfileScreen} />
            <RootStack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ animation: 'fade' }} />
          </RootStack.Navigator>
        </NavigationContainer>
      </View>
    </GestureHandlerRootView>
  );
}

function AppWithAuth() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  return (
    <AuthenticatorProvider userId={userId}>
      <PushAuthProvider userId={userId}>
        <AppInner />
        {/* 🔑 CRITICAL: PushAuthModal should be at root level */}
        <PushAuthModal />
      </PushAuthProvider>
    </AuthenticatorProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ConfirmProvider>
        <ToastProvider>
          <HUDProvider>
            <PrefsProvider>
              <BadgeProvider>
                <SafeAreaProvider>
                  <AppWithAuth />
                </SafeAreaProvider>
              </BadgeProvider>
            </PrefsProvider>
          </HUDProvider>
        </ToastProvider>
      </ConfirmProvider>
    </ThemeProvider>
  );
}
