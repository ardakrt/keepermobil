import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Pressable, ActivityIndicator, Keyboard, TouchableWithoutFeedback, Animated } from 'react-native';
import { useAppTheme } from '../lib/theme';
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

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: '90%',
      maxWidth: 400,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: 8,
    },
    input: {
      width: '100%',
      height: 50,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      fontSize: 16,
      color: theme.colors.text,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 24,
      gap: 12,
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    cancelButton: {
      backgroundColor: theme.colors.surface,
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
    },
    buttonText: {
      fontWeight: 'bold',
      fontSize: 16,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.backdrop}>
          <Animated.View style={animatedStyle}>
            <Pressable onPress={() => {}}>
              <Card style={styles.modalCard}>
                <Text style={styles.title}>{title}</Text>
                <View>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={inputValue}
                    onChangeText={setInputValue}
                    autoFocus
                    secureTextEntry={secureTextEntry}
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>
                <View style={styles.buttonContainer}>
                  <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
                    <Text style={[styles.buttonText, { color: theme.colors.text }]}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={handleSubmit} disabled={loading}>
                    {loading ? (
                      <ActivityIndicator color={theme.colors.background} />
                    ) : (
                      <Text style={[styles.buttonText, { color: theme.colors.background }]}>{submitLabel}</Text>
                    )}
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
