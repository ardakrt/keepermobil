import React, { useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const AccountActionSheet = ({ visible, account, onClose, onEdit, onDelete, onCopyUsername, onCopyPassword, onShare }) => {
  const { theme } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    } else {
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: 250,
        easing: Easing.bezier(0.4, 0, 1, 1),
      });
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 150) {
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: 250,
          easing: Easing.bezier(0.4, 0, 1, 1),
        });
        opacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, {
          duration: 300,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      }
    });

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleAction = (action) => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onClose();
    setTimeout(() => action(), 300);
  };

  if (!visible || !account) return null;

  const accountGradient = ['#667eea', '#764ba2'];

  const getServiceIcon = (service) => {
    const s = service.toLowerCase();
    if (s.includes('google') || s.includes('gmail')) return 'logo-google';
    if (s.includes('facebook')) return 'logo-facebook';
    if (s.includes('twitter') || s.includes('x')) return 'logo-twitter';
    if (s.includes('instagram')) return 'logo-instagram';
    if (s.includes('linkedin')) return 'logo-linkedin';
    if (s.includes('github')) return 'logo-github';
    if (s.includes('apple')) return 'logo-apple';
    if (s.includes('microsoft')) return 'logo-microsoft';
    return 'person-circle';
  };

  const actions = [
    {
      icon: 'create',
      label: 'Düzenle',
      color: '#667eea',
      bgColor: 'rgba(102, 126, 234, 0.15)',
      onPress: () => handleAction(() => onEdit?.(account)),
    },
    {
      icon: 'share-social',
      label: 'Paylaş',
      color: '#ffc107',
      bgColor: 'rgba(255, 193, 7, 0.15)',
      onPress: () => handleAction(() => onShare?.(account)),
    },
    {
      icon: 'person',
      label: 'Kullanıcı Adı',
      color: '#43e97b',
      bgColor: 'rgba(67, 233, 123, 0.15)',
      onPress: () => handleAction(() => onCopyUsername?.(account)),
    },
    {
      icon: 'key',
      label: 'Parola',
      color: '#fa709a',
      bgColor: 'rgba(250, 112, 154, 0.15)',
      onPress: () => handleAction(() => onCopyPassword?.(account)),
    },
    {
      icon: 'trash',
      label: 'Sil',
      color: '#ff6b6b',
      bgColor: 'rgba(255, 107, 107, 0.15)',
      onPress: () => handleAction(() => onDelete?.(account)),
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.container}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            {/* Handle Bar */}
            <Animated.View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </Animated.View>

            {/* Account Preview */}
            <View
              style={[
                styles.accountPreview,
                {
                  shadowColor: accountGradient[0],
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 12,
                },
              ]}
            >
              <LinearGradient
                colors={accountGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.accountGradient}
              >
                <View style={styles.accountHeader}>
                  <Text style={styles.accountLabel}>{account.service}</Text>
                  <Ionicons name={getServiceIcon(account.service)} size={24} color="rgba(255,255,255,0.9)" />
                </View>
                <View style={styles.accountInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="person" size={16} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.accountUsername}>{account.username_enc}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="key" size={16} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.accountPassword}>{'•'.repeat(12)}</Text>
                  </View>
                </View>
                {account.note ? (
                  <View style={styles.accountFooter}>
                    <Text style={styles.accountNote} numberOfLines={2}>{account.note}</Text>
                  </View>
                ) : null}
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Hesap ile ne yapmak istersin?
            </Text>

            {/* Action Grid */}
            <View style={styles.actionsGrid}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.actionCard, { backgroundColor: action.bgColor }]}
                  onPress={action.onPress}
                  onPressIn={() => {
                    if (hapticsEnabled) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconContainer, { backgroundColor: action.color }]}>
                    <Ionicons name={action.icon} size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.colors.surfaceElevated }]}
              onPress={onClose}
              onPressIn={() => {
                if (hapticsEnabled) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
              }}
            >
              <Text style={[styles.closeText, { color: theme.colors.text }]}>Kapat</Text>
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    paddingTop: 8,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  handle: {
    width: 50,
    height: 5,
    borderRadius: 3,
  },
  accountPreview: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  accountGradient: {
    padding: 20,
    minHeight: 160,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  accountLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    flex: 1,
  },
  accountInfo: {
    gap: 12,
    marginBottom: 'auto',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
  accountPassword: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 2,
  },
  accountFooter: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  accountNote: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    width: (SCREEN_WIDTH - 64) / 3,
    aspectRatio: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 17,
    fontWeight: '700',
  },
});

export default AccountActionSheet;
