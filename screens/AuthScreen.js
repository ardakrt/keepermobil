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
} from '../lib/storageKeys';
import { localAuth } from '../lib/localAuth';
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

const AuthScreen = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('signIn'); // signIn | signUp
  const [signStep, setSignStep] = useState('email'); // signIn: email | pin, signUp: email | details | pin
  const [signUpStep, setSignUpStep] = useState(1); // 1: email, 2: details, 3: pin

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
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
  const { theme } = useAppTheme();
  const [pinFocused, setPinFocused] = useState(false);
  const lockScale = useRef(new RNAnimated.Value(1)).current;
  const [recentEmails, setRecentEmails] = useState([]);
  // Shake animation for error feedback on PIN field
  const shakeAnim = useRef(new RNAnimated.Value(0)).current;
  const lastTriedPinRef = useRef(null);
  const keyboardOffset = useRef(new RNAnimated.Value(0)).current;
  const pinErrorRef = useRef(false);
  const successFlash = useRef(new RNAnimated.Value(0)).current;
  const errorFlash = useRef(new RNAnimated.Value(0)).current;
  const [failedCount, setFailedCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(null); // timestamp ms
  const [lockRemaining, setLockRemaining] = useState(0);
  const HANE_SAYISI = 6;
  const hiddenPinInputRef = useRef(null);
  const cardYRef = useRef(0);
  const cardHeightRef = useRef(0);
  const compressedHeader = useRef(new RNAnimated.Value(0)).current;
  const scrollViewRef = useRef(null);
  // Header artık tamamen kaybolmasın: 0 -> normal, 1 -> kısmen sıkışmış
  const headerAnimatedStyle = {
    height: compressedHeader.interpolate({ inputRange: [0,1], outputRange: [180, 110] }),
    overflow: 'hidden',
  };
  const avatarScale = compressedHeader.interpolate({ inputRange: [0,1], outputRange: [1, 0.85] });
  const displayOpacity = compressedHeader.interpolate({ inputRange: [0,1], outputRange: [1, 0] });
  // Header sıkıştığında arkaya koyu bir overlay + altta gradient ekle
  const overlayOpacity = compressedHeader.interpolate({ inputRange: [0, 0.0001, 1], outputRange: [0, 0, 0.65] });



  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const t = setInterval(() => setForgotCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [forgotCooldown]);

  useEffect(() => {
    if (verifyCooldown <= 0) return;
    const t = setInterval(() => setVerifyCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [verifyCooldown]);

  useEffect(() => {
    RNAnimated.spring(lockScale, {
      toValue: pinFocused ? 1.06 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [pinFocused]);

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
        const [storedEmail, storedRecent] = await Promise.all([
          AsyncStorage.getItem(REMEMBER_EMAIL_KEY),
          AsyncStorage.getItem(RECENT_EMAILS_KEY),
        ]);
        const emailVal = (storedEmail || '').trim();
        if (emailVal) {
          setEmail(emailVal);
          // Kullanıcı daha önce e-posta girmişse, doğrudan PIN adımı ile karşıla
          setSignStep('pin');

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
          try { setRecentEmails(JSON.parse(storedRecent) || []); } catch {}
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

  // PIN adımına geçildiğinde isim boşsa kayıt sırasında girilen isimden (cache/metadata) çekmeyi dene
  useEffect(() => {
    if (mode !== 'signIn' || signStep !== 'pin') return;
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
    onAuthSuccess?.(session ?? null);
    // recent emails list update
    try {
      const clean = email.trim().toLowerCase();
      if (clean) {
        const next = [clean, ...recentEmails.filter((e) => e !== clean)].slice(0, 3);
        setRecentEmails(next);
        await AsyncStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(next));
      }
    } catch {}
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

  const validatePin = () => {
    if (!/^\d{6}$/.test(pin)) {
      setError('PIN 6 haneli olmalıdır.');
      return false;
    }
    return true;
  };

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
          setPin('');
          setPinConfirm('');
          setError('');
          return;
        }

        // Adım 3: PIN oluşturma
        if (signUpStep === 3) {
          if (!validatePin()) {
            setError('PIN 6 haneli olmalıdır.');
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
            password: pin,
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

          await finalizeAuth(updatedSession);
          return;
        }
      }

      // SignIn akışı - 2 adımlı
      if (mode === 'signIn') {
        if (signStep === 'email') {
          setPin('');
          // Email adımından PIN adımına geçerken Supabase'den kullanıcı bilgilerini çek
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
          setSignStep('pin');
          return;
        }

        if (!validatePin()) {
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
          password: pin,
        });
        if (signInError) {
          setError('Şifre veya e-posta hatalı.');
          pinErrorRef.current = true;
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
        pinErrorRef.current = false;
        setFailedCount(0);
        errorFlash.setValue(0);
        successFlash.setValue(0);
        RNAnimated.sequence([
          RNAnimated.timing(successFlash, { toValue: 1, duration: 100, useNativeDriver: true }),
          RNAnimated.timing(successFlash, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();
        // Kullanıcı ismini ve resmini görebilsin diye biraz daha bekle
        setTimeout(() => { finalizeAuth(data.session); }, metaName || metaAvatar ? 800 : 120);
        return;
      }
    } catch (err) {
      setError(err.message ?? 'Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Otomatik giriş: PIN 6 haneye ulaştığında (signIn modunda ve pin adımında) otomatik dene
  useEffect(() => {
    if (mode === 'signIn' && signStep === 'pin' && /^\d{6}$/.test(pin) && !loading) {
      // Aynı PIN ile tekrar tekrar tetiklemeyi engelle
      if (lastTriedPinRef.current === pin) return;
      lastTriedPinRef.current = pin;
      handleAuth();
    }
  }, [pin, mode, signStep, loading]);



  // PIN değişince hata görselini temizle
  useEffect(() => {
    if (pinErrorRef.current && pin.length < 6) {
      pinErrorRef.current = false;
      if (error && error.startsWith('Şifre veya e-posta')) setError('');
    }
  }, [pin, error]);

  const focusHiddenPin = useCallback(() => {
    const input = hiddenPinInputRef.current;
    if (!input) return;
    let attempts = 0;
    const maxAttempts = 8;
    const tryFocus = () => {
      attempts++;
      input.focus?.();
      if (Platform.OS === 'android') {
        // Bazı cihazlarda frame değişimlerinde yeniden denemek gerekebilir
        if (attempts < maxAttempts) {
          requestAnimationFrame(() => {
            // isFocused() false ise tekrar dene
            if (!input.isFocused?.()) tryFocus();
          });
        }
      }
    };
    tryFocus();
  }, []);

  // Klavye görünürlük durumu izleme ve geç kalmışsa tekrar focus
  useEffect(() => {
    if (signStep !== 'pin') return;
    let shown = false;
    const show = Keyboard.addListener('keyboardDidShow', () => { shown = true; });
    const t1 = setTimeout(() => { if (!shown) focusHiddenPin(); }, 180);
    const t2 = setTimeout(() => { if (!shown) focusHiddenPin(); }, 400);
    const t3 = setTimeout(() => { if (!shown) focusHiddenPin(); }, 800);
    return () => { show.remove(); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [signStep, focusHiddenPin]);

  // Klavye açılmadıysa fallback: kısa süre izleyip kapalı kalırsa yeniden odakla
  useEffect(() => {
    if (signStep !== 'pin') return;
    let triggered = false;
    const showSub = Keyboard.addListener('keyboardDidShow', () => { triggered = true; });
    const fallback = setTimeout(() => {
      if (!triggered) focusHiddenPin();
    }, 250);
    return () => { showSub.remove(); clearTimeout(fallback); };
  }, [signStep, focusHiddenPin]);

  const handlePinChange = (value) => {
    if (lockUntil) return; // kilitliyken giriş alma
    const digits = value.replace(/\D/g, '').slice(0, HANE_SAYISI);
    setPin(digits);
  };

  const handleBoxPress = () => {
    // Odaklamayı daha güvenilir hale getirmek için kısa bir gecikme ekleyin
    setTimeout(() => {
      focusHiddenPin();
    }, 50); // 50ms gecikme

    // Ek bir güvenlik önlemi olarak, kısa bir süre sonra tekrar odaklanmayı deneyin
    setTimeout(() => {
      focusHiddenPin();
    }, 150); // 150ms'de ikinci deneme
  };

  const renderOtpBoxes = (isSignUp) => {
    const chars = pin.split('');
    const boxes = Array.from({ length: HANE_SAYISI }, (_, i) => {
      const filled = i < chars.length;
      const isActive = chars.length === i && !pinErrorRef.current;
      const hasError = pinErrorRef.current;
      
      // Basit stil mantığı
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
      
      const successBg = successFlash.interpolate({ 
        inputRange: [0, 1], 
        outputRange: [backgroundColor, theme.colors.success + '15'] 
      });
      
      const errorBgOpacity = errorFlash.interpolate({ 
        inputRange: [0, 1], 
        outputRange: [0, 1] 
      });
      
      return (
        <RNAnimated.View
          key={i}
          style={{
            width: 46,
            height: 56,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: borderColor,
            backgroundColor: successBg,
            alignItems: 'center',
            justifyContent: 'center',
            // Sadece aktif kutuya glow
            shadowColor: isActive ? theme.colors.primary : 'transparent',
            shadowOpacity: isActive ? 0.3 : 0,
            shadowRadius: isActive ? 6 : 0,
            shadowOffset: { width: 0, height: 2 },
            elevation: isActive ? 4 : 0,
          }}
        >
          {/* Hata overlay */}
          <RNAnimated.View 
            pointerEvents="none" 
            style={{ 
              position: 'absolute', 
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: theme.colors.danger, 
              opacity: errorBgOpacity, 
              borderRadius: 10 
            }} 
          />
          {/* Nokta sadece doluysa göster */}
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
        onPress={handleBoxPress}
        style={{ alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 8 }}
        accessibilityLabel={isSignUp ? 'PIN gir' : 'Şifre gir'}
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
      setInfo('Hesabınız başarıyla doğrulandı.');

      await finalizeAuth(data.session);
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
    setPin('');
    setPinConfirm('');
    setError('');
    setInfo('');
    setVerificationMode(false);
    setVerificationCode('');
    setEmailValid(true);
  };

  const validateEmail = (emailStr) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const handleBiometricLogin = async () => {
    if (!biometricSession || !localAuth.hasFullSupport()) {
      setError('Parmak izi için kayıtlı oturum bulunamadı.');
      return;
    }

    setBiometricLoading(true);
    setError('');

    try {
      const auth = await localAuth.authenticateAsync({
        promptMessage: 'Parmak izi doğrulaması',
        cancelLabel: 'Vazgeç',
      });

      if (!auth.success) {
        setError('Parmak izi doğrulaması iptal edildi. Tekrar deneyebilirsiniz.');
        return;
      }

      const { data, error: sessionError } = await supabase.auth.setSession(biometricSession);
      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      await biometricPrefs.setStoredSession(data.session);
      onAuthSuccess?.(data.session ?? null);
    } catch (err) {
      setError(err.message ?? 'Parmak izi ile giriş tamamlanamadı.');
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
      setInfo('E-posta adresinize PIN sıfırlama bağlantısı gönderildi. Lütfen kontrol ediniz.');
      if (typeof setForgotCooldown === 'function') setForgotCooldown(60);
    } catch (err) {
      setError(err.message ?? 'Parola sıfırlama başlatılamadı.');
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
        setPin('');
        setPinConfirm('');
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
        setPin('');
        setPinConfirm('');
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
          {/* Gizli PIN input: ekrandan çıkarılmadı, OTP kutularına yakın daha güvenilir odak için later render içinde de bir kopya olacak (tek kopya burada değil) */}
          <Card
            style={styles.card}
            onLayout={(e) => {
              cardYRef.current = e.nativeEvent.layout.y;
              cardHeightRef.current = e.nativeEvent.layout.height;
            }}
          >
          {mode === 'signIn' && signStep === 'pin' ? (
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
                        {avatarLoading && <ActivityIndicator style={{position: 'absolute'}}/>}
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

              <View style={styles.actionPillsRow}>
                {biometricSupported && biometricEnrolled && biometricEnabled && !verificationMode ? (
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
                ) : null}
              </View>

              {!verificationMode ? (
                <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 14 }}>
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
                  {renderOtpBoxes(false)}
                  <TextInput
                    ref={hiddenPinInputRef}
                    value={pin}
                    onChangeText={handlePinChange}
                    keyboardType="number-pad"
                    secureTextEntry={true}
                    showSoftInputOnFocus
                    style={{ position: 'absolute', opacity: 0.03, height: 50, width: 300, top: 0, left: 0 }}
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
                  {/* Gizli input yukarı taşındı */}
                </RNAnimated.View>
                <TouchableOpacity 
                  style={[styles.forgotWrap, { alignSelf: 'center', paddingVertical: 12 }]} 
                  onPress={handleForgotPassword} 
                  disabled={forgotCooldown > 0}
                >
                  <Text style={[styles.forgotLink, { fontSize: 14, fontWeight: '600' }, forgotCooldown > 0 && { opacity: 0.6 }]}>
                    {forgotCooldown > 0 ? `⏱️ Tekrar deneyiniz: ${forgotCooldown}s` : 'PIN kodumu unuttum'}
                  </Text>
                </TouchableOpacity>
                {/* "Beni hatırla" kaldırıldı; yalnızca e-posta otomatik saklanıyor */}
                </Animated.View>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {info ? <Text style={styles.infoText}>{info}</Text> : null}

              {!verificationMode ? (
                <Button
                  title="Giriş Yap"
                  onPress={handleAuth}
                  loading={loading}
                  disabled={!/^\d{6}$/.test(pin)}
                />
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
                  {/* Geri buton - SignUp için - Başlığın üstünde */}
                  {mode === 'signUp' && signUpStep > 1 ? (
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
                  {mode === 'signUp' && <ProgressIndicator currentStep={signUpStep} totalSteps={3} absolute={true} />}

                  {/* Logo ve başlık - signUpStep 2 hariç göster */}
                  {!(mode === 'signUp' && signUpStep === 2) ? (
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <Image
                        source={require('../assets/icon.png')}
                        style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 4 }}
                        resizeMode="contain"
                      />
                      <Text style={styles.title}>Keeper</Text>
                    </View>
                  ) : null}

                  {/* Subtitle - signUpStep 2 için gösterme */}
                  {!(mode === 'signUp' && signUpStep === 2) ? (
                    <Text style={styles.subtitle}>
                      {mode === 'signIn'
                        ? 'Hesabınıza güvenli erişim'
                        : (signUpStep === 1
                            ? 'Kayıt için e-posta adresinizi giriniz'
                            : '6 Haneli güvenli PIN kodunuzu oluşturun')}
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
                      setPin('');
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

              {/* SignUp - Adım 3: PIN + PIN Confirm */}
              {mode === 'signUp' && signUpStep === 3 ? (
                <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 18 }}>
                  <View style={{ alignItems: 'center', paddingTop: 4 }}>
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', fontWeight: '500', letterSpacing: 0.2 }}>
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
                      gap: 14,
                      alignItems: 'center',
                    }}
                  >
                    {renderOtpBoxes(true)}
                    <TextInput
                      ref={hiddenPinInputRef}
                      value={pin}
                      onChangeText={handlePinChange}
                      keyboardType="number-pad"
                      secureTextEntry={true}
                      showSoftInputOnFocus
                      autoFocus
                      style={{ position: 'absolute', opacity: 0.03, height: 50, width: 300, top: 0, left: 0 }}
                      caretHidden
                      importantForAutofill="no"
                      contextMenuHidden
                    />
                  </RNAnimated.View>
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
                          : 'Hesap Oluştur')
                  }
                  onPress={handleAuth}
                  loading={loading}
                  disabled={
                    mode === 'signUp' && signUpStep === 3 && pin.length !== 6
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

