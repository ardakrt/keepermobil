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

const IbanActionSheet = ({ visible, iban, onClose, onEdit, onDelete, onCopy, onShare }) => {
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

  if (!visible || !iban) return null;

  const formatIbanGroups = (value) => {
    if (!value) return '';
    const cleaned = value.replace(/\s+/g, '').toUpperCase();
    return cleaned
      .replace(/(.{4})/g, '$1 ')
      .trim();
  };

  const bankInitials = (name) => {
    const n = (name || '').trim();
    if (!n) return 'TR';
    const parts = n.split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
    return initials || 'TR';
  };

  const ibanGradient = ['#667eea', '#764ba2'];

  const actions = [
    {
      icon: 'create',
      label: 'Düzenle',
      color: '#667eea',
      bgColor: 'rgba(102, 126, 234, 0.15)',
      onPress: () => handleAction(() => onEdit?.(iban)),
    },
    {
      icon: 'share-social',
      label: 'Paylaş',
      color: '#ffc107',
      bgColor: 'rgba(255, 193, 7, 0.15)',
      onPress: () => handleAction(() => onShare?.(iban)),
    },
    {
      icon: 'copy',
      label: 'IBAN Kopyala',
      color: '#43e97b',
      bgColor: 'rgba(67, 233, 123, 0.15)',
      onPress: () => handleAction(() => onCopy?.(iban)),
    },
    {
      icon: 'trash',
      label: 'Sil',
      color: '#ff6b6b',
      bgColor: 'rgba(255, 107, 107, 0.15)',
      onPress: () => handleAction(() => onDelete?.(iban)),
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

            {/* IBAN Preview */}
            <View
              style={[
                styles.ibanPreview,
                {
                  shadowColor: ibanGradient[0],
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 12,
                },
              ]}
            >
              <LinearGradient
                colors={ibanGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ibanGradient}
              >
                <View style={styles.ibanHeader}>
                  <Text style={styles.ibanLabel}>{iban.label}</Text>
                  <View style={styles.bankBadge}>
                    <Text style={styles.bankBadgeText}>{bankInitials(iban.bank)}</Text>
                  </View>
                </View>
                <Text style={styles.ibanNumber}>{formatIbanGroups(iban.iban)}</Text>
                <View style={styles.ibanFooter}>
                  <Text style={styles.ibanBank}>{iban.bank || 'Banka bilgisi yok'}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.colors.text }]}>
              IBAN ile ne yapmak istersin?
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
  ibanPreview: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  ibanGradient: {
    padding: 20,
    minHeight: 180,
  },
  ibanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ibanLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    flex: 1,
  },
  bankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bankBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ibanNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
    marginBottom: 'auto',
  },
  ibanFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  ibanBank: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
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
    width: (SCREEN_WIDTH - 64) / 2,
    aspectRatio: 1.5,
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
    fontSize: 13,
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

export default IbanActionSheet;
