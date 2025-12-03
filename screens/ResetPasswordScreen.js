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
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../lib/toast';
import { usePrefs } from '../lib/prefs';

const ResetPasswordScreen = ({ route, navigation }) => {
  const { token, email } = route?.params || {};
  const { theme } = useAppTheme();
  const { showToast } = useToast();
  const { hapticsEnabled } = usePrefs();
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const inputRefs = useRef([]);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // İlk input'a otomatik focus
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
  }, []);

  const handlePinChange = (value, index) => {
    // Sadece rakam kabul et
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    // Otomatik ileri git
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Son hane girildiyinde otomatik submit
    if (index === 5 && value) {
      Keyboard.dismiss();
      setTimeout(() => {
        handleReset(newPin.join(''));
      }, 100);
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
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

  const handleReset = async (pinValue) => {
    const pinCode = pinValue || pin.join('');

    if (pinCode.length !== 6) {
      setError('Lütfen 6 haneli PIN kodunu girin');
      shakeError();
      return;
    }

    if (!/^\d{6}$/.test(pinCode)) {
      setError('PIN sadece rakamlardan oluşmalıdır');
      shakeError();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: pinCode
      });

      if (updateError) {
        setError(updateError.message);
        shakeError();
        setPin(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Başarılı
      showSuccessAnimation();
      showToast('Başarılı', 'PIN kodunuz güncellendi!');

      // 1.5 saniye bekle, sonra yönlendir
      setTimeout(async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const hasSession = !!sessionData?.session;

          if (navigation.canGoBack()) {
            navigation.goBack();
          } else if (hasSession) {
            navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
          } else {
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
          }
        } catch (_) {
          navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        }
      }, 1500);

    } catch (err) {
      setError(err.message ?? 'PIN güncellenemedi');
      shakeError();
      setPin(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
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
        pinContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 12,
          marginBottom: 32,
        },
        pinBox: {
          width: 52,
          height: 64,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pinBoxFocused: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary + '10',
        },
        pinBoxFilled: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary + '15',
        },
        pinText: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
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
            <MaterialCommunityIcons name="lock-reset" size={40} color="#ffffff" />
          </LinearGradient>

          <Text style={styles.title}>Yeni PIN Belirle</Text>
          <Text style={styles.subtitle}>
            Güvenliğiniz için 6 haneli yeni bir{'\n'}PIN kodu oluşturun
          </Text>
        </View>

        {/* PIN Input */}
        <Animated.View
          style={[
            styles.pinContainer,
            { transform: [{ translateX: shakeAnimation }] },
          ]}
        >
          {pin.map((digit, index) => (
            <View
              key={index}
              style={[
                styles.pinBox,
                digit && styles.pinBoxFilled,
                inputRefs.current[index]?.isFocused?.() && styles.pinBoxFocused,
              ]}
            >
              <TextInput
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.pinText}
                value={digit}
                onChangeText={(value) => handlePinChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                secureTextEntry
                selectTextOnFocus
                onFocus={() => {
                  if (hapticsEnabled) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
              />
            </View>
          ))}
        </Animated.View>

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
            (loading || pin.join('').length !== 6) && styles.submitButtonDisabled,
          ]}
          onPress={() => handleReset()}
          disabled={loading || pin.join('').length !== 6}
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
                <Text style={styles.submitButtonText}>PIN'i Güncelle</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="shield-lock" size={20} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            Bu PIN kodu uygulamaya giriş yapmak için kullanılacaktır. Güvenli bir yer de saklayın.
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
              PIN kodunuz güncellendi.{'\n'}Yönlendiriliyorsunuz...
            </Text>
          </Animated.View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default ResetPasswordScreen;
