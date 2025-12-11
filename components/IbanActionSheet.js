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
import { getBankInfo } from '../lib/serviceIcons';
import ServiceLogo from './ServiceLogo';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const IbanActionSheet = ({ visible, iban, onClose, onEdit, onDelete, onCopy, onShare }) => {
  const { theme, accent } = useAppTheme();
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

  // Use accent color or default gradient
  const activeColor = accent || '#667eea';

  // Create gradient by darkening the accent color
  const darkenColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  };

  const ibanGradient = [activeColor, darkenColor(activeColor, 20)];

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

            {/* IBAN Preview - Premium Card Design */}
            <View style={styles.cardContainer}>
              <View
                style={[
                  styles.ibanPreview,
                  {
                    backgroundColor: ibanGradient[0],
                    shadowColor: ibanGradient[0],
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.4,
                    shadowRadius: 20,
                    elevation: 16,
                  },
                ]}
              >
                <LinearGradient
                  colors={ibanGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Decoration Overlay */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.15)', 'rgba(0,0,0,0.05)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />

                {/* Decoration Circles */}
                <View style={[styles.decoCircle, styles.decoCircle1]} />
                <View style={[styles.decoCircle, styles.decoCircle2]} />

                {/* Card Content */}
                <View style={styles.cardContent}>
                  {/* Header */}
                  <View style={styles.ibanHeader}>
                    <View style={styles.headerLeft}>
                      <Text style={styles.headerTitle}>HESAP SAHİBİ</Text>
                      <Text style={styles.ibanLabel} numberOfLines={1}>{iban.label}</Text>
                    </View>
                    {/* Bank Logo or Initials */}
                    {getBankInfo(iban.bank) ? (
                      <ServiceLogo
                        brand={getBankInfo(iban.bank)}
                        fallbackText={bankInitials(iban.bank)}
                        variant="card"
                      />
                    ) : (
                      <View style={styles.bankBadge}>
                        <Text style={styles.bankBadgeText}>{bankInitials(iban.bank)}</Text>
                      </View>
                    )}
                  </View>

                  {/* IBAN Number */}
                  <View style={styles.ibanBody}>
                    <Text style={styles.ibanTitle}>IBAN</Text>
                    <Text style={styles.ibanNumber} adjustsFontSizeToFit numberOfLines={2}>
                      {formatIbanGroups(iban.iban)}
                    </Text>
                  </View>

                  {/* Footer */}
                  <View style={styles.ibanFooter}>
                    <View>
                      <Text style={styles.bankTitle}>BANKA</Text>
                      <Text style={styles.ibanBank} numberOfLines={1}>
                        {iban.bank || 'Belirtilmemiş'}
                      </Text>
                    </View>
                    <View style={styles.validBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#4ade80" />
                      <Text style={styles.validText}>Geçerli</Text>
                    </View>
                  </View>
                </View>
              </View>
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
    borderRadius: 24,
    overflow: 'hidden',
    height: 200,
    padding: 24,
  },
  cardContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  decoCircle: {
    position: 'absolute',
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  decoCircle1: {
    width: 140,
    height: 140,
    right: -20,
    top: -20,
  },
  decoCircle2: {
    width: 100,
    height: 100,
    left: -30,
    bottom: -30,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ibanGradient: {
    padding: 24,
    minHeight: 200,
  },
  ibanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  ibanLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  bankLogo: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  bankBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bankBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ibanBody: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  ibanTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  ibanNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  ibanFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bankTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ibanBank: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    maxWidth: 150,
  },
  validBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  validText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4ade80',
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
