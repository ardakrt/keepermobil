import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Pressable,
  Keyboard,
  Dimensions,
  DeviceEventEmitter,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { useAppTheme } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../lib/toast';
import { usePrefs } from '../lib/prefs';
import { savePin } from '../lib/pinService';
import { PIN_SESSION_KEY } from '../lib/storageKeys';

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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ResetPasswordScreen = ({ route, navigation }) => {
  const { token, email, pinReset } = route?.params || {};
  const { theme } = useAppTheme();
  const { showToast } = useToast();
  const { hapticsEnabled } = usePrefs();
  const insets = useSafeAreaInsets();

  // PIN sıfırlama modu - hem boolean hem string kontrolü
  const isPinResetMode = pinReset === true || pinReset === 'true';

  console.log('ResetPasswordScreen params:', { token: !!token, email, pinReset, isPinResetMode });

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // PIN states - iki aşamalı
  const [pinStep, setPinStep] = useState(1); // 1: ilk PIN, 2: onay PIN
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');

  const passwordInputRef = useRef(null);
  const confirmInputRef = useRef(null);
  const pinInputRef = useRef(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const dotAnimations = useRef([...Array(6)].map(() => new Animated.Value(1))).current;

  // Klavye otomatik aç
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isPinResetMode) {
        pinInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isPinResetMode]);

  // PIN değiştiğinde animasyon
  useEffect(() => {
    const currentPin = pinStep === 1 ? pin : pinConfirm;
    const lastIndex = currentPin.length - 1;
    
    if (lastIndex >= 0 && lastIndex < 6) {
      // Dot pop animasyonu
      dotAnimations[lastIndex].setValue(1);
      Animated.sequence([
        Animated.timing(dotAnimations[lastIndex], {
          toValue: 1.3,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnimations[lastIndex], {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start();

      if (hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  }, [pin, pinConfirm, pinStep]);

  // PIN 6 hane olduğunda otomatik geçiş
  useEffect(() => {
    if (pinStep === 1 && pin.length === 6) {
      // İlk PIN tamamlandı, onay adımına geç
      setTimeout(() => {
        Animated.timing(slideAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setPinStep(2);
          // Animasyonları sıfırla
          dotAnimations.forEach(anim => anim.setValue(0));
          // Klavyeyi açık tut
          setTimeout(() => pinInputRef.current?.focus(), 100);
        });
      }, 200);
    } else if (pinStep === 2 && pinConfirm.length === 6) {
      // Onay PIN tamamlandı, kontrol et
      setTimeout(() => {
        if (pin === pinConfirm) {
          handlePinReset();
        } else {
          setPinError('PIN kodları eşleşmiyor');
          shakeError();
          // Onay PIN'i sıfırla
          setPinConfirm('');
          dotAnimations.forEach(anim => anim.setValue(0));
          pinInputRef.current?.focus();
        }
      }, 200);
    }
  }, [pin.length, pinConfirm.length, pinStep]);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 15, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -15, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 15, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -15, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

    if (hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const showSuccessAnimation = () => {
    setShowSuccess(true);
    Animated.spring(successScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    if (hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // PIN geri al
  const handlePinBackspace = () => {
    if (pinStep === 1) {
      if (pin.length > 0) {
        setPin(prev => prev.slice(0, -1));
        dotAnimations[pin.length - 1]?.setValue(0);
      }
    } else {
      if (pinConfirm.length > 0) {
        setPinConfirm(prev => prev.slice(0, -1));
        dotAnimations[pinConfirm.length - 1]?.setValue(0);
      } else {
        // Onay boşsa, geri dön
        handlePinStepBack();
      }
    }
    setPinError('');
  };

  // Önceki adıma dön
  const handlePinStepBack = () => {
    Animated.timing(slideAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setPinStep(1);
      setPinConfirm('');
      setPinError('');
      dotAnimations.forEach(anim => anim.setValue(0));
      // PIN doluysa animasyonları ayarla
      for (let i = 0; i < pin.length; i++) {
        dotAnimations[i].setValue(1);
      }
      setTimeout(() => pinInputRef.current?.focus(), 100);
    });
  };

  // PIN sıfırlama
  const handlePinReset = async () => {
    if (pin.length !== 6) {
      setPinError('PIN 6 haneli olmalıdır');
      shakeError();
      return;
    }

    if (pin !== pinConfirm) {
      setPinError('PIN kodları eşleşmiyor');
      shakeError();
      return;
    }

    setLoading(true);
    setPinError('');
    Keyboard.dismiss();

    try {
      const result = await savePin(pin);

      if (!result.success) {
        setPinError(result.error || 'PIN kaydedilemedi');
        shakeError();
        setPinConfirm('');
        dotAnimations.forEach(anim => anim.setValue(0));
        pinInputRef.current?.focus();
        return;
      }

      showSuccessAnimation();
      showToast('Başarılı', 'PIN kodunuz güncellendi!');

      // App.js'i haberdar et ki Main ekranını mount etsin
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        // 1. Session'ı PIN session olarak kaydet (AuthScreen'in beklentisi)
        try {
          const minified = minifySession(sessionData.session);
          await SecureStore.setItemAsync(PIN_SESSION_KEY, JSON.stringify(minified));
        } catch (err) {
          console.warn('Failed to save PIN session during reset:', err);
        }
        
        // 2. App.js'i haberdar et
        DeviceEventEmitter.emit('auth_success', sessionData.session);
      }

      setTimeout(async () => {
        try {
          const hasSession = !!sessionData?.session;

          // CommonActions ile root navigator'a reset gönder
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: hasSession ? 'Main' : 'Auth' }],
            })
          );
        } catch (_) {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            })
          );
        }
      }, 1500);

    } catch (err) {
      setPinError(err.message ?? 'PIN güncellenemedi');
      shakeError();
      setPinConfirm('');
      dotAnimations.forEach(anim => anim.setValue(0));
      pinInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (password.length < 6) {
      setError('Parola en az 6 karakter olmalıdır');
      shakeError();
      return;
    }

    if (password !== passwordConfirm) {
      setError('Parolalar eşleşmiyor');
      shakeError();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setError(updateError.message);
        shakeError();
        setPassword('');
        setPasswordConfirm('');
        passwordInputRef.current?.focus();
        return;
      }

      // Başarılı
      showSuccessAnimation();
      showToast('Başarılı', 'Parolanız güncellendi!');

      // App.js'i haberdar et
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        DeviceEventEmitter.emit('auth_success', sessionData.session);
      }

      // 1.5 saniye bekle, sonra yönlendir
      setTimeout(async () => {
        try {
          const hasSession = !!sessionData?.session;

          // CommonActions ile root navigator'a reset gönder
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: hasSession ? 'Main' : 'Auth' }],
            })
          );
        } catch (_) {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            })
          );
        }
      }, 1500);

    } catch (err) {
      setError(err.message ?? 'Parola güncellenemedi');
      shakeError();
      setPassword('');
      setPasswordConfirm('');
      passwordInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.colors.background,
        },
        scrollContainer: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 40,
        },
        header: {
          alignItems: 'center',
          marginBottom: 48,
        },
        iconContainer: {
          width: 80,
          height: 80,
          borderRadius: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        },
        title: {
          fontSize: 28,
          fontWeight: '800',
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: 8,
          letterSpacing: 0.3,
        },
        subtitle: {
          fontSize: 15,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          lineHeight: 22,
        },
        inputContainer: {
          marginBottom: 16,
        },
        inputLabel: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: 8,
        },
        inputWrapper: {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 2,
          borderRadius: 12,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: 16,
          height: 56,
        },
        inputWrapperFocused: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceElevated,
        },
        input: {
          flex: 1,
          fontSize: 16,
          color: theme.colors.text,
          marginLeft: 12,
        },
        errorContainer: {
          backgroundColor: theme.colors.danger + '15',
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        errorText: {
          flex: 1,
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.danger,
        },
        submitButton: {
          borderRadius: 14,
          overflow: 'hidden',
          marginTop: 16,
        },
        submitButtonInner: {
          paddingVertical: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 10,
        },
        submitButtonText: {
          fontSize: 17,
          fontWeight: '700',
          color: '#ffffff',
          letterSpacing: 0.3,
        },
        submitButtonDisabled: {
          opacity: 0.5,
        },
        infoBox: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.primary + '10',
          borderRadius: 12,
          padding: 16,
          marginTop: 32,
          gap: 12,
        },
        infoText: {
          flex: 1,
          fontSize: 13,
          color: theme.colors.textSecondary,
          lineHeight: 18,
        },
        successOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
        },
        successContent: {
          alignItems: 'center',
          gap: 20,
        },
        successIcon: {
          width: 100,
          height: 100,
          borderRadius: 50,
          alignItems: 'center',
          justifyContent: 'center',
        },
        successTitle: {
          fontSize: 26,
          fontWeight: '800',
          color: '#ffffff',
          textAlign: 'center',
        },
        successMessage: {
          fontSize: 16,
          color: 'rgba(255, 255, 255, 0.8)',
          textAlign: 'center',
        },
      }),
    [theme]
  );

  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  // Gelişmiş PIN kutuları render
  const renderPinDots = () => {
    const currentPin = pinStep === 1 ? pin : pinConfirm;
    const BOX_SIZE = 46;
    const GAP = 10;
    
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: GAP }}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const filled = i < currentPin.length;
          const isNext = i === currentPin.length;
          const scaleValue = dotAnimations[i];
          
          return (
            <Animated.View
              key={i}
              style={{
                width: BOX_SIZE,
                height: BOX_SIZE + 8,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: filled 
                  ? theme.colors.primary 
                  : isNext 
                    ? theme.colors.primary 
                    : theme.colors.border,
                backgroundColor: filled 
                  ? theme.colors.primary + '15' 
                  : theme.colors.surfaceElevated,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ 
                  scale: scaleValue.interpolate({
                    inputRange: [0, 1, 1.3],
                    outputRange: [1, 1, 1.15],
                    extrapolate: 'clamp',
                  })
                }],
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
            </Animated.View>
          );
        })}
      </View>
    );
  };

  // PIN değişiklik handler
  const handlePinChange = (value) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 6);
    if (pinStep === 1) {
      setPin(cleanValue);
    } else {
      setPinConfirm(cleanValue);
    }
    setPinError('');
  };

  // Klavyeyi aç
  const openKeyboard = () => {
    pinInputRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primary + 'DD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <MaterialCommunityIcons 
              name={isPinResetMode ? "shield-lock" : "lock-reset"} 
              size={40} 
              color="#ffffff" 
            />
          </LinearGradient>

          <Text style={styles.title}>
            {isPinResetMode ? 'Yeni PIN Belirle' : 'Yeni Parola Belirle'}
          </Text>
          <Text style={styles.subtitle}>
            {isPinResetMode 
              ? 'Güvenliğiniz için yeni bir\n6 haneli PIN oluşturun'
              : 'Güvenliğiniz için yeni bir\nparola oluşturun'
            }
          </Text>
        </View>

        {isPinResetMode ? (
          /* PIN Sıfırlama UI - Modern Tasarım */
          <Animated.View
            style={[
              { transform: [{ translateX: shakeAnimation }] },
            ]}
          >
            {/* Gizli TextInput - Klavye için */}
            <TextInput
              ref={pinInputRef}
              value={pinStep === 1 ? pin : pinConfirm}
              onChangeText={handlePinChange}
              keyboardType="number-pad"
              style={{ 
                position: 'absolute', 
                opacity: 0, 
                height: 0, 
                width: 0,
              }}
              autoFocus
              caretHidden
              maxLength={6}
            />

            {/* Adım Göstergesi */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'center', 
              gap: 8, 
              marginBottom: 24 
            }}>
              <View style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.primary,
              }} />
              <View style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: pinStep === 2 ? theme.colors.primary : theme.colors.border,
              }} />
            </View>

            {/* Adım Başlığı */}
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.colors.text,
              textAlign: 'center',
              marginBottom: 8,
            }}>
              {pinStep === 1 ? 'Yeni PIN Oluşturun' : 'PIN\'i Onaylayın'}
            </Text>
            <Text style={{
              fontSize: 14,
              color: theme.colors.textSecondary,
              textAlign: 'center',
              marginBottom: 28,
            }}>
              {pinStep === 1 
                ? '6 haneli güvenlik kodunuzu girin' 
                : 'PIN kodunuzu tekrar girin'}
            </Text>

            {/* PIN Kutucukları - Tıklanabilir Alan */}
            <TouchableOpacity 
              onPress={openKeyboard}
              activeOpacity={0.8}
              style={{ 
                paddingVertical: 16,
                paddingHorizontal: 12,
              }}
            >
              {renderPinDots()}
            </TouchableOpacity>

            {/* Hata Mesajı */}
            {pinError ? (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 16,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 10,
                backgroundColor: theme.colors.danger + '15',
                alignSelf: 'center',
              }}>
                <MaterialCommunityIcons 
                  name="alert-circle" 
                  size={18} 
                  color={theme.colors.danger} 
                />
                <Text style={{ 
                  fontSize: 13, 
                  fontWeight: '600',
                  color: theme.colors.danger,
                }}>
                  {pinError}
                </Text>
              </View>
            ) : null}

            {/* Geri Butonu (2. adımda) */}
            {pinStep === 2 && (
              <TouchableOpacity
                onPress={handlePinStepBack}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginTop: 20,
                  paddingVertical: 10,
                }}
              >
                <MaterialCommunityIcons 
                  name="chevron-left" 
                  size={20} 
                  color={theme.colors.primary} 
                />
                <Text style={{ 
                  fontSize: 14, 
                  color: theme.colors.primary,
                  fontWeight: '600',
                }}>
                  PIN'i değiştir
                </Text>
              </TouchableOpacity>
            )}

            {/* Yükleniyor Göstergesi */}
            {loading && (
              <View style={{
                position: 'absolute',
                top: -20,
                left: -24,
                right: -24,
                bottom: -20,
                backgroundColor: theme.colors.background + 'F0',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 20,
              }}>
                <View style={{
                  padding: 24,
                  borderRadius: 16,
                  backgroundColor: theme.colors.surface,
                  alignItems: 'center',
                  gap: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
                }}>
                  <MaterialCommunityIcons 
                    name="shield-check" 
                    size={36} 
                    color={theme.colors.primary} 
                  />
                  <Text style={{ 
                    fontSize: 15, 
                    color: theme.colors.text,
                    fontWeight: '600',
                  }}>
                    PIN kaydediliyor...
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>
        ) : (
          /* Parola Sıfırlama UI */
          <Animated.View
            style={[
              { transform: [{ translateX: shakeAnimation }] },
            ]}
          >
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Yeni Parola</Text>
              <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
                <MaterialCommunityIcons 
                  name="lock-outline" 
                  size={22} 
                  color={passwordFocused ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <TextInput
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  placeholder="Yeni parolanızı girin"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmInputRef.current?.focus()}
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
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Parolayı Onayla</Text>
              <View style={[styles.inputWrapper, confirmFocused && styles.inputWrapperFocused]}>
                <MaterialCommunityIcons 
                  name="lock-check-outline" 
                  size={22} 
                  color={confirmFocused ? theme.colors.primary : theme.colors.textSecondary} 
                />
                <TextInput
                  ref={confirmInputRef}
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  secureTextEntry={!showPasswordConfirm}
                  placeholder="Parolanızı tekrar girin"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                />
                <TouchableOpacity 
                  onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons 
                    name={showPasswordConfirm ? 'eye-off-outline' : 'eye-outline'} 
                    size={22} 
                    color={theme.colors.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Error Message */}
        {error ? (
          <Animated.View style={styles.errorContainer}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={theme.colors.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (loading || (isPinResetMode ? pin.length !== 6 || pinConfirm.length !== 6 : password.length < 6)) && styles.submitButtonDisabled,
          ]}
          onPress={isPinResetMode ? handlePinReset : handleReset}
          disabled={loading || (isPinResetMode ? pin.length !== 6 || pinConfirm.length !== 6 : password.length < 6)}
          activeOpacity={0.8}
          onPressIn={() => {
            if (hapticsEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primary + 'DD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitButtonInner}
          >
            {loading ? (
              <>
                <MaterialCommunityIcons name="loading" size={24} color="#ffffff" />
                <Text style={styles.submitButtonText}>Güncelleniyor...</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle" size={24} color="#ffffff" />
                <Text style={styles.submitButtonText}>
                  {isPinResetMode ? 'PIN\'i Güncelle' : 'Parolayı Güncelle'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="shield-lock" size={20} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            {isPinResetMode
              ? 'Bu PIN kodu uygulamaya hızlı giriş yapmak için kullanılacaktır.'
              : 'Bu parola uygulamaya giriş yapmak için kullanılacaktır. Güvenli bir yerde saklayın.'
            }
          </Text>
        </View>
      </ScrollView>

      {/* Success Overlay */}
      {showSuccess && (
        <View style={styles.successOverlay}>
          <Animated.View
            style={[
              styles.successContent,
              { transform: [{ scale: successScale }] },
            ]}
          >
            <LinearGradient
              colors={['#22c55e', '#16a34a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.successIcon}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={60}
                color="#ffffff"
              />
            </LinearGradient>
            <Text style={styles.successTitle}>Başarılı!</Text>
            <Text style={styles.successMessage}>
              {isPinResetMode ? 'PIN kodunuz güncellendi.' : 'Parolanız güncellendi.'}
              {'\n'}Yönlendiriliyorsunuz...
            </Text>
          </Animated.View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default ResetPasswordScreen;
