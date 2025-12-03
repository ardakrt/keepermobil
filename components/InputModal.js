import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Pressable, ActivityIndicator, Keyboard, TouchableWithoutFeedback, Animated, Platform } from 'react-native';
import { useAppTheme } from '../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Card from './Card';

const InputModal = ({
  visible,
  onClose,
  onSubmit,
  title,
  label,
  initialValue = '',
  secureTextEntry = false,
  submitLabel = 'Kaydet',
}) => {
  const { theme } = useAppTheme();
  const [inputValue, setInputValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const keyboardDidShow = (e) => {
      Animated.timing(keyboardOffset, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }).start();
    };

    const keyboardDidHide = (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    };

    const showSubscription = Keyboard.addListener('keyboardDidShow', keyboardDidShow);
    const hideSubscription = Keyboard.addListener('keyboardDidHide', keyboardDidHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardOffset]);

  useEffect(() => {
    if (visible) {
      setInputValue(initialValue);
    }
  }, [visible, initialValue]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(inputValue);
    } finally {
      setLoading(false);
    }
  };

  const animatedStyle = {
    transform: [{ translateY: keyboardOffset }],
  };

  const getIconName = () => {
    if (title?.includes('İsim')) return 'account';
    if (title?.includes('E-posta')) return 'email';
    if (title?.includes('Şifre')) return 'lock';
    return 'pencil';
  };

  const getGradientColors = () => {
    if (title?.includes('İsim')) return [theme.colors.primary, theme.colors.primary + 'DD'];
    if (title?.includes('E-posta')) return ['#10b981', '#059669'];
    if (title?.includes('Şifre')) return ['#f59e0b', '#d97706'];
    return [theme.colors.primary, theme.colors.primary + 'DD'];
  };

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    blurBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalCard: {
      width: '90%',
      maxWidth: 400,
      paddingVertical: 28,
      paddingHorizontal: 24,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
      gap: 16,
    },
    iconGradient: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: 0.3,
    },
    subtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    inputContainer: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 10,
      letterSpacing: 0.2,
    },
    input: {
      width: '100%',
      height: 54,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: 2,
      paddingHorizontal: 16,
      fontSize: 16,
      color: theme.colors.text,
    },
    inputFocused: {
      borderColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    inputUnfocused: {
      borderColor: theme.colors.border + '80',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      height: 50,
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cancelButton: {
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontWeight: '700',
      fontSize: 16,
      letterSpacing: 0.3,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.backdrop}>
          {Platform.OS === 'ios' && (
            <BlurView
              tint={theme.colors.surface === '#ffffff' ? 'light' : 'dark'}
              intensity={50}
              style={styles.blurBackdrop}
            />
          )}
          <Animated.View style={animatedStyle}>
            <Pressable onPress={() => {}}>
              <Card style={styles.modalCard}>
                <View style={styles.headerContainer}>
                  <LinearGradient
                    colors={getGradientColors()}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconGradient}
                  >
                    <MaterialCommunityIcons name={getIconName()} size={28} color="#ffffff" />
                  </LinearGradient>
                  <View style={styles.titleContainer}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>Bilgilerinizi güncelleyin</Text>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={[
                      styles.input,
                      focused ? styles.inputFocused : styles.inputUnfocused
                    ]}
                    value={inputValue}
                    onChangeText={setInputValue}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    autoFocus
                    secureTextEntry={secureTextEntry}
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={onClose}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.buttonContent}>
                      <Text style={[styles.buttonText, { color: theme.colors.text }]}>İptal</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={getGradientColors()}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonContent}
                    >
                      {loading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={[styles.buttonText, { color: '#ffffff' }]}>{submitLabel}</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </Card>
            </Pressable>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default InputModal;
