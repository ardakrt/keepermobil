import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';

const { width } = Dimensions.get('window');

export default function DeleteConfirmModal({
  visible,
  title = 'Silinsin mi?',
  message,
  confirmText = 'Sil',
  cancelText = 'Vazgeç',
  onConfirm,
  onCancel,
}) {
  const { theme } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  
  // Interaction lock to prevent accidental touches immediately after opening
  const [isInteractive, setIsInteractive] = useState(false);
  const [showModal, setShowModal] = useState(visible);

  // Animation values
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      // Reset values for entry animation
      scale.value = 0.9;
      opacity.value = 0;
      
      // Animate in
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });

      // Enable interaction after a safe delay (400ms)
      // This prevents the "ghost touch" from the long-press release
      const timer = setTimeout(() => setIsInteractive(true), 400);
      return () => clearTimeout(timer);
    } else {
      setIsInteractive(false);
      // Animate out
      scale.value = withTiming(0.9, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 }, (finished) => {
        if (finished) {
          runOnJS(setShowModal)(false);
        }
      });
    }
  }, [visible]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleConfirm = async () => {
    if (!isInteractive) return;
    if (hapticsEnabled) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onConfirm?.();
  };

  const handleCancel = async () => {
    if (!isInteractive) return;
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onCancel?.();
  };

  if (!showModal) return null;

  // Dynamic styles based on theme
  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent', // Handled by animated view
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
      width: width - 60,
      maxWidth: 340,
      borderRadius: 28,
      backgroundColor: theme.colors.surface,
      padding: 0,
      elevation: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      overflow: 'hidden',
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 24,
      alignItems: 'center',
    },
    iconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.danger + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    titleText: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    messageText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    footer: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.colors.border + '40',
    },
    button: {
      flex: 1,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    separator: {
      width: 1,
      height: '100%',
      backgroundColor: theme.colors.border + '40',
    },
    cancelText: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    confirmText: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.danger,
    },
    pressed: {
      backgroundColor: theme.colors.text + '05', // Subtle highlight
    },
  });

  return (
    <Modal
      transparent
      visible={showModal}
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Animated Backdrop */}
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />

        {/* Animated Modal Content */}
        <Animated.View 
          style={[styles.modalContainer, animatedContainerStyle]}
          // CRITICAL: Blocks touch events until interactive
          pointerEvents={isInteractive ? 'auto' : 'none'} 
        >
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Ionicons name="trash" size={28} color={theme.colors.danger} />
            </View>
            <Text style={styles.titleText}>{title}</Text>
            {message && <Text style={styles.messageText}>{message}</Text>}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              android_ripple={{ color: theme.colors.text + '10' }}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>
            
            <View style={styles.separator} />

            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              android_ripple={{ color: theme.colors.danger + '10' }}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
