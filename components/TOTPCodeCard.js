import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { generateTOTP, getRemainingSeconds } from '../lib/totp';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { Swipeable } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function TOTPCodeCard({
  serviceName,
  accountName,
  secret,
  algorithm = 'SHA1',
  digits = 6,
  period = 30,
  onDelete,
}) {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(30);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const swipeableRef = React.useRef(null);

  useEffect(() => {
    if (!secret) return;

    const updateCode = () => {
      const newCode = generateTOTP(secret, { algorithm, digits, period });
      setCode(newCode);
    };

    const updateCountdown = () => {
      const rem = getRemainingSeconds(period);
      setRemaining(rem);
    };

    updateCode();
    updateCountdown();

    const interval = setInterval(() => {
      updateCountdown();
      if (getRemainingSeconds(period) === period) {
        updateCode();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [secret, algorithm, digits, period]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    if (hapticsEnabled) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // Close swipeable after copy
    if (swipeableRef.current) {
      swipeableRef.current.close();
    }
  };

  const handleDelete = () => {
    if (hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteModal(false);
    if (swipeableRef.current) {
      swipeableRef.current.close();
    }
    onDelete && onDelete();
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    if (swipeableRef.current) {
      swipeableRef.current.close();
    }
  };

  const renderRightActions = (progress, dragX) => {
    return (
      <View
        style={{
          backgroundColor: theme.colors.success,
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
        }}
      >
        <Ionicons name="copy-outline" size={24} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
          Kopyala
        </Text>
      </View>
    );
  };

  const renderLeftActions = (progress, dragX) => {
    return (
      <View
        style={{
          backgroundColor: theme.colors.danger,
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
        }}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '600' }}>
          Sil
        </Text>
      </View>
    );
  };

  const handleSwipeRight = () => {
    // Sağa kaydırma - Kopyala (onaysız)
    handleCopy();
  };

  const handleSwipeLeft = () => {
    // Sola kaydırma - Sil (onaylı)
    handleDelete();
  };

  // Format code for display (e.g., "123 456")
  const formattedCode = code.match(/.{1,3}/g)?.join(' ') || code;

  // Progress color
  const getProgressColor = () => {
    if (remaining <= 5) return theme.colors.danger;
    if (remaining <= 10) return theme.colors.warning;
    return theme.colors.success;
  };

  // Calculate progress percentage
  const progressPercentage = (remaining / period) * 100;

  const dynamicStyles = StyleSheet.create({
    cardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: accent && theme.colors.surfaceTinted
        ? theme.colors.surfaceTinted
        : theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: accent && theme.colors.borderTinted
        ? theme.colors.borderTinted
        : theme.colors.border,
      gap: 16,
    },
    timerIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: getProgressColor() + '15',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: getProgressColor() + '30',
    },
    timerIconText: {
      fontSize: 16,
      fontWeight: '700',
      color: getProgressColor(),
    },
    cardInfo: {
      flex: 1,
    },
    serviceName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 6,
      letterSpacing: 0.3,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    code: {
      fontSize: 24,
      color: theme.colors.text,
      fontFamily: 'monospace',
      fontWeight: '800',
      letterSpacing: 3,
    },
    remainingText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    chevron: {
      marginLeft: 8,
    },
  });

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
        onSwipeableOpen={(direction) => {
          if (direction === 'right') {
            handleSwipeRight();
          } else if (direction === 'left') {
            handleSwipeLeft();
          }
        }}
        friction={2}
        overshootRight={false}
        overshootLeft={false}
      >
        <View style={dynamicStyles.cardContainer}>
          <BlurView
            intensity={theme.dark ? 20 : 80}
            tint={theme.dark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />

          <View style={dynamicStyles.glassOverlay} />

          <LinearGradient
            colors={
              theme.dark
                ? ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0)']
                : ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={dynamicStyles.gradientBorder}
          />

          <TouchableOpacity
            style={dynamicStyles.cardItem}
            onLongPress={async () => {
              await Clipboard.setStringAsync(code);
              if (hapticsEnabled) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            }}
            delayLongPress={500}
            activeOpacity={0.8}
          >
            {/* Timer Icon with Progress */}
            <View style={dynamicStyles.timerIcon}>
              <Text style={dynamicStyles.timerIconText}>{remaining}s</Text>
            </View>

            {/* Card Info */}
            <View style={dynamicStyles.cardInfo}>
              <Text style={dynamicStyles.serviceName}>{serviceName}</Text>
              {accountName && (
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginBottom: 6, opacity: 0.8 }}>
                  {accountName}
                </Text>
              )}
              <View style={dynamicStyles.codeRow}>
                <Text style={dynamicStyles.code}>{formattedCode}</Text>
              </View>
            </View>

            {/* Time Remaining */}
            <Ionicons
              name="time-outline"
              size={22}
              color={theme.colors.textSecondary}
              style={dynamicStyles.chevron}
            />
          </TouchableOpacity>
        </View>
      </Swipeable>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        visible={showDeleteModal}
        title="2FA Kodunu Sil"
        message={`${serviceName} için 2FA kodunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
        cancelText="Vazgeç"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
