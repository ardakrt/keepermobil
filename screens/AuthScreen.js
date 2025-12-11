import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Animated as RNAnimated,
  Dimensions,
  Pressable,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '../lib/supabaseClient';
import { getResetRedirectURL } from '../lib/links';
import { biometricPrefs } from '../lib/biometricPrefs';
import {
  REMEMBER_KEY,
  SESSION_KEY,
  REMEMBER_EMAIL_KEY,
  REMEMBER_PASSWORD_KEY,
  RECENT_EMAILS_KEY,
  REMEMBER_FIRST_NAME_KEY,
  REMEMBER_AVATAR_URL_KEY,
  PIN_SESSION_KEY,
} from '../lib/storageKeys';
import { localAuth } from '../lib/localAuth';
import { savePin, verifyPin, hasPin as checkHasPin } from '../lib/pinService';
import Screen from '../components/Screen';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAppTheme } from '../lib/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { usePrefs } from '../lib/prefs';
import { useConfirm } from '../lib/confirm';

// Helper to store only essential session data to avoid 2048 byte limit
const minifySession = (session) => {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user: {
      id: session.user?.id,
      email: session.user?.email,
    }
  };
};

const AuthScreen = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('signIn'); // signIn | signUp
  const [signStep, setSignStep] = useState('email'); // signIn: email | password | createPin | enterPin, signUp: email | details | password | createPin
  const [signUpStep, setSignUpStep] = useState(1); // 1: email, 2: details, 3: password, 4: createPin

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // PIN states
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [hasStoredPin, setHasStoredPin] = useState(false);
  const [storedPinSession, setStoredPinSession] = useState(null);
  const [pendingSession, setPendingSession] = useState(null); // Parola girişi sonrası PIN oluşturma için bekleyen session
  const [emailValid, setEmailValid] = useState(true);

  // Sadece e-posta hatırlanacak; parola/PIN saklama kaldırıldı
  const [rememberEmailEnabled, setRememberEmailEnabled] = useState(true); // future toggle if needed
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [verificationMode, setVerificationMode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [verifyCooldown, setVerifyCooldown] = useState(0);

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSession, setBiometricSession] = useState(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricFailCount, setBiometricFailCount] = useState(0);
  const [showPinFallback, setShowPinFallback] = useState(false); // PIN fallback için parola girişi
  const [initialLoading, setInitialLoading] = useState(true); // Başlangıç yüklemesi için
  const [pinResetLoading, setPinResetLoading] = useState(false); // PIN sıfırlama loading
  const [pinResetCooldown, setPinResetCooldown] = useState(0); // PIN sıfırlama cooldown
  const { theme } = useAppTheme();
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const lockScale = useRef(new RNAnimated.Value(1)).current;
  const [recentEmails, setRecentEmails] = useState([]);
  // Shake animation for error feedback
  const shakeAnim = useRef(new RNAnimated.Value(0)).current;
  const lastTriedPasswordRef = useRef(null);
  const lastTriedPinRef = useRef(null);
  const keyboardOffset = useRef(new RNAnimated.Value(0)).current;
  const passwordErrorRef = useRef(false);
  const pinErrorRef = useRef(false);
  const hiddenPinInputRef = useRef(null);
  const HANE_SAYISI = 6;
  const successFlash = useRef(new RNAnimated.Value(0)).current;
  const errorFlash = useRef(new RNAnimated.Value(0)).current;
  const [failedCount, setFailedCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(null); // timestamp ms
  const [lockRemaining, setLockRemaining] = useState(0);
  const passwordInputRef = useRef(null);
  const cardYRef = useRef(0);
  const cardHeightRef = useRef(0);
  const compressedHeader = useRef(new RNAnimated.Value(0)).current;
  const scrollViewRef = useRef(null);
  // Header artık tamamen kaybolmasın: 0 -> normal, 1 -> kısmen sıkışmış
  const headerAnimatedStyle = {
    height: compressedHeader.interpolate({ inputRange: [0, 1], outputRange: [180, 110] }),
    overflow: 'hidden',
  };
  const avatarScale = compressedHeader.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });
  const displayOpacity = compressedHeader.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  // Header sıkıştığında arkaya koyu bir overlay + altta gradient ekle
  const overlayOpacity = compressedHeader.interpolate({ inputRange: [0, 0.0001, 1], outputRange: [0, 0, 0.65] });



  useEffect(() => {
    if (forgotCooldown <= 0) {
      // Cooldown bittiğinde rate limit hatasını temizle
      setError((prev) => prev?.includes('saniye beklemeniz') ? '' : prev);
      return;
    }
    const t = setInterval(() => {
      setForgotCooldown((s) => {
        const newVal = s > 0 ? s - 1 : 0;
        // Hata mesajını güncelle (canlı geri sayım)
        if (newVal > 0) {
          setError(`Güvenlik nedeniyle ${newVal} saniye beklemeniz gerekmektedir.`);
        } else {
          setError('');
        }
        return newVal;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [forgotCooldown > 0]);

  useEffect(() => {
    if (verifyCooldown <= 0) return;
    const t = setInterval(() => setVerifyCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [verifyCooldown]);

  useEffect(() => {
    if (pinResetCooldown <= 0) {
      // Cooldown bittiğinde rate limit hatasını temizle
      setError((prev) => prev?.includes('saniye beklemeniz') ? '' : prev);
      return;
    }
    const t = setInterval(() => {
      setPinResetCooldown((s) => {
        const newVal = s > 0 ? s - 1 : 0;
        // Hata mesajını güncelle (canlı geri sayım)
        if (newVal > 0) {
          setError(`Güvenlik nedeniyle ${newVal} saniye beklemeniz gerekmektedir.`);
        } else {
          setError('');
        }
        return newVal;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [pinResetCooldown > 0]);

  useEffect(() => {
    RNAnimated.spring(lockScale, {
      toValue: passwordFocused ? 1.06 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [passwordFocused]);

  // Haptics preference
  const { hapticsEnabled } = usePrefs();
  const { confirm } = useConfirm();

  // Klavye animasyonu
  useEffect(() => {
    const showSub = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
    const hideSub = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';
    let lastShift = 0;
    let animating = false;

    const animateTo = (value, headerValue) => {
      if (animating) return; // debounce
      animating = true;
      RNAnimated.parallel([
        RNAnimated.spring(keyboardOffset, {
          toValue: value,
          useNativeDriver: true,
          damping: 20,
          mass: 0.8,
          stiffness: 100,
          overshootClamping: false,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        }),
        RNAnimated.spring(compressedHeader, {
          toValue: headerValue,
          useNativeDriver: false,
          damping: 20,
          mass: 0.8,
          stiffness: 100,
          overshootClamping: false,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        }),
      ]).start(() => { animating = false; });
    };

    const showListener = Keyboard.addListener(showSub, (e) => {
      const kbH = e?.endCoordinates?.height || 0;
      const screenH = Dimensions.get('window').height;
      const targetTop = 80; // Daha az agresif shift
      const currentBottom = cardYRef.current + cardHeightRef.current;
      const overlap = currentBottom + kbH - screenH;
      let shift = 0;
      if (overlap > 0) shift = overlap * 0.6; // %60 overlap kompanzasyonu - daha yumuşak
      shift = Math.max(shift, (cardYRef.current - targetTop) * 0.5); // %50 shift - daha az hareket
      shift = Math.min(shift, 100); // Daha düşük maksimum
      // Minimal hareket eşiği (göz kırpmasını engelle)
      if (Math.abs(shift - lastShift) < 8) shift = lastShift; else lastShift = shift;
      // Header hiç sıkıştırma - Keeper her zaman tam boyutunda
      animateTo(-shift, 1);
    });
    const hideListener = Keyboard.addListener(hideSub, () => {
      lastShift = 0;
      animateTo(0, 0);
    });
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [keyboardOffset, compressedHeader]);

  // Kilit geri sayım
  useEffect(() => {
    if (!lockUntil) return;
    const update = () => {
      const nowTs = Date.now();
      if (nowTs >= lockUntil) {
        setLockUntil(null);
        setLockRemaining(0);
        setFailedCount(0);
      } else {
        setLockRemaining(Math.ceil((lockUntil - nowTs) / 1000));
      }
    };
    update();
    const t = setInterval(update, 500);
    return () => clearInterval(t);
  }, [lockUntil]);

  useEffect(() => {
    (async () => {
      try {
        // Önce bekleyen signup (PIN oluşturma) var mı kontrol et
        const pendingSignupSession = await SecureStore.getItemAsync('PENDING_SIGNUP_SESSION');
        const pendingSignupEmail = await SecureStore.getItemAsync('PENDING_SIGNUP_EMAIL');

        if (pendingSignupSession && pendingSignupEmail) {
          // Debug log removed
          setEmail(pendingSignupEmail);
          setMode('signUp');
          setSignUpStep(4);
          setPin('');
          setPinConfirm('');
          setInfo('Hızlı giriş için 6 haneli PIN oluşturun.');
          setInitialLoading(false);
          return;
        }

        // Önce PIN session kontrolü yap
        const [storedPinSessionStr, storedEmail, storedRecent] = await Promise.all([
          SecureStore.getItemAsync(PIN_SESSION_KEY),
          AsyncStorage.getItem(REMEMBER_EMAIL_KEY),
          AsyncStorage.getItem(RECENT_EMAILS_KEY),
        ]);

        // PIN session varsa, cloud'dan PIN'i kontrol et
        if (storedPinSessionStr) {
          try {
            const pinSession = JSON.parse(storedPinSessionStr);
            // Session formatı geçerli mi kontrol et
            if (pinSession?.access_token && pinSession?.refresh_token && pinSession?.user?.id) {

              // ÖNEMLİ DEĞİŞİKLİK:
              // Session'ı hemen doğrulamaya çalışma (setSession yapma).
              // Eğer session süresi dolmuşsa bile, kullanıcıya önce PIN sormalıyız.
              // PIN doğru girilirse, handlePinLogin içinde session yenilemeyi deneyeceğiz.

              // PIN'in varlığını kontrol et (opsiyonel ama iyi olur - offline ise geç)
              let pinExists = true;
              try {
                // Cloud kontrolü (internet varsa)
                // Auth gerektirmeyen bir yol olmadığı için şimdilik varsayalım ki PIN var.
                // PIN session zaten "PIN var" demek.
              } catch (e) { }

              if (pinExists) {
                // Session'ı signOut yap - PIN ile giriş yapılana kadar aktif session olmasın
                await supabase.auth.signOut();

                setHasStoredPin(true);
                setStoredPinSession(pinSession);
                setSignStep('enterPin');

                // Kullanıcı bilgilerini yükle
                const emailFromSession = pinSession.user?.email;
                const emailVal = emailFromSession || (storedEmail || '').trim();

                if (emailVal) {
                  setEmail(emailVal);
                  const [storedFirstName, storedAvatarUrl] = await Promise.all([
                    AsyncStorage.getItem(`${REMEMBER_FIRST_NAME_KEY}_${emailVal}`),
                    AsyncStorage.getItem(`${REMEMBER_AVATAR_URL_KEY}_${emailVal}`),
                  ]);
                  if (storedFirstName) setFirstName(storedFirstName);
                  if (storedAvatarUrl) setAvatarUrl(storedAvatarUrl);

                  // Cache'de yoksa metadata'dan al
                  const userMeta = pinSession.user?.user_metadata;
                  if (userMeta) {
                    const metaName = userMeta.full_name || userMeta.first_name;
                    const metaAvatar = userMeta.avatar_url;
                    if (metaName && !storedFirstName) {
                      setFirstName(metaName);
                      await AsyncStorage.setItem(`${REMEMBER_FIRST_NAME_KEY}_${emailVal}`, metaName);
                    }
                    if (metaAvatar && !storedAvatarUrl) {
                      setAvatarUrl(metaAvatar);
                      await AsyncStorage.setItem(`${REMEMBER_AVATAR_URL_KEY}_${emailVal}`, metaAvatar);
                    }
                  }
                }

                if (storedRecent) {
                  try { setRecentEmails(JSON.parse(storedRecent) || []); } catch { }
                }

                // Parmak izi durumunu kontrol et
                try {
                  const biometricOptIn = await biometricPrefs.getOptIn();
                  const storedBiometricSession = await biometricPrefs.getStoredSession();
                  if (biometricOptIn && storedBiometricSession && localAuth.hasFullSupport()) {
                    setBiometricEnabled(true);
                    setBiometricSession(storedBiometricSession);
                  }
                } catch (e) {
                  console.warn('Biometric check failed:', e);
                }

                setInitialLoading(false);
                return; // PIN girişi gösterilecek
              }
            }
          } catch (e) {
            console.warn('PIN session parse failed', e);
          }
        }

        // PIN yoksa normal akış
        const emailVal = (storedEmail || '').trim();
        if (emailVal) {
          setEmail(emailVal);

          // Eğer PIN session yoksa ama e-posta kayıtlıysa, bu kullanıcının bulutta PIN'i var mı kontrol et
          try {
            // Sadece PIN var mı kontrol et, auth gerektirmez (RPC veya public endpoint varsa)
            // Ancak şu anki yapıda user ID gerekli. 
            // Bu durumda önce e-postadan user ID bulmak gerekir ama güvenlik açısından bu açık olabilir.
            // Alternatif: Kullanıcıyı login olmaya zorla ama eğer PIN'i varsa (ve daha önce giriş yapmışsa)
            // bunu hatırlamaya çalış.

            // Şimdilik: Eğer email varsa ve PIN session yoksa, yine de 'enterPin' yerine 'password' ekranına atıyoruz.
            // Kullanıcının istediği: "hep pin ekranına göndersin".
            // Bunun için PIN session'ın (refreshToken'ın) süresinin dolmaması veya uzun olması gerekir.
            // Veya PIN ile girişi "offline" gibi düşünüp, önce PIN sorup, sonra arkada login denemeliyiz.
            // Ancak login için password lazım. PIN sadece yerel bir kilit veya session kilidi.
            // Eğer session ölmüşse, PIN ile o session'ı canlandıramayız (session verisi yoksa).

            // MEVCUT DURUM: storedPinSessionStr varsa (yani session saklanmışsa) PIN soruyor.
            // Eğer storedPinSessionStr yoksa (silinmişse veya expire olmuşsa) baştan başlatıyor.

            // İYİLEŞTİRME: Session'ı daha kalıcı hale getirmek veya silinmesini önlemek.
            // Şu anki kodda session varsa zaten PIN soruyor.
            // Kullanıcı "uygulamayı kapatıp açtığımda eposta kısmına atıyor" diyorsa,
            // muhtemelen storedPinSessionStr bulunamıyor veya siliniyor.
          } catch (e) { }

          // Email varsa password adımına geç
          setSignStep('password');

          // Önce cache'den hızlıca yükle
          const [storedFirstName, storedAvatarUrl] = await Promise.all([
            AsyncStorage.getItem(`${REMEMBER_FIRST_NAME_KEY}_${emailVal}`),
            AsyncStorage.getItem(`${REMEMBER_AVATAR_URL_KEY}_${emailVal}`),
          ]);
          if (storedFirstName) {
            setFirstName(storedFirstName);
          }
          if (storedAvatarUrl) {
            setAvatarUrl(storedAvatarUrl);
          }

          // Ardından Supabase'den güncel bilgileri çek
          try {
            const { data: userInfo, error: userError } = await supabase
              .rpc('get_user_info_by_email', { user_email: emailVal });

            if (!userError && userInfo && userInfo.length > 0) {
              const info = userInfo[0];
              if (info.first_name) {
                setFirstName(info.first_name);
                await AsyncStorage.setItem(`${REMEMBER_FIRST_NAME_KEY}_${emailVal}`, info.first_name);
              }
              if (info.avatar_url) {
                setAvatarUrl(info.avatar_url);
                await AsyncStorage.setItem(`${REMEMBER_AVATAR_URL_KEY}_${emailVal}`, info.avatar_url);
              }
            }
          } catch (err) {
            console.warn('Supabase kullanıcı bilgileri yüklenemedi:', err);
          }
        }
        if (storedRecent) {
          try { setRecentEmails(JSON.parse(storedRecent) || []); } catch { }
        }
      } catch (err) {
        console.warn('Email remember load failed', err);
      }

      try {
        const hardware = await localAuth.hasHardwareAsync();
        const types = await localAuth.supportedAuthenticationTypesAsync();
        const supports = hardware || (types?.length ?? 0) > 0;
        const enrolled = supports ? await localAuth.isEnrolledAsync() : false;

        setBiometricSupported(supports);
        setBiometricEnrolled(!!enrolled);

        const optIn = await biometricPrefs.getOptIn();
        const session = await biometricPrefs.getStoredSession();

        if (optIn && session) {
          setBiometricEnabled(true);
          setBiometricSession(session);
        }
      } catch (err) {
        console.warn('Biometric capability check failed', err);
      } finally {
        // Biometric durumu yüklendi, artık ekranı gösterebiliriz
        setInitialLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!rememberEmailEnabled) return;
    AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email.trim()).catch(() => undefined);
  }, [email, rememberEmailEnabled]);

  // Email değiştiğinde o emaile ait kullanıcı bilgilerini yükle
  useEffect(() => {
    if (!email.trim() || mode === 'signUp') return;

    (async () => {
      try {
        // Önce AsyncStorage'dan cached değeri dene
        const cachedName = await AsyncStorage.getItem(`${REMEMBER_FIRST_NAME_KEY}_${email.trim()}`);
        const cachedAvatar = await AsyncStorage.getItem(`${REMEMBER_AVATAR_URL_KEY}_${email.trim()}`);

        if (cachedName) setFirstName(cachedName);
        if (cachedAvatar) setAvatarUrl(cachedAvatar);
      } catch (err) {
        console.warn('Failed to load cached user data', err);
      }
    })();
  }, [email, mode]);

  // Parola adımına geçildiğinde isim boşsa kayıt sırasında girilen isimden (cache/metadata) çekmeyi dene
  useEffect(() => {
    if (mode !== 'signIn' || signStep !== 'password') return;
    if (!email.trim() || firstName.trim()) return;
    (async () => {
      try {
        const cachedName = await AsyncStorage.getItem(`${REMEMBER_FIRST_NAME_KEY}_${email.trim()}`);
        if (cachedName) {
          setFirstName(cachedName);
          return;
        }
        // Oturum beklenmedik şekilde mevcutsa metadata'dan dene
        const { data } = await supabase.auth.getSession();
        const metaName = data?.session?.user?.user_metadata?.full_name || data?.session?.user?.user_metadata?.first_name;
        if (metaName) setFirstName(metaName);
      } catch (err) {
        // sessizce geç
      }
    })();
  }, [mode, signStep, email, firstName]);

  // Otomatik parmak izi kaldırıldı - kullanıcı "Giriş Yap" butonuna basınca sorulacak

  const persistSessionIfNeeded = async (session) => {
    if (!session) {
      return;
    }

    try {
      const userEmail = email.trim();
      // Sadece email sakla (isteğe bağlı session saklamıyoruz)
      await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, userEmail);
      const metaName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.first_name || firstName?.trim();
      if (metaName) {
        await AsyncStorage.setItem(`${REMEMBER_FIRST_NAME_KEY}_${userEmail}`, metaName);
        setFirstName(metaName);
      }
      const metaAvatar = session?.user?.user_metadata?.avatar_url;
      if (metaAvatar) {
        await AsyncStorage.setItem(`${REMEMBER_AVATAR_URL_KEY}_${userEmail}`, metaAvatar);
        setAvatarUrl(metaAvatar);
      }
    } catch (err) {
      console.warn('Session persistence failed', err);
    }
  };

  const storeBiometricSession = async (session) => {
    if (!session?.refresh_token || !session?.access_token || !localAuth.hasFullSupport()) {
      return;
    }

    try {
      await biometricPrefs.setStoredSession(session);
      setBiometricEnabled(true);
      setBiometricSession(session);
    } catch (err) {
      console.warn('Biometric session store failed', err);
    }
  };


  const finalizeAuth = async (session) => {
    await persistSessionIfNeeded(session);
    // Ensure supabase client has the active session so subsequent queries work
    try {
      if (session?.access_token && session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }
    } catch (e) {
      console.warn('Supabase setSession after auth failed', e);
    }

    // Eğer parmak izi aktifse, yeni session'ı biometric olarak kaydet
    try {
      const biometricOptIn = await biometricPrefs.getOptIn();
      if (biometricOptIn && session?.access_token && session?.refresh_token) {
        await biometricPrefs.setStoredSession(session);
        setBiometricEnabled(true);
        setBiometricSession(session);
      }
    } catch (e) {
      console.warn('Biometric session update failed', e);
    }

    onAuthSuccess?.(session ?? null);
    // recent emails list update
    try {
      const clean = email.trim().toLowerCase();
      if (clean) {
        const next = [clean, ...recentEmails.filter((e) => e !== clean)].slice(0, 3);
        setRecentEmails(next);
        await AsyncStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(next));
      }
    } catch { }
  };

  const requireBiometricBeforeLogin = async () => {
    const optIn = await biometricPrefs.getOptIn();
    if (!optIn) {
      return true;
    }

    if (!localAuth.hasFullSupport()) {
      setError('Parmak izi doğrulaması bu cihazda desteklenmiyor.');
      return false;
    }

    try {
      const auth = await localAuth.authenticateAsync({
        promptMessage: 'Parmak izi doğrulaması',
      });
      if (!auth.success) {
        setError('Parmak izi doğrulaması iptal edildi.');
        return false;
      }
      return true;
    } catch (err) {
      setError(err.message ?? 'Parmak izi doğrulaması başarısız.');
      return false;
    }
  };

  const validatePassword = () => {
    if (password.length < 6) {
      setError('Parola en az 6 karakter olmalıdır.');
      return false;
    }
    return true;
  };

  const validatePin = () => {
    if (!/^\d{6}$/.test(pin)) {
      setError('PIN 6 haneli olmalıdır.');
      return false;
    }
    return true;
  };

  // PIN ile giriş yap
  const handlePinLogin = async () => {
    if (lockUntil) {
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      }
      return;
    }

    if (!validatePin()) {
      triggerShake();
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Adım: Önce session'ı canlandırmayı dene
      if (!storedPinSession) {
        setError('Oturum bilgisi bulunamadı. Parola ile giriş yapın.');
        setShowPinFallback(true);
        setLoading(false);
        return;
      }

      // Refresh token ile yeni bir session almayı dene
      let sessionData = null;
      const { data, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: storedPinSession.refresh_token,
      });

      if (refreshError || !data?.session) {
        console.warn('PIN login: Session revival failed', refreshError);

        // Trusted Device Check: Try to revive session using stored password
        try {
          const storedPassword = await SecureStore.getItemAsync(REMEMBER_PASSWORD_KEY);
          const emailForLogin = storedPinSession.user?.email || email;

          if (storedPassword && emailForLogin) {
            console.log('Trusted Device: Attempting silent re-login with stored credentials...');
            const { data: reAuthData, error: reAuthError } = await supabase.auth.signInWithPassword({
              email: emailForLogin,
              password: storedPassword,
            });

            if (!reAuthError && reAuthData?.session) {
              console.log('Trusted Device: Silent re-login successful! Session revived.');

              // Update session data
              sessionData = reAuthData.session;

              // Refresh token is now fresh, update stored PIN session immediately
              await SecureStore.setItemAsync(PIN_SESSION_KEY, JSON.stringify(minifySession(reAuthData.session)));
              setStoredPinSession(reAuthData.session);
            } else {
              console.warn('Trusted Device: Silent re-login failed', reAuthError);
              throw reAuthError || new Error('Silent login failed');
            }
          } else {
            console.warn('Trusted Device: No stored credentials found. storedPassword:', !!storedPassword, 'emailForLogin:', emailForLogin);
            throw new Error('No stored credentials');
          }
        } catch (silentLoginError) {
          console.warn('Silent login error:', silentLoginError?.message);
          // If silent login fails (or no password stored), redirect to password screen
          setError('Oturum yenilenemiyor. Lütfen parolanızla tekrar giriş yapın.');

          // Otomatik olarak parola ekranına geç
          setShowPinFallback(true);
          setSignStep('password');
          setPin('');

          // Clean up dead session
          await SecureStore.deleteItemAsync(PIN_SESSION_KEY);
          setStoredPinSession(null);
          setHasStoredPin(false);

          setLoading(false);
          return;
        }
      } else {
        // Refresh başarılı
        sessionData = data.session;

        // Başarılı refresh sonrası session'ı güncelle
        if (data.session.refresh_token !== storedPinSession.refresh_token) {
          console.log('PIN login: Token rotated, updating stored session');
          await SecureStore.setItemAsync(PIN_SESSION_KEY, JSON.stringify(minifySession(data.session)));
          setStoredPinSession(data.session);
        }
      }

      // Session'ı Supabase client'a set et
      await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });

      // 2. Adım: Session artık aktif, şimdi PIN'i doğrula
      const userId = sessionData.user.id;
      const pinResult = await verifyPin(pin, userId);

      if (!pinResult.valid) {
        // PIN yanlış girildiğinde güvenli çıkış yap ama session iptal etme (refresh token yanmasın)
        console.warn('PIN login: Invalid PIN');

        setError('PIN hatalı.');
        pinErrorRef.current = true;
        setFailedCount((c) => {
          const next = c + 1;
          if (next >= 3) {
            // 3 kez yanlış girildiğinde parola ekranına at
            setError('3 kez hatalı PIN girdiniz. Lütfen parolanızla giriş yapın.');
            setShowPinFallback(true);

            // PIN session'ı sil
            SecureStore.deleteItemAsync(PIN_SESSION_KEY).catch(() => { });
            setStoredPinSession(null);
            setHasStoredPin(false);

            // Çıkış yap
            supabase.auth.signOut().catch(() => { });

            setMode('signIn');
            setSignStep('password');
            return 0;
          }
          return next;
        });
        if (hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        }
        triggerShake();
        setLoading(false);
        return;
      }

      // 3. Adım: Başarılı
      pinErrorRef.current = false;
      setFailedCount(0);

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }

      onAuthSuccess?.(sessionData);
    } catch (err) {
      console.error('PIN login exception:', err);
      // Beklenmedik hata
      await supabase.auth.signOut();
      setError(err.message ?? 'Giriş yapılamadı.');
      setShowPinFallback(true);
    } finally {
      setLoading(false);
    }
  };

  // PIN oluştur ve kaydet
  const handleCreatePin = async () => {
    if (!validatePin()) {
      triggerShake();
      return;
    }

    if (pin !== pinConfirm) {
      setError('PIN\'ler eşleşmiyor.');
      triggerShake();
      return;
    }

    setLoading(true);
    setError('');

    try {
      // PIN'i kullanıcı ID'si ile hem Supabase'e hem lokal depoya kaydet
      const userId = pendingSession?.user?.id;
      if (!userId) {
        setError('Kullanıcı bilgisi bulunamadı.');
        setLoading(false);
        return;
      }

      // PIN'i Supabase ve lokal depoya kaydet
      const pinResult = await savePin(pin, userId);
      if (!pinResult.success) {
        setError(pinResult.error || 'PIN kaydedilemedi.');
        setLoading(false);
        return;
      }

      // Session'ı da kaydet
      if (pendingSession) {
        const minified = minifySession(pendingSession);
        await SecureStore.setItemAsync(PIN_SESSION_KEY, JSON.stringify(minified));

        // Kullanıcı bilgilerini de kaydet (isim, avatar, email)
        await persistSessionIfNeeded(pendingSession);

        setStoredPinSession(pendingSession);
        setHasStoredPin(true);

        if (hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }

        // Giriş yap
        onAuthSuccess?.(pendingSession);
      } else {
        setError('Oturum bilgisi bulunamadı.');
      }
    } catch (err) {
      setError(err.message ?? 'PIN kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  // PIN girişi için otomatik tetikleme
  useEffect(() => {
    if (signStep === 'enterPin' && /^\d{6}$/.test(pin) && !loading) {
      if (lastTriedPinRef.current === pin) return;
      lastTriedPinRef.current = pin;
      handlePinLogin();
    }
  }, [pin, signStep, loading]);

  // PIN değişince hata görselini temizle
  useEffect(() => {
    if (pinErrorRef.current && pin.length < 6) {
      pinErrorRef.current = false;
      if (error && error.startsWith('PIN hatalı')) setError('');
    }
  }, [pin, error]);

  const handlePinChange = (value) => {
    if (lockUntil) return;
    const digits = value.replace(/\D/g, '').slice(0, HANE_SAYISI);
    setPin(digits);
  };

  const focusHiddenPin = useCallback(() => {
    const input = hiddenPinInputRef.current;
    if (!input) return;
    input.focus?.();
  }, []);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    const seq = [];
    const pattern = [1, -1, 1, -1, 0];
    pattern.forEach((val, idx) => {
      seq.push(
        RNAnimated.timing(shakeAnim, {
          toValue: val,
          duration: idx === pattern.length - 1 ? 60 : 45,
          useNativeDriver: true,
        }),
      );
    });
    RNAnimated.sequence(seq).start();
  };

  const handleAuth = async () => {
    if (lockUntil) {
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      }
      errorFlash.setValue(0);
      RNAnimated.sequence([
        RNAnimated.timing(errorFlash, { toValue: 1, duration: 140, useNativeDriver: true }),
        RNAnimated.timing(errorFlash, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
      return;
    }
    // Başarılı akışta titreşim istemiyoruz; yalnızca hata durumlarında titreşim var
    setLoading(true);
    setError('');
    setInfo('');

    try {
      if (!email.trim()) {
        setError('Lütfen e-posta girin.');
        setSignStep('email');
        setSignUpStep(1);
        return;
      }

      // SignUp akışı - 3 adımlı
      if (mode === 'signUp') {
        // Adım 1: Email validasyonu
        if (signUpStep === 1) {
          if (!validateEmail(email.trim())) {
            setError('Geçerli bir e-posta adresi giriniz.');
            setEmailValid(false);
            return;
          }
          setEmailValid(true);
          setSignUpStep(2);
          setError('');
          return;
        }

        // Adım 2: Ad soyad kontrolü
        if (signUpStep === 2) {
          if (!firstName.trim()) {
            setError('Lütfen ad soyadınızı giriniz.');
            return;
          }
          setSignUpStep(3);
          setPassword('');
          setPasswordConfirm('');
          setError('');
          return;
        }

        // Adım 3: Parola oluşturma
        if (signUpStep === 3) {
          if (!validatePassword()) {
            setError('Parola en az 6 karakter olmalıdır.');
            errorFlash.setValue(0);
            RNAnimated.sequence([
              RNAnimated.timing(errorFlash, { toValue: 1, duration: 120, useNativeDriver: true }),
              RNAnimated.timing(errorFlash, { toValue: 0, duration: 220, useNativeDriver: true }),
            ]).start();
            return;
          }

          // Kayıt işlemi
          const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: { data: { first_name: firstName.trim(), full_name: firstName.trim() } },
          });
          if (signUpError) {
            setError(signUpError.message);
            return;
          }

          if (!data.session) {
            setVerificationMode(true);
            setInfo('E-posta adresinize gönderilen 6 haneli doğrulama kodunu giriniz.');
            return;
          }

          // Avatar varsa Supabase'e yükle ve session'ı güncelle
          let updatedSession = data.session;
          if (avatarUrl && data.user) {
            try {
              const userId = data.user.id;
              const fileExt = avatarUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
              const fileName = `${userId}.${Date.now()}.${fileExt}`;
              const filePath = `${userId}/${fileName}`;

              // React Native için ArrayBuffer kullanarak dosya yükleme
              const response = await fetch(avatarUrl);
              const arrayBuffer = await response.arrayBuffer();
              const fileData = new Uint8Array(arrayBuffer);

              const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, fileData, {
                  contentType: `image/${fileExt}`,
                  upsert: true,
                });

              if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                  .from('avatars')
                  .getPublicUrl(filePath);

                // User metadata'yı güncelle ve güncel session'ı al
                const { data: updateData, error: updateError } = await supabase.auth.updateUser({
                  data: { avatar_url: publicUrl }
                });

                if (!updateError && updateData?.user) {
                  // Güncellenmiş session'ı kullan
                  updatedSession = {
                    ...updatedSession,
                    user: updateData.user
                  };
                  // Local state'i güncelle
                  setAvatarUrl(publicUrl);
                }
              } else {
                console.warn('Avatar upload error:', uploadError);
              }
            } catch (err) {
              console.warn('Avatar yükleme hatası:', err);
              // Avatar hatasında kayıt işlemini durdurmayalım
            }
          }

          // Kayıt başarılı - PIN oluşturma adımına geç
          // Session'ı SecureStore'a kaydet ve direkt PIN ekranına geç
          console.log('SignUp success - going to PIN step, session:', !!updatedSession);

          // Session ve şifreyi sakla (PIN sonrası kullanmak için)
          await SecureStore.setItemAsync('PENDING_SIGNUP_SESSION', JSON.stringify(minifySession(updatedSession)));
          await SecureStore.setItemAsync('PENDING_SIGNUP_EMAIL', email.trim());
          await SecureStore.setItemAsync('PENDING_SIGNUP_PASSWORD', password);

          // Supabase'den geçici çıkış yap - App.js listener'ı tetiklenmesin
          // AMA önce state'leri ayarla
          setPin('');
          setPinConfirm('');
          setSignUpStep(4);
          setMode('signUp');
          setError('');
          setInfo('Hızlı giriş için 6 haneli PIN oluşturun.');

          // Şimdi signOut yap
          await supabase.auth.signOut();
          // Debug log removed
          return;
        }

        // SignUp Adım 4: PIN oluşturma
        if (signUpStep === 4) {
          if (!validatePin()) {
            triggerShake();
            return;
          }
          if (pin !== pinConfirm) {
            setError('PIN\'ler eşleşmiyor.');
            triggerShake();
            return;
          }

          // Pending signup bilgilerini al
          const pendingEmail = await SecureStore.getItemAsync('PENDING_SIGNUP_EMAIL');
          const pendingPassword = await SecureStore.getItemAsync('PENDING_SIGNUP_PASSWORD');

          const loginEmail = pendingEmail || email.trim();
          const loginPassword = pendingPassword || password;

          // Tekrar giriş yap (signOut yapmıştık)
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: loginPassword,
          });

          if (loginError) {
            setError('Giriş yapılamadı: ' + loginError.message);
            return;
          }

          // PIN'i kullanıcı ID'si ile hem Supabase'e hem lokale kaydet
          const userId = loginData.session?.user?.id;
          if (userId) {
            const pinResult = await savePin(pin, userId);
            if (!pinResult.success) {
              console.warn('PIN kaydetme hatası:', pinResult.error);
              // Hata olsa bile devam et, lokal kayıt yapılmış olabilir
            }
          }

          // Pending signup bilgilerini temizle
          await SecureStore.deleteItemAsync('PENDING_SIGNUP_SESSION');
          await SecureStore.deleteItemAsync('PENDING_SIGNUP_EMAIL');
          await SecureStore.deleteItemAsync('PENDING_SIGNUP_PASSWORD');

          const session = loginData.session;
          if (session) {
            await SecureStore.setItemAsync(PIN_SESSION_KEY, JSON.stringify(minifySession(session)));
            await persistSessionIfNeeded(session);
            setStoredPinSession(session);
            setHasStoredPin(true);

            if (hapticsEnabled) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            }
            onAuthSuccess?.(session);
          }
          return;
        }
      }

      // SignIn akışı - 2 adımlı
      if (mode === 'signIn') {
        if (signStep === 'email') {
          setPassword('');
          // Email adımından parola adımına geçerken Supabase'den kullanıcı bilgilerini çek
          try {
            const emailVal = email.trim();

            // Önce cache'den dene (hızlı)
            const [cachedName, cachedAvatar] = await Promise.all([
              AsyncStorage.getItem(`${REMEMBER_FIRST_NAME_KEY}_${emailVal}`),
              AsyncStorage.getItem(`${REMEMBER_AVATAR_URL_KEY}_${emailVal}`),
            ]);

            if (cachedName) setFirstName(cachedName);
            if (cachedAvatar) setAvatarUrl(cachedAvatar);

            // Ardından Supabase'den güncel bilgileri çek
            const { data: userInfo, error: userError } = await supabase
              .rpc('get_user_info_by_email', { user_email: emailVal });

            if (!userError && userInfo && userInfo.length > 0) {
              const info = userInfo[0];
              if (info.first_name) {
                setFirstName(info.first_name);
                // Cache'e kaydet
                await AsyncStorage.setItem(`${REMEMBER_FIRST_NAME_KEY}_${emailVal}`, info.first_name);
              }
              if (info.avatar_url) {
                setAvatarUrl(info.avatar_url);
                // Cache'e kaydet
                await AsyncStorage.setItem(`${REMEMBER_AVATAR_URL_KEY}_${emailVal}`, info.avatar_url);
              }
            }
          } catch (err) {
            console.warn('Kullanıcı bilgileri yüklenemedi:', err);
          }
          setSignStep('password');
          return;
        }

        if (!validatePassword()) {
          errorFlash.setValue(0);
          RNAnimated.sequence([
            RNAnimated.timing(errorFlash, { toValue: 1, duration: 120, useNativeDriver: true }),
            RNAnimated.timing(errorFlash, { toValue: 0, duration: 220, useNativeDriver: true }),
          ]).start();
          return;
        }

        const canProceed = await requireBiometricBeforeLogin();
        if (!canProceed) {
          return;
        }

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (signInError) {
          setError('Şifre veya e-posta hatalı.');
          passwordErrorRef.current = true;
          setFailedCount((c) => {
            const next = c + 1;
            if (next >= 3) {
              const lockMs = 15000; // 15s kilit
              setLockUntil(Date.now() + lockMs);
            }
            return next;
          });
          if (hapticsEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
          }
          triggerShake();
          successFlash.setValue(0);
          errorFlash.setValue(0);
          RNAnimated.sequence([
            RNAnimated.timing(errorFlash, { toValue: 1, duration: 140, useNativeDriver: true }),
            RNAnimated.timing(errorFlash, { toValue: 0, duration: 280, useNativeDriver: true }),
          ]).start();
          return;
        }

        // Başarılı giriş: metadata'yı hemen set et
        const metaName = data?.session?.user?.user_metadata?.full_name || data?.session?.user?.user_metadata?.first_name;
        const metaAvatar = data?.session?.user?.user_metadata?.avatar_url;
        if (metaName) setFirstName(metaName);
        if (metaAvatar) setAvatarUrl(metaAvatar);

        // Success flash animasyonu
        passwordErrorRef.current = false;
        setFailedCount(0);
        errorFlash.setValue(0);
        successFlash.setValue(0);
        RNAnimated.sequence([
          RNAnimated.timing(successFlash, { toValue: 1, duration: 100, useNativeDriver: true }),
          RNAnimated.timing(successFlash, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();


        // Parola ile giriş başarılı
        await persistSessionIfNeeded(data.session);

        // Güvenilir Cihaz: Parolayı güvenli alanda sakla
        try {
          if (password) {
            await SecureStore.setItemAsync(REMEMBER_PASSWORD_KEY, password);
          }
        } catch (e) {
          console.warn('Password save failed', e);
        }

        // Bu kullanıcı için PIN var mı kontrol et (önce lokal, sonra cloud)
        const userId = data.session?.user?.id;
        const pinStatus = await checkHasPin(userId);

        // Eğer bu kullanıcının PIN'i varsa, session'ı kaydet ve giriş yap
        if (pinStatus.has_pin) {
          // Cloud'da PIN varsa ama lokal'de yoksa, cloud'dan senkronize edilecek
          // PIN session'ı güncelle
          await SecureStore.setItemAsync(PIN_SESSION_KEY, JSON.stringify(minifySession(data.session)));
          setStoredPinSession(data.session);

          if (hapticsEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          }
          onAuthSuccess?.(data.session);
          return;
        }

        // Bu kullanıcının PIN'i yoksa, PIN oluşturma ekranına yönlendir
        setPendingSession(data.session);
        setPin('');
        setPinConfirm('');
        setSignStep('createPin');
        setError('');
        setInfo('Hızlı giriş için 6 haneli PIN oluşturun.');
        return;
      }
    } catch (err) {
      setError(err.message ?? 'Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Parola ile giriş için otomatik tetikleme kaldırıldı - kullanıcı butona basmalı



  // Parola değişince hata görselini temizle
  useEffect(() => {
    if (passwordErrorRef.current && password.length < 6) {
      passwordErrorRef.current = false;
      if (error && error.startsWith('Şifre veya e-posta')) setError('');
    }
  }, [password, error]);

  const focusPasswordInput = useCallback(() => {
    const input = passwordInputRef.current;
    if (!input) return;
    input.focus?.();
  }, []);

  // Klavye görünürlük durumu izleme ve geç kalmışsa tekrar focus
  useEffect(() => {
    if (signStep !== 'password') return;
    let shown = false;
    const show = Keyboard.addListener('keyboardDidShow', () => { shown = true; });
    const t1 = setTimeout(() => { if (!shown) focusPasswordInput(); }, 180);
    const t2 = setTimeout(() => { if (!shown) focusPasswordInput(); }, 400);
    const t3 = setTimeout(() => { if (!shown) focusPasswordInput(); }, 800);
    return () => { show.remove(); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [signStep, focusPasswordInput]);

  // Klavye açılmadıysa fallback: kısa süre izleyip kapalı kalırsa yeniden odakla
  useEffect(() => {
    if (signStep !== 'password') return;
    let triggered = false;
    const showSub = Keyboard.addListener('keyboardDidShow', () => { triggered = true; });
    const fallback = setTimeout(() => {
      if (!triggered) focusPasswordInput();
    }, 250);
    return () => { showSub.remove(); clearTimeout(fallback); };
  }, [signStep, focusPasswordInput]);

  const handlePasswordChange = (value) => {
    if (lockUntil) return; // kilitliyken giriş alma
    setPassword(value);
  };

  const handleFocusPasswordInput = () => {
    setTimeout(() => {
      focusPasswordInput();
    }, 50);
  };

  const renderPasswordField = (isSignUp) => {
    const hasError = passwordErrorRef.current;

    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 12,
        borderColor: hasError ? theme.colors.danger : (passwordFocused ? theme.colors.primary : theme.colors.border),
        backgroundColor: hasError ? theme.colors.danger + '08' : theme.colors.surfaceElevated,
        paddingHorizontal: 16,
        height: 56,
      }}>
        <MaterialCommunityIcons
          name="lock-outline"
          size={22}
          color={hasError ? theme.colors.danger : (passwordFocused ? theme.colors.primary : theme.colors.textSecondary)}
        />
        <TextInput
          ref={passwordInputRef}
          value={password}
          onChangeText={handlePasswordChange}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          secureTextEntry={!showPassword}
          placeholder={isSignUp ? 'Parolanızı oluşturun' : 'Parolanız'}
          placeholderTextColor={theme.colors.textSecondary}
          style={{
            flex: 1,
            fontSize: 16,
            color: theme.colors.text,
            marginLeft: 12,
            height: '100%',
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // PIN kutuları render fonksiyonu
  const renderPinBoxes = () => {
    const chars = pin.split('');
    const hasError = pinErrorRef.current;

    const boxes = Array.from({ length: HANE_SAYISI }, (_, i) => {
      const filled = i < chars.length;
      const isActive = chars.length === i && !hasError;

      let borderColor = theme.colors.border;
      let backgroundColor = theme.colors.surfaceElevated;

      if (hasError) {
        borderColor = theme.colors.danger;
        backgroundColor = theme.colors.danger + '08';
      } else if (filled) {
        borderColor = theme.colors.primary;
        backgroundColor = theme.colors.surfaceElevated;
      } else if (isActive) {
        borderColor = theme.colors.primary;
        backgroundColor = theme.colors.surfaceElevated;
      }

      return (
        <RNAnimated.View
          key={i}
          style={{
            width: 46,
            height: 56,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: borderColor,
            backgroundColor: backgroundColor,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: isActive ? theme.colors.primary : 'transparent',
            shadowOpacity: isActive ? 0.3 : 0,
            shadowRadius: isActive ? 6 : 0,
            shadowOffset: { width: 0, height: 2 },
            elevation: isActive ? 4 : 0,
          }}
        >
          {filled && (
            <Text style={{ fontSize: 32, fontWeight: '700', color: theme.colors.text }}>
              ●
            </Text>
          )}
        </RNAnimated.View>
      );
    });

    return (
      <Pressable
        android_disableSound
        onPress={() => hiddenPinInputRef.current?.focus()}
        style={{ alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 8 }}
        accessibilityLabel="PIN gir"
        accessibilityRole="button"
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>{boxes}</View>
      </Pressable>
    );
  };

  const handleVerifyCode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!verificationCode.trim()) {
      setError('Lütfen doğrulama kodunu girin.');
      return;
    }

    setVerificationLoading(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: verificationCode.trim(),
        type: 'signup',
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      setVerificationMode(false);
      setVerificationCode('');
      setInfo('Hesabınız başarıyla doğrulandı. Şimdi PIN oluşturun.');

      // Email doğrulama sonrası PIN oluşturma adımına geç
      // Session ve şifreyi kaydet
      await SecureStore.setItemAsync('PENDING_SIGNUP_SESSION', JSON.stringify(minifySession(data.session)));
      await SecureStore.setItemAsync('PENDING_SIGNUP_EMAIL', email.trim());
      await SecureStore.setItemAsync('PENDING_SIGNUP_PASSWORD', password);

      // State'leri ayarla
      setPin('');
      setPinConfirm('');
      setSignUpStep(4);
      setError('');

      // Supabase'den çıkış yap
      await supabase.auth.signOut();
    } catch (err) {
      setError(err.message ?? 'Kod doğrulanamadı.');
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (typeof verifyCooldown === 'number' && verifyCooldown > 0) return;
    if (!email.trim()) {
      setError('Geçerli bir e-posta adresi girin.');
      return;
    }

    try {
      await supabase.auth.resend({ type: 'signup', email: email.trim() });
      setInfo('Doğrulama kodu yeniden gönderildi.');
      if (typeof setVerifyCooldown === 'function') setVerifyCooldown(60);
    } catch (err) {
      setError(err.message ?? 'Kod yeniden gönderilemedi.');
    }
  };

  const toggleMode = () => {
    Haptics.selectionAsync().catch(() => undefined);
    setMode((prev) => (prev === 'signIn' ? 'signUp' : 'signIn'));
    setSignStep('email');
    setSignUpStep(1);
    setPassword('');
    setPasswordConfirm('');
    setPin('');
    setPinConfirm('');
    setError('');
    setInfo('');
    setVerificationMode(false);
    setVerificationCode('');
    setEmailValid(true);
    setPendingSession(null);
  };

  const validateEmail = (emailStr) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const handleBiometricLogin = async () => {
    if (!biometricSession || !localAuth.hasFullSupport()) {
      setError('Parmak izi için kayıtlı oturum bulunamadı.');
      setShowPinFallback(true);
      return;
    }

    setBiometricLoading(true);
    setError('');

    try {
      const auth = await localAuth.authenticateAsync({
        promptMessage: 'Parmak izi doğrulaması',
        cancelLabel: 'PIN ile giriş yap',
      });

      if (!auth.success) {
        const newFailCount = biometricFailCount + 1;
        setBiometricFailCount(newFailCount);

        if (newFailCount >= 3) {
          setShowPinFallback(true);
          setError('3 başarısız deneme. PIN ile giriş yapabilirsiniz.');
        } else {
          setError(`Parmak izi doğrulaması başarısız. (${newFailCount}/3)`);
        }

        if (hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
        }
        return;
      }

      // Önce setSession dene
      let { data, error: sessionError } = await supabase.auth.setSession({
        access_token: biometricSession.access_token,
        refresh_token: biometricSession.refresh_token,
      });

      // Eğer hata varsa refresh token ile yenilemeyi dene
      if (sessionError) {
        console.log('setSession failed, trying refresh:', sessionError.message);

        // Refresh token ile yenileme dene
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: biometricSession.refresh_token,
        });

        if (refreshError || !refreshData.session) {
          console.log('Refresh also failed:', refreshError?.message);
          setError('Oturum süresi dolmuş. PIN ile giriş yapın.');
          setShowPinFallback(true);
          // Geçersiz session'ı temizle
          await biometricPrefs.setStoredSession(null);
          setBiometricSession(null);
          return;
        }

        data = refreshData;
      }

      if (!data?.session) {
        setError('Oturum bilgisi alınamadı. PIN ile giriş yapın.');
        setShowPinFallback(true);
        return;
      }

      // Başarılı - sayacı sıfırla ve yeni session'ı kaydet
      setBiometricFailCount(0);
      await biometricPrefs.setStoredSession(data.session);
      setBiometricSession(data.session);
      onAuthSuccess?.(data.session);
    } catch (err) {
      setError(err.message ?? 'Parmak izi ile giriş tamamlanamadı.');
      setShowPinFallback(true);
    } finally {
      setBiometricLoading(false);
    }
  };

  // rememberMe kaldırıldı; sadece e-posta sessizce tutuluyor

  const renderPrimaryButtonLabel = () => {
    if (loading) {
      return <ActivityIndicator color="#0f172a" />;
    }

    if (mode === 'signIn') {
      return <Text style={styles.primaryButtonText}>{signStep === 'email' ? 'Devam' : 'Giriş Yap'}</Text>;
    }

    return <Text style={styles.primaryButtonText}>Kayıt Ol</Text>;
  };

  const getInitialsFromEmail = (val) => {
    const user = (val || '').split('@')[0] || '';
    const parts = user.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (user.slice(0, 2) || '??').toUpperCase();
  };

  const getDisplayNameFromEmail = (val) => {
    const user = (val || '').split('@')[0] || '';
    const parts = user
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => (p.length ? p[0].toUpperCase() + p.slice(1) : p));
    const name = parts.join(' ');
    return (name || user || 'Kullanıcı').toUpperCase();
  };

  const getDisplayName = () => {
    if (firstName.trim()) return firstName.trim();
    return getDisplayNameFromEmail(email);
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    // Eğer firstName varsa kullan, yoksa generic greeting
    const hasRealName = firstName.trim();
    const name = hasRealName ? firstName.trim() : '';

    if (hour >= 6 && hour < 9) {
      return hasRealName ? `Günaydın, ${name}` : 'Günaydın';
    } else if (hour >= 9 && hour < 17) {
      return hasRealName ? `İyi Günler, ${name}` : 'İyi Günler';
    } else if (hour >= 17 && hour < 24) {
      return hasRealName ? `İyi Akşamlar, ${name}` : 'İyi Akşamlar';
    } else {
      return hasRealName ? `İyi Geceler, ${name}` : 'İyi Geceler';
    }
  };

  const handleForgotPassword = async () => {
    if (typeof forgotCooldown === 'number' && forgotCooldown > 0) return;
    if (!email.trim()) {
      setError('Parola sıfırlamak için önce e-posta girin.');
      setSignStep('email');
      return;
    }
    try {
      setInfo('Parola sıfırlama bağlantısı gönderiliyor...');
      // Supabase'in gönderdiği e-postadaki link, redirectTo ile uygulama şemasına yönlendirilecek
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getResetRedirectURL(),
      });
      setInfo('E-posta adresinize parola sıfırlama bağlantısı gönderildi. Lütfen kontrol ediniz.');
      if (typeof setForgotCooldown === 'function') setForgotCooldown(60);
    } catch (err) {
      // Supabase rate limiting hatası kontrolü
      const rateLimitMatch = err.message?.match(/after (\d+) seconds/i);
      if (rateLimitMatch) {
        const seconds = parseInt(rateLimitMatch[1], 10);
        if (typeof setForgotCooldown === 'function') setForgotCooldown(seconds);
        setError(`Güvenlik nedeniyle ${seconds} saniye beklemeniz gerekmektedir.`);
      } else {
        setError(err.message ?? 'Parola sıfırlama başlatılamadı.');
      }
    }
  };

  // PIN sıfırlama - e-posta gönder
  const handleForgotPin = async () => {
    if (pinResetCooldown > 0) return;

    // Kayıtlı e-posta adresini al
    const userEmail = storedPinSession?.user?.email || email.trim();

    if (!userEmail) {
      setError('E-posta adresi bulunamadı. Lütfen parola ile giriş yapın.');
      return;
    }

    setPinResetLoading(true);
    setError('');
    setInfo('');

    try {
      // Supabase password reset kullanarak PIN sıfırlama linki gönder
      // type=pin_reset parametresi ile ayırt edeceğiz
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: getResetRedirectURL() + '?pin_reset=true',
      });

      if (resetError) {
        throw resetError;
      }

      setInfo('PIN sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen kontrol edin.');
      setPinResetCooldown(60);

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    } catch (err) {
      console.error('PIN sıfırlama hatası:', err);

      // Supabase rate limiting hatası kontrolü
      // "For security purposes, you can only request this after X seconds."
      const rateLimitMatch = err.message?.match(/after (\d+) seconds/i);
      if (rateLimitMatch) {
        const seconds = parseInt(rateLimitMatch[1], 10);
        setPinResetCooldown(seconds);
        setError(`Güvenlik nedeniyle ${seconds} saniye beklemeniz gerekmektedir.`);
      } else {
        setError(err.message || 'PIN sıfırlama e-postası gönderilemedi.');
      }

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      }
    } finally {
      setPinResetLoading(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },
        card: { width: '100%', gap: 20, paddingVertical: 20 },
        title: { fontSize: 24, fontWeight: '700', color: theme.colors.text, letterSpacing: 0.3 },
        subtitle: { fontSize: 15, color: theme.colors.textSecondary },
        helperText: { color: theme.colors.muted, fontSize: 12 },
        checkboxRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
        checkboxRowActive: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceElevated,
        },
        checkbox: {
          width: 20,
          height: 20,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: theme.colors.primary,
          backgroundColor: 'transparent',
        },
        checkboxChecked: { backgroundColor: theme.colors.primary },
        checkboxLabel: { color: theme.colors.textSecondary, fontWeight: '500' },
        primaryButton: {
          height: 48,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        primaryButtonText: { fontWeight: '700', color: theme.colors.background },
        biometricButton: { backgroundColor: theme.colors.success },
        errorText: { color: theme.colors.danger, fontSize: 13 },
        infoText: { color: theme.colors.info, fontSize: 13 },
        brandWrap: { alignItems: 'center', gap: 6, paddingBottom: 4 },
        glassHeader: {
          borderRadius: 28,
          overflow: 'hidden',
          padding: 12,
          width: '100%',
          alignItems: 'center',
          backgroundColor: Platform.OS === 'android' ? theme.colors.surfaceElevated + 'AA' : 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: theme.colors.border + '55',
        },
        brandText: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
        avatar: {
          width: 68,
          height: 68,
          borderRadius: 34,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary + '22',
        },
        avatarImage: {
          width: '100%',
          height: '100%',
          borderRadius: 34,
        },
        avatarText: { fontSize: 20, fontWeight: '700', color: theme.colors.primary },
        welcome: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 2, letterSpacing: 0.5 },
        displayName: { fontSize: 18, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
        changeUser: { color: theme.colors.primary, textAlign: 'center', textDecorationLine: 'underline', fontSize: 12 },
        pinField: {
          height: 64,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          gap: 8,
        },
        pinInput: { flex: 1, color: theme.colors.text, fontSize: 18 },
        forgotLink: { color: theme.colors.primary, fontWeight: '600' },
        pinLabel: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
        forgotWrap: { alignSelf: 'flex-end', paddingVertical: 8 },
        pinFieldFocused: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceElevated,
        },
        actionPillsRow: { flexDirection: 'row', gap: 10, marginTop: 0, flexWrap: 'wrap' },
        pillButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        pillDisabled: { opacity: 0.5 },
        pillText: { color: theme.colors.text, fontWeight: '600', fontSize: 13 },
        emailChipsScroll: { marginTop: 4 },
        emailChip: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        emailChipText: { color: theme.colors.textSecondary, fontSize: 13 },
        signupGrid: { flexDirection: 'row', gap: 16 },
        signupCol: { flex: 1, gap: 8 },
        // Progress indicator
        progressContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
        },
        progressContainerAbsolute: {
          position: 'absolute',
          top: 16,
          right: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          zIndex: 10,
        },
        progressDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.colors.border,
        },
        progressDotActive: {
          width: 24,
          backgroundColor: theme.colors.primary,
        },
        progressDotCompleted: {
          backgroundColor: theme.colors.success,
        },
        // Back button
        backButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          alignSelf: 'flex-start',
          marginBottom: 8,
        },
        backButtonText: {
          color: theme.colors.primary,
          fontSize: 15,
          fontWeight: '600',
        },
        // Avatar picker
        avatarPickerContainer: {
          alignItems: 'center',
          paddingVertical: 16,
        },
        avatarPicker: {
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 3,
          borderColor: theme.colors.border,
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarPickerSelected: {
          borderStyle: 'solid',
          borderColor: theme.colors.primary,
        },
        avatarPickerImage: {
          width: '100%',
          height: '100%',
        },
        avatarPickerPlaceholder: {
          alignItems: 'center',
          gap: 6,
        },
        avatarPickerLabel: {
          fontSize: 13,
          color: theme.colors.textSecondary,
          marginTop: 8,
          textAlign: 'center',
        },
        // Greeting styles
        greetingText: {
          fontSize: 24,
          fontWeight: '600',
          textAlign: 'center',
          color: theme.colors.text,
          letterSpacing: 0.8,
          marginBottom: 2,
          lineHeight: 32,
        },
        switchAccountButton: {
          paddingVertical: 6,
          paddingHorizontal: 12,
          marginTop: 4,
          alignSelf: 'center',
        },
        switchAccountText: {
          color: theme.colors.textSecondary,
          fontSize: 13,
          textAlign: 'center',
          fontWeight: '500',
        },
      }),
    [theme],
  );

  // Adım göstergesi component
  const ProgressIndicator = ({ currentStep, totalSteps, absolute = false }) => {
    return (
      <View style={absolute ? styles.progressContainerAbsolute : styles.progressContainer}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          return (
            <View
              key={i}
              style={[
                styles.progressDot,
                isActive && styles.progressDotActive,
                isCompleted && styles.progressDotCompleted,
              ]}
            />
          );
        })}
      </View>
    );
  };

  // Geri buton handler
  const handleBackStep = () => {
    if (hapticsEnabled) {
      Haptics.selectionAsync().catch(() => undefined);
    }
    setError('');
    if (mode === 'signUp') {
      if (signUpStep === 2) {
        setSignUpStep(1);
      } else if (signUpStep === 3) {
        setSignUpStep(2);
        setPassword('');
        setPasswordConfirm('');
      }
    }
  };

  // Avatar seçme
  const handlePickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Galeriye erişim izni gerekli');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatarUrl(result.assets[0].uri);
        if (hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
      }
    } catch (err) {
      console.warn('Avatar seçme hatası:', err);
      setError('Fotoğraf seçilirken bir hata oluştu');
    }
  };

  // Hesap değiştirme
  const handleSwitchAccount = async () => {
    console.log('Hesap değiştir butonuna tıklandı');

    if (hapticsEnabled) {
      Haptics.selectionAsync().catch(() => undefined);
    }

    try {
      const result = await confirm({
        title: 'Hesap Değiştir',
        message: 'Farklı bir hesapla giriş yapmak istiyor musunuz?',
        confirmText: 'Evet',
        cancelText: 'Hayır',
      });

      console.log('Confirm sonucu:', result);

      if (result) {
        // Oturumu temizle
        await supabase.auth.signOut();
        // State'leri sıfırla
        setEmail('');
        setFirstName('');
        setPassword('');
        setPasswordConfirm('');
        setAvatarUrl(null);
        setSignStep('email');
        setError('');
        setInfo('');

        if (hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
      }
    } catch (err) {
      console.warn('Çıkış hatası:', err);
      setError('Çıkış yapılırken bir hata oluştu');
    }
  };

  return (
    <Screen padded style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 20 }}
          showsVerticalScrollIndicator={false}
          enableOnAndroid={true}
          keyboardDismissMode="interactive"
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View entering={FadeIn.duration(220)} style={{ width: '100%', maxWidth: 360 }}>
              <RNAnimated.View style={{ transform: [{ translateY: keyboardOffset }] }}>
                <Card
                  style={styles.card}
                  onLayout={(e) => {
                    cardYRef.current = e.nativeEvent.layout.y;
                    cardHeightRef.current = e.nativeEvent.layout.height;
                  }}
                >
                  {/* PIN ile hızlı giriş ekranı */}
                  {signStep === 'enterPin' ? (
                    <>
                      {initialLoading ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                          <ActivityIndicator size="large" color={theme.colors.primary} />
                        </View>
                      ) : (
                        <>
                          <RNAnimated.View style={[styles.glassHeader, headerAnimatedStyle]}>
                            {Platform.OS !== 'android' && (
                              <BlurView
                                pointerEvents="none"
                                tint={theme.colors.surface === '#ffffff' ? 'light' : 'dark'}
                                intensity={40}
                                style={StyleSheet.absoluteFill}
                              />
                            )}
                            <RNAnimated.View style={{ alignItems: 'center', gap: 8, transform: [{ scale: avatarScale }] }}>
                              <RNAnimated.View style={[
                                styles.avatar,
                                {
                                  width: 90,
                                  height: 90,
                                  borderRadius: 45,
                                  borderWidth: 3,
                                  borderColor: theme.colors.surface,
                                  shadowColor: theme.colors.primary,
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.2,
                                  shadowRadius: 12,
                                  elevation: 8,
                                }
                              ]}>
                                {avatarUrl ? (
                                  <>
                                    <Image
                                      source={{ uri: avatarUrl }}
                                      style={[styles.avatarImage, { borderRadius: 42 }]}
                                      onLoadStart={() => setAvatarLoading(true)}
                                      onLoadEnd={() => setAvatarLoading(false)}
                                      onError={() => setAvatarUrl(null)}
                                    />
                                    {avatarLoading && <ActivityIndicator style={{ position: 'absolute' }} />}
                                  </>
                                ) : (
                                  <View style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: 42,
                                    backgroundColor: theme.colors.primary + '20',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}>
                                    <MaterialCommunityIcons
                                      name="account"
                                      size={48}
                                      color={theme.colors.primary}
                                    />
                                  </View>
                                )}
                              </RNAnimated.View>
                              <RNAnimated.View style={{
                                opacity: displayOpacity,
                                paddingHorizontal: 20,
                                height: displayOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }),
                                overflow: 'hidden',
                              }}>
                                <Text style={styles.greetingText}>
                                  {getTimeBasedGreeting()}
                                </Text>
                                <TouchableOpacity
                                  onPress={handleSwitchAccount}
                                  style={styles.switchAccountButton}
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                  <Text style={styles.switchAccountText}>
                                    {firstName.trim()
                                      ? `Yoksa ${firstName.trim()} değil misin?`
                                      : 'Farklı hesap ile giriş yap'}
                                  </Text>
                                </TouchableOpacity>
                              </RNAnimated.View>
                            </RNAnimated.View>
                          </RNAnimated.View>

                          {/* Biyometrik aktif ve PIN fallback değilse */}
                          {biometricEnabled && biometricSession && !showPinFallback ? (
                            <View style={{ alignItems: 'center', gap: 20, paddingVertical: 16 }}>
                              <TouchableOpacity
                                onPress={handleBiometricLogin}
                                activeOpacity={0.7}
                                style={{
                                  width: 80,
                                  height: 80,
                                  borderRadius: 40,
                                  backgroundColor: theme.colors.primary + '15',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <MaterialCommunityIcons
                                  name="fingerprint"
                                  size={48}
                                  color={theme.colors.primary}
                                />
                              </TouchableOpacity>
                              {biometricFailCount > 0 && biometricFailCount < 3 ? (
                                <Text style={{ fontSize: 13, color: theme.colors.warning || '#F59E0B', textAlign: 'center' }}>
                                  {biometricFailCount}/3 başarısız deneme
                                </Text>
                              ) : null}
                            </View>
                          ) : (
                            /* PIN girişi */
                            <>
                              <View style={{ alignItems: 'center', paddingTop: 4 }}>
                                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', fontWeight: '500', letterSpacing: 0.2 }}>
                                  PIN kodunuzu giriniz
                                </Text>
                              </View>
                              <RNAnimated.View
                                style={{
                                  transform: [
                                    {
                                      translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }),
                                    },
                                  ],
                                  gap: 14,
                                  alignItems: 'center',
                                }}
                              >
                                {renderPinBoxes()}
                                <TextInput
                                  ref={hiddenPinInputRef}
                                  value={pin}
                                  onChangeText={handlePinChange}
                                  keyboardType="number-pad"
                                  secureTextEntry={true}
                                  autoFocus
                                  style={{ position: 'absolute', opacity: 0.01, height: 50, width: 300, top: 0, left: 0 }}
                                  caretHidden
                                  importantForAutofill="no"
                                  contextMenuHidden
                                />
                                <View style={{ alignSelf: 'stretch', minHeight: 0 }}>
                                  {lockUntil ? (
                                    <View style={{
                                      backgroundColor: theme.colors.danger + '15',
                                      borderRadius: 10,
                                      paddingVertical: 10,
                                      paddingHorizontal: 16,
                                      alignItems: 'center'
                                    }}>
                                      <Text style={{ color: theme.colors.danger, fontWeight: '700', fontSize: 14 }}>
                                        🔒 Giriş kilitlendi: {lockRemaining} saniye
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                              </RNAnimated.View>
                              <TouchableOpacity
                                style={{ alignSelf: 'center', paddingVertical: 12 }}
                                onPress={() => {
                                  setShowPinFallback(true);
                                  setSignStep('password');
                                  setPin('');
                                }}
                              >
                                <Text style={{ fontSize: 14, color: theme.colors.primary, fontWeight: '600' }}>
                                  Parola ile giriş yap
                                </Text>
                              </TouchableOpacity>
                              {/* PIN Sıfırlama Butonu */}
                              <TouchableOpacity
                                style={{ alignSelf: 'center', paddingVertical: 8 }}
                                onPress={handleForgotPin}
                                disabled={pinResetLoading || pinResetCooldown > 0}
                              >
                                {pinResetLoading ? (
                                  <ActivityIndicator size="small" color={theme.colors.muted} />
                                ) : (
                                  <Text style={{
                                    fontSize: 13,
                                    color: pinResetCooldown > 0 ? theme.colors.muted : theme.colors.textSecondary,
                                    fontWeight: '500'
                                  }}>
                                    {pinResetCooldown > 0
                                      ? `PIN sıfırlama (${pinResetCooldown}s)`
                                      : 'PIN kodumu unuttum'}
                                  </Text>
                                )}
                              </TouchableOpacity>
                              {/* Biyometrik aktifse geri dönüş butonu */}
                              {biometricEnabled && biometricSession && showPinFallback ? (
                                <TouchableOpacity
                                  onPress={() => {
                                    setShowPinFallback(false);
                                    setBiometricFailCount(0);
                                    setError('');
                                  }}
                                  style={{ alignSelf: 'center', paddingVertical: 8 }}
                                >
                                  <Text style={{ fontSize: 14, color: theme.colors.primary, fontWeight: '600' }}>
                                    Parmak izi ile giriş yap
                                  </Text>
                                </TouchableOpacity>
                              ) : null}
                            </>
                          )}

                          {error ? <Text style={styles.errorText}>{error}</Text> : null}
                          {info ? <Text style={styles.infoText}>{info}</Text> : null}

                          {/* Biyometrik aktifse parmak izi butonu, değilse PIN girişi otomatik */}
                          {biometricEnabled && biometricSession && !showPinFallback ? (
                            <>
                              <Button
                                title="Parmak İzi ile Giriş Yap"
                                onPress={handleBiometricLogin}
                                loading={biometricLoading}
                              />
                              <TouchableOpacity
                                style={{ alignSelf: 'center', paddingVertical: 12 }}
                                onPress={() => {
                                  setShowPinFallback(true);
                                  setError('');
                                }}
                              >
                                <Text style={{ fontSize: 14, color: theme.colors.primary, fontWeight: '600' }}>
                                  PIN ile giriş yap
                                </Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <Button
                              title="Giriş Yap"
                              onPress={handlePinLogin}
                              loading={loading}
                              disabled={pin.length !== 6}
                            />
                          )}

                          <Button
                            title="Hesabınız yok mu? Kayıt olun"
                            onPress={toggleMode}
                            variant="ghost"
                          />
                        </>
                      )}
                    </>
                  ) : signStep === 'createPin' ? (
                    /* Modern PIN oluşturma ekranı */
                    <>
                      {/* Header with gradient icon */}
                      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 24 }}>
                        <View style={{
                          width: 88,
                          height: 88,
                          borderRadius: 44,
                          backgroundColor: theme.colors.primary + '12',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 20,
                          shadowColor: theme.colors.primary,
                          shadowOffset: { width: 0, height: 8 },
                          shadowOpacity: 0.15,
                          shadowRadius: 16,
                          elevation: 8,
                        }}>
                          <View style={{
                            width: 72,
                            height: 72,
                            borderRadius: 36,
                            backgroundColor: theme.colors.primary + '20',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <MaterialCommunityIcons name="shield-lock" size={36} color={theme.colors.primary} />
                          </View>
                        </View>
                        <Text style={[styles.title, { marginBottom: 8 }]}>Güvenlik PIN'i Oluştur</Text>
                        <Text style={{
                          fontSize: 14,
                          color: theme.colors.textSecondary,
                          textAlign: 'center',
                          lineHeight: 20,
                          paddingHorizontal: 20,
                        }}>
                          Hızlı ve güvenli giriş için{'\n'}6 haneli PIN kodunuzu belirleyin
                        </Text>
                      </View>

                      {/* PIN Input Section */}
                      <View style={{ gap: 24 }}>
                        {/* PIN Kodu */}
                        <View style={{ alignItems: 'center' }}>
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: pin.length === 6 ? theme.colors.success + '15' : theme.colors.surface,
                          }}>
                            <MaterialCommunityIcons
                              name={pin.length === 6 ? "check-circle" : "numeric"}
                              size={16}
                              color={pin.length === 6 ? theme.colors.success : theme.colors.textSecondary}
                            />
                            <Text style={{
                              fontSize: 13,
                              fontWeight: '600',
                              color: pin.length === 6 ? theme.colors.success : theme.colors.textSecondary,
                            }}>
                              PIN Kodu
                            </Text>
                          </View>
                          <RNAnimated.View
                            style={{
                              transform: [
                                {
                                  translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }),
                                },
                              ],
                              alignItems: 'center',
                            }}
                          >
                            <Pressable
                              android_disableSound
                              onPress={() => hiddenPinInputRef.current?.focus()}
                              style={{ paddingVertical: 4, paddingHorizontal: 8 }}
                            >
                              <View style={{ flexDirection: 'row', gap: 10 }}>
                                {Array.from({ length: 6 }, (_, i) => {
                                  const filled = i < pin.length;
                                  const isActive = pin.length === i;
                                  return (
                                    <View
                                      key={i}
                                      style={{
                                        width: 44,
                                        height: 54,
                                        borderRadius: 14,
                                        borderWidth: 2,
                                        borderColor: filled ? theme.colors.primary : isActive ? theme.colors.primary + '60' : theme.colors.border,
                                        backgroundColor: filled ? theme.colors.primary + '10' : theme.colors.surfaceElevated,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        shadowColor: isActive ? theme.colors.primary : 'transparent',
                                        shadowOpacity: isActive ? 0.25 : 0,
                                        shadowRadius: isActive ? 8 : 0,
                                        shadowOffset: { width: 0, height: 2 },
                                        elevation: isActive ? 4 : 0,
                                      }}
                                    >
                                      {filled && (
                                        <View style={{
                                          width: 14,
                                          height: 14,
                                          borderRadius: 7,
                                          backgroundColor: theme.colors.primary,
                                        }} />
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                            </Pressable>
                            <TextInput
                              ref={hiddenPinInputRef}
                              value={pin}
                              onChangeText={handlePinChange}
                              keyboardType="number-pad"
                              secureTextEntry={true}
                              autoFocus
                              style={{ position: 'absolute', opacity: 0.01, height: 50, width: 300, top: 0, left: 0 }}
                              caretHidden
                              importantForAutofill="no"
                              contextMenuHidden
                            />
                          </RNAnimated.View>
                        </View>

                        {/* Divider */}
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 20,
                        }}>
                          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
                          <MaterialCommunityIcons
                            name="arrow-down"
                            size={18}
                            color={theme.colors.muted}
                            style={{ marginHorizontal: 12 }}
                          />
                          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
                        </View>

                        {/* PIN Tekrar */}
                        <View style={{ alignItems: 'center' }}>
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: pinConfirm.length === 6 && pin === pinConfirm
                              ? theme.colors.success + '15'
                              : pinConfirm.length === 6 && pin !== pinConfirm
                                ? theme.colors.danger + '15'
                                : theme.colors.surface,
                          }}>
                            <MaterialCommunityIcons
                              name={
                                pinConfirm.length === 6 && pin === pinConfirm
                                  ? "check-circle"
                                  : pinConfirm.length === 6 && pin !== pinConfirm
                                    ? "close-circle"
                                    : "refresh"
                              }
                              size={16}
                              color={
                                pinConfirm.length === 6 && pin === pinConfirm
                                  ? theme.colors.success
                                  : pinConfirm.length === 6 && pin !== pinConfirm
                                    ? theme.colors.danger
                                    : theme.colors.textSecondary
                              }
                            />
                            <Text style={{
                              fontSize: 13,
                              fontWeight: '600',
                              color: pinConfirm.length === 6 && pin === pinConfirm
                                ? theme.colors.success
                                : pinConfirm.length === 6 && pin !== pinConfirm
                                  ? theme.colors.danger
                                  : theme.colors.textSecondary,
                            }}>
                              PIN Tekrar
                            </Text>
                          </View>
                          <Pressable
                            android_disableSound
                            onPress={() => {
                              // Focus to confirm input - we need a ref for this
                            }}
                            style={{ paddingVertical: 4, paddingHorizontal: 8 }}
                          >
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                              {Array.from({ length: 6 }, (_, i) => {
                                const filled = i < pinConfirm.length;
                                const isActive = pinConfirm.length === i && pin.length === 6;
                                const isMatch = pinConfirm.length === 6 && pin === pinConfirm;
                                const isMismatch = pinConfirm.length === 6 && pin !== pinConfirm;
                                return (
                                  <View
                                    key={i}
                                    style={{
                                      width: 44,
                                      height: 54,
                                      borderRadius: 14,
                                      borderWidth: 2,
                                      borderColor: isMismatch
                                        ? theme.colors.danger
                                        : isMatch
                                          ? theme.colors.success
                                          : filled
                                            ? theme.colors.primary
                                            : isActive
                                              ? theme.colors.primary + '60'
                                              : theme.colors.border,
                                      backgroundColor: isMismatch
                                        ? theme.colors.danger + '08'
                                        : isMatch
                                          ? theme.colors.success + '10'
                                          : filled
                                            ? theme.colors.primary + '10'
                                            : theme.colors.surfaceElevated,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {filled && (
                                      <View style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: 7,
                                        backgroundColor: isMismatch
                                          ? theme.colors.danger
                                          : isMatch
                                            ? theme.colors.success
                                            : theme.colors.primary,
                                      }} />
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          </Pressable>
                          <TextInput
                            value={pinConfirm}
                            onChangeText={(v) => setPinConfirm(v.replace(/\D/g, '').slice(0, 6))}
                            keyboardType="number-pad"
                            secureTextEntry={true}
                            style={{ position: 'absolute', opacity: 0.01, height: 50, width: 300, top: 50, left: 0 }}
                            caretHidden
                          />
                        </View>
                      </View>

                      {/* Status Messages */}
                      <View style={{ minHeight: 24, marginTop: 16 }}>
                        {error ? (
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            backgroundColor: theme.colors.danger + '12',
                          }}>
                            <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.danger} />
                            <Text style={{ fontSize: 13, color: theme.colors.danger, fontWeight: '500' }}>{error}</Text>
                          </View>
                        ) : info ? (
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            backgroundColor: theme.colors.info + '12',
                          }}>
                            <MaterialCommunityIcons name="information" size={16} color={theme.colors.info} />
                            <Text style={{ fontSize: 13, color: theme.colors.info, fontWeight: '500' }}>{info}</Text>
                          </View>
                        ) : pin.length === 6 && pinConfirm.length === 6 && pin === pinConfirm ? (
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: 12,
                            backgroundColor: theme.colors.success + '12',
                          }}>
                            <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.success} />
                            <Text style={{ fontSize: 13, color: theme.colors.success, fontWeight: '500' }}>PIN'ler eşleşiyor</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Action Button */}
                      <View style={{ marginTop: 8 }}>
                        <TouchableOpacity
                          onPress={handleCreatePin}
                          disabled={loading || pin.length !== 6 || pinConfirm.length !== 6 || pin !== pinConfirm}
                          activeOpacity={0.8}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            paddingVertical: 16,
                            paddingHorizontal: 24,
                            borderRadius: 16,
                            backgroundColor: pin.length === 6 && pinConfirm.length === 6 && pin === pinConfirm
                              ? theme.colors.primary
                              : theme.colors.border,
                            shadowColor: theme.colors.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: pin.length === 6 && pinConfirm.length === 6 && pin === pinConfirm ? 0.3 : 0,
                            shadowRadius: 12,
                            elevation: pin.length === 6 && pinConfirm.length === 6 && pin === pinConfirm ? 6 : 0,
                          }}
                        >
                          {loading ? (
                            <ActivityIndicator size="small" color={theme.colors.background} />
                          ) : (
                            <>
                              <MaterialCommunityIcons
                                name="shield-check"
                                size={22}
                                color={pin.length === 6 && pinConfirm.length === 6 && pin === pinConfirm
                                  ? theme.colors.background
                                  : theme.colors.muted
                                }
                              />
                              <Text style={{
                                fontSize: 16,
                                fontWeight: '700',
                                color: pin.length === 6 && pinConfirm.length === 6 && pin === pinConfirm
                                  ? theme.colors.background
                                  : theme.colors.muted,
                              }}>
                                PIN Oluştur ve Giriş Yap
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Security Info */}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginTop: 16,
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        backgroundColor: theme.colors.surface,
                      }}>
                        <MaterialCommunityIcons name="lock-outline" size={14} color={theme.colors.muted} />
                        <Text style={{ fontSize: 12, color: theme.colors.muted, textAlign: 'center' }}>
                          PIN'iniz güvenli şekilde şifrelenerek saklanır
                        </Text>
                      </View>
                    </>
                  ) : mode === 'signIn' && signStep === 'password' ? (
                    <>
                      {/* Biometric durumu yüklenene kadar loading göster */}
                      {initialLoading ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                          <ActivityIndicator size="large" color={theme.colors.primary} />
                        </View>
                      ) : (
                        <>
                          <RNAnimated.View style={[styles.glassHeader, headerAnimatedStyle]}>
                            {Platform.OS !== 'android' && (
                              <BlurView
                                pointerEvents="none"
                                tint={theme.colors.surface === '#ffffff' ? 'light' : 'dark'}
                                intensity={40}
                                style={StyleSheet.absoluteFill}
                              />
                            )}
                            {/* Koyu overlay */}
                            <RNAnimated.View pointerEvents="none" style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              opacity: overlayOpacity,
                              backgroundColor: Platform.OS === 'ios' ? 'rgba(15,15,20,0.45)' : 'rgba(10,10,15,0.6)'
                            }} />
                            {/* Alttan gradient */}
                            <RNAnimated.View pointerEvents="none" style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: 0,
                              height: 90,
                              opacity: overlayOpacity,
                            }}>
                              <LinearGradient
                                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.45)']}
                                style={{ flex: 1 }}
                                pointerEvents="none"
                              />
                            </RNAnimated.View>
                            <RNAnimated.View style={{ alignItems: 'center', gap: 8, transform: [{ scale: avatarScale }] }}>
                              <RNAnimated.View style={[
                                styles.avatar,
                                {
                                  width: 90,
                                  height: 90,
                                  borderRadius: 45,
                                  borderWidth: 3,
                                  borderColor: theme.colors.surface,
                                  shadowColor: theme.colors.primary,
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.2,
                                  shadowRadius: 12,
                                  elevation: 8,
                                }
                              ]}>
                                {avatarUrl ? (
                                  <>
                                    <Image
                                      source={{ uri: avatarUrl }}
                                      style={[styles.avatarImage, { borderRadius: 42 }]}
                                      onLoadStart={() => setAvatarLoading(true)}
                                      onLoadEnd={() => setAvatarLoading(false)}
                                      onError={() => setAvatarUrl(null)}
                                    />
                                    {avatarLoading && <ActivityIndicator style={{ position: 'absolute' }} />}
                                  </>
                                ) : (
                                  <View style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: 42,
                                    backgroundColor: theme.colors.primary + '20',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}>
                                    <MaterialCommunityIcons
                                      name="account"
                                      size={48}
                                      color={theme.colors.primary}
                                    />
                                  </View>
                                )}
                              </RNAnimated.View>
                              <RNAnimated.View style={{
                                opacity: displayOpacity,
                                paddingHorizontal: 20,
                                height: displayOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }),
                                overflow: 'hidden',
                              }}>
                                <Text style={styles.greetingText}>
                                  {getTimeBasedGreeting()}
                                </Text>
                                <TouchableOpacity
                                  onPress={handleSwitchAccount}
                                  style={styles.switchAccountButton}
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                  <Text style={styles.switchAccountText}>
                                    {firstName.trim()
                                      ? `Yoksa ${firstName.trim()} değil misin?`
                                      : 'Farklı hesap ile giriş yap'}
                                  </Text>
                                </TouchableOpacity>
                              </RNAnimated.View>
                            </RNAnimated.View>
                          </RNAnimated.View>

                          {/* Biyometrik pill butonu kaldırıldı - otomatik parmak izi sorgusu kullanılıyor */}

                          {!verificationMode ? (
                            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 14 }}>

                              {/* Biyometrik aktif ve fallback değilse - Parola gizli, sadece Giriş Yap butonu */}
                              {biometricEnabled && biometricSession && !showPasswordFallback ? (
                                <View style={{ alignItems: 'center', gap: 16, paddingVertical: 8 }}>
                                  <Text style={{ fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center', fontWeight: '500' }}>
                                    Giriş yapmak için butona basın
                                  </Text>
                                  {biometricFailCount > 0 && biometricFailCount < 3 ? (
                                    <Text style={{ fontSize: 13, color: theme.colors.warning || '#F59E0B', textAlign: 'center' }}>
                                      {biometricFailCount}/3 başarısız deneme
                                    </Text>
                                  ) : null}
                                </View>
                              ) : (
                                /* Parola girişi - fallback veya biyometrik kapalı */
                                <>
                                  <View style={{ alignItems: 'center', paddingTop: 4 }}>
                                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', fontWeight: '500', letterSpacing: 0.2 }}>
                                      Parolanızı giriniz
                                    </Text>
                                  </View>
                                  <RNAnimated.View
                                    style={{
                                      transform: [
                                        {
                                          translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }),
                                        },
                                      ],
                                      gap: 14,
                                    }}
                                  >
                                    {renderPasswordField(false)}
                                    <View style={{ alignSelf: 'stretch', minHeight: 0 }}>
                                      {lockUntil ? (
                                        <View style={{
                                          backgroundColor: theme.colors.danger + '15',
                                          borderRadius: 10,
                                          paddingVertical: 10,
                                          paddingHorizontal: 16,
                                          alignItems: 'center'
                                        }}>
                                          <Text style={{ color: theme.colors.danger, fontWeight: '700', fontSize: 14 }}>
                                            🔒 Giriş kilitlendi: {lockRemaining} saniye
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  </RNAnimated.View>
                                  <TouchableOpacity
                                    style={[styles.forgotWrap, { alignSelf: 'center', paddingVertical: 12 }]}
                                    onPress={handleForgotPassword}
                                    disabled={forgotCooldown > 0}
                                  >
                                    <Text style={[styles.forgotLink, { fontSize: 14, fontWeight: '600' }, forgotCooldown > 0 && { opacity: 0.6 }]}>
                                      {forgotCooldown > 0 ? `⏱️ Tekrar deneyiniz: ${forgotCooldown}s` : 'Parolamı unuttum'}
                                    </Text>
                                  </TouchableOpacity>
                                  {/* Biyometrik aktifse geri dönüş butonu */}
                                  {biometricEnabled && biometricSession && showPasswordFallback ? (
                                    <TouchableOpacity
                                      onPress={() => {
                                        setShowPasswordFallback(false);
                                        setBiometricFailCount(0);
                                        setError('');
                                      }}
                                      style={{ alignSelf: 'center', paddingVertical: 8 }}
                                    >
                                      <Text style={{ fontSize: 14, color: theme.colors.primary, fontWeight: '600' }}>
                                        Parmak izi ile giriş yap
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </>
                              )}
                            </Animated.View>
                          ) : null}

                          {error ? <Text style={styles.errorText}>{error}</Text> : null}
                          {info ? <Text style={styles.infoText}>{info}</Text> : null}

                          {!verificationMode ? (
                            /* Biyometrik aktif ve fallback değilse - butona basınca parmak izi sor */
                            biometricEnabled && biometricSession && !showPasswordFallback ? (
                              <Button
                                title="Giriş Yap"
                                onPress={handleBiometricLogin}
                                loading={biometricLoading}
                              />
                            ) : (
                              <Button
                                title="Giriş Yap"
                                onPress={handleAuth}
                                loading={loading}
                                disabled={password.length < 6}
                              />
                            )
                          ) : (
                            <Button title="Kod ile doğrula" onPress={handleVerifyCode} loading={verificationLoading} />
                          )}

                          {verificationMode ? (
                            <Button
                              title={verifyCooldown > 0 ? `Yeniden gönder (${verifyCooldown}s)` : 'Kod gelmedi mi? Yeniden gönder'}
                              onPress={handleResendCode}
                              variant="ghost"
                              disabled={verifyCooldown > 0}
                            />
                          ) : (
                            <Button
                              title={mode === 'signIn' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
                              onPress={toggleMode}
                              variant="ghost"
                            />
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {mode === 'signIn' && signStep === 'email' ? (
                        <RNAnimated.View style={[styles.glassHeader, headerAnimatedStyle]}>
                          {Platform.OS !== 'android' && (
                            <BlurView
                              pointerEvents="none"
                              tint={theme.colors.surface === '#ffffff' ? 'light' : 'dark'}
                              intensity={40}
                              style={StyleSheet.absoluteFill}
                            />
                          )}
                          <RNAnimated.View pointerEvents="none" style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            opacity: overlayOpacity,
                            backgroundColor: Platform.OS === 'ios' ? 'rgba(15,15,20,0.45)' : 'rgba(10,10,15,0.6)'
                          }} />
                          <RNAnimated.View pointerEvents="none" style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 90,
                            opacity: overlayOpacity,
                          }}>
                            <LinearGradient
                              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.45)']}
                              style={{ flex: 1 }}
                              pointerEvents="none"
                            />
                          </RNAnimated.View>
                          <RNAnimated.View style={{ alignItems: 'center', gap: 12, transform: [{ scale: avatarScale }] }}>
                            <Image
                              source={require('../assets/icon.png')}
                              style={{ width: 72, height: 72, borderRadius: 20 }}
                              resizeMode="contain"
                            />
                            <RNAnimated.View style={{ opacity: displayOpacity }}>
                              <Text style={[styles.title, { fontSize: 28, fontWeight: '800', letterSpacing: 0.5 }]}>Keeper</Text>
                            </RNAnimated.View>
                          </RNAnimated.View>
                        </RNAnimated.View>
                      ) : (
                        <>
                          {/* Geri buton - SignUp için - Başlığın üstünde (PIN oluşturma adımında gösterme) */}
                          {mode === 'signUp' && signUpStep > 1 && signUpStep < 4 ? (
                            <TouchableOpacity
                              onPress={handleBackStep}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                alignSelf: 'flex-start',
                                paddingVertical: 8,
                                paddingHorizontal: 4,
                                marginBottom: 12,
                              }}
                            >
                              <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.primary} />
                              <Text style={{ color: theme.colors.primary, fontSize: 16, fontWeight: '600' }}>Geri</Text>
                            </TouchableOpacity>
                          ) : null}

                          {/* Progress indicator - SignUp için sağ üstte */}
                          {mode === 'signUp' && <ProgressIndicator currentStep={signUpStep} totalSteps={4} absolute={true} />}

                          {/* Logo ve başlık - signUpStep 2 ve 4 hariç göster */}
                          {!(mode === 'signUp' && (signUpStep === 2 || signUpStep === 4)) ? (
                            <View style={{ alignItems: 'center', gap: 8 }}>
                              <Image
                                source={require('../assets/icon.png')}
                                style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 4 }}
                                resizeMode="contain"
                              />
                              <Text style={styles.title}>Keeper</Text>
                            </View>
                          ) : null}

                          {/* Subtitle - signUpStep 2 ve 4 için gösterme */}
                          {!(mode === 'signUp' && (signUpStep === 2 || signUpStep === 4)) ? (
                            <Text style={styles.subtitle}>
                              {mode === 'signIn'
                                ? 'Hesabınıza güvenli erişim'
                                : (signUpStep === 1
                                  ? 'Kayıt için e-posta adresinizi giriniz'
                                  : 'Güvenli parolanızı oluşturun')}
                            </Text>
                          ) : null}
                        </>
                      )}

                      {mode === 'signIn' && biometricSupported && biometricEnrolled && biometricEnabled && !verificationMode ? (
                        <View style={styles.actionPillsRow}>
                          <TouchableOpacity
                            onPress={handleBiometricLogin}
                            disabled={biometricLoading}
                            style={[styles.pillButton, biometricLoading && styles.pillDisabled]}
                          >
                            {biometricLoading ? (
                              <ActivityIndicator size="small" />
                            ) : (
                              <MaterialCommunityIcons name="fingerprint" size={20} color={theme.colors.primary} />
                            )}
                            <Text style={styles.pillText}>Biyometrik Giriş</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      {/* SignIn - Email input */}
                      {mode === 'signIn' && signStep === 'email' ? (
                        <>
                          <Input
                            label="E-posta Adresi"
                            autoCapitalize="none"
                            autoComplete="email"
                            keyboardType="email-address"
                            autoCorrect={false}
                            placeholder="ornek@mail.com"
                            value={email}
                            onChangeText={(value) => {
                              setEmail(value);
                              setPassword('');
                            }}
                            autoFocus
                            helper="E-posta adresinizi giriniz"
                          />
                          {!!recentEmails.length ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emailChipsScroll} contentContainerStyle={{ gap: 8 }}>
                              {recentEmails.map((em) => (
                                <TouchableOpacity
                                  key={em}
                                  onPress={() => { setEmail(em); Haptics.selectionAsync(); }}
                                  style={styles.pillButton}
                                >
                                  <Text style={styles.pillText}>{em}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          ) : null}
                        </>
                      ) : null}

                      {/* SignUp - Adım 1: Email */}
                      {mode === 'signUp' && signUpStep === 1 ? (
                        <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 12 }}>
                          <Input
                            label="E-posta Adresi"
                            autoCapitalize="none"
                            autoComplete="email"
                            keyboardType="email-address"
                            autoCorrect={false}
                            placeholder="ornek@mail.com"
                            value={email}
                            onChangeText={(value) => {
                              setEmail(value);
                              setEmailValid(true);
                              setError('');
                            }}
                            autoFocus
                          />
                          {!emailValid ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
                              <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.danger} />
                              <Text style={{ color: theme.colors.danger, fontSize: 12 }}>Geçersiz e-posta formatı</Text>
                            </View>
                          ) : null}
                        </Animated.View>
                      ) : null}

                      {/* SignUp - Adım 2: Ad Soyad + Avatar */}
                      {mode === 'signUp' && signUpStep === 2 ? (
                        <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 20, marginTop: 8 }}>
                          <View style={styles.avatarPickerContainer}>
                            <TouchableOpacity
                              onPress={handlePickAvatar}
                              style={[styles.avatarPicker, avatarUrl && styles.avatarPickerSelected]}
                              activeOpacity={0.7}
                            >
                              {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={styles.avatarPickerImage} />
                              ) : (
                                <View style={styles.avatarPickerPlaceholder}>
                                  <MaterialCommunityIcons
                                    name="camera-plus"
                                    size={36}
                                    color={theme.colors.textSecondary}
                                  />
                                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>
                                    İsteğe bağlı
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                            {avatarUrl ? (
                              <Text style={styles.avatarPickerLabel}>Değiştirmek için tıklayın</Text>
                            ) : null}
                          </View>
                          <Input
                            label="Ad Soyad"
                            autoCapitalize="words"
                            placeholder="Ad Soyad"
                            value={firstName}
                            onChangeText={setFirstName}
                            autoFocus
                          />
                        </Animated.View>
                      ) : null}

                      {/* SignUp - Adım 3: Parola */}
                      {mode === 'signUp' && signUpStep === 3 ? (
                        <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 18 }}>
                          <View style={{ alignItems: 'center', paddingTop: 4 }}>
                            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', fontWeight: '500', letterSpacing: 0.2 }}>
                              Parola Oluşturun
                            </Text>
                          </View>
                          <RNAnimated.View
                            style={{
                              transform: [
                                {
                                  translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }),
                                },
                              ],
                              gap: 14,
                            }}
                          >
                            {renderPasswordField(true)}
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center' }}>
                              Parolanız en az 6 karakter olmalıdır
                            </Text>
                          </RNAnimated.View>
                        </Animated.View>
                      ) : null}

                      {/* SignUp - Adım 4: PIN Oluşturma */}
                      {mode === 'signUp' && signUpStep === 4 ? (
                        <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 18 }}>
                          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                            <MaterialCommunityIcons name="shield-lock-outline" size={48} color={theme.colors.primary} />
                            <Text style={styles.title}>PIN Oluştur</Text>
                            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' }}>
                              Hızlı giriş için 6 haneli PIN belirleyin
                            </Text>
                          </View>

                          <View style={{ gap: 16 }}>
                            <View style={{ alignItems: 'center' }}>
                              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>PIN Kodu</Text>
                              <RNAnimated.View
                                style={{
                                  transform: [
                                    {
                                      translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }),
                                    },
                                  ],
                                  alignItems: 'center',
                                }}
                              >
                                {renderPinBoxes()}
                                <TextInput
                                  ref={hiddenPinInputRef}
                                  value={pin}
                                  onChangeText={handlePinChange}
                                  keyboardType="number-pad"
                                  secureTextEntry={true}
                                  autoFocus
                                  style={{ position: 'absolute', opacity: 0.01, height: 50, width: 300, top: 0, left: 0 }}
                                  caretHidden
                                  importantForAutofill="no"
                                  contextMenuHidden
                                />
                              </RNAnimated.View>
                            </View>

                            <View style={{ alignItems: 'center' }}>
                              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>PIN Tekrar</Text>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                {Array.from({ length: 6 }, (_, i) => {
                                  const filled = i < pinConfirm.length;
                                  return (
                                    <View
                                      key={i}
                                      style={{
                                        width: 46,
                                        height: 56,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: filled ? theme.colors.primary : theme.colors.border,
                                        backgroundColor: theme.colors.surfaceElevated,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {filled && (
                                        <Text style={{ fontSize: 32, fontWeight: '700', color: theme.colors.text }}>●</Text>
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                              <TextInput
                                value={pinConfirm}
                                onChangeText={(v) => setPinConfirm(v.replace(/\D/g, '').slice(0, 6))}
                                keyboardType="number-pad"
                                secureTextEntry={true}
                                style={{ position: 'absolute', opacity: 0.01, height: 50, width: 300, top: 50, left: 0 }}
                                caretHidden
                              />
                            </View>
                          </View>
                        </Animated.View>
                      ) : null}

                      {/* Eski 'Beni hatırla' kutusu kaldırıldı */}

                      {error ? <Text style={styles.errorText}>{error}</Text> : null}
                      {info ? <Text style={styles.infoText}>{info}</Text> : null}

                      {!verificationMode ? (
                        <Button
                          title={
                            mode === 'signIn'
                              ? (signStep === 'email' ? 'Devam Et' : 'Giriş Yap')
                              : (signUpStep === 1
                                ? 'Devam Et'
                                : signUpStep === 2
                                  ? 'Devam Et'
                                  : signUpStep === 3
                                    ? 'Hesap Oluştur'
                                    : 'PIN Oluştur ve Giriş Yap')
                          }
                          onPress={handleAuth}
                          loading={loading}
                          disabled={
                            (mode === 'signUp' && signUpStep === 3 && password.length < 6) ||
                            (mode === 'signUp' && signUpStep === 4 && (pin.length !== 6 || pinConfirm.length !== 6))
                          }
                        />
                      ) : (
                        <Button title="Doğrulama Kodunu Onayla" onPress={handleVerifyCode} loading={verificationLoading} />
                      )}

                      {verificationMode ? (
                        <Button title="Kodu Tekrar Gönder" onPress={handleResendCode} variant="ghost" />
                      ) : (
                        <Button
                          title={mode === 'signIn' ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
                          onPress={toggleMode}
                          variant="ghost"
                        />
                      )}
                    </>
                  )}
                </Card>
              </RNAnimated.View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

export default AuthScreen;

