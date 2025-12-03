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
import CardBrandIcon from './CardBrandIcon';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const CardActionSheet = ({ visible, card, onClose, onEdit, onDelete, onCopy, onShare }) => {
  const { theme } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smooth ease-out
      });
    } else {
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: 250,
        easing: Easing.bezier(0.4, 0, 1, 1), // Smooth ease-in
      });
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Sadece aşağı çekmeye izin ver
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      // 150px'den fazla çekilirse kapat
      if (event.translationY > 150) {
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: 250,
          easing: Easing.bezier(0.4, 0, 1, 1),
        });
        opacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        // Geri dön
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

  if (!visible || !card) return null;

  const formatMaskedNumber = (lastFour) => {
    if (!lastFour) return '•••• •••• •••• ••••';
    return `•••• •••• •••• ${lastFour}`;
  };

  const getCardGradient = () => {
    const brandUpper = card.cardBrand?.toUpperCase() || '';

    // Visa
    if (brandUpper.includes('VISA')) {
      return ['#1434CB', '#1A1F71'];
    }

    // Mastercard
    if (brandUpper.includes('MASTER') || brandUpper === 'MC') {
      return ['#EB001B', '#FF5F00'];
    }

    // Troy
    if (brandUpper.includes('TROY')) {
      return ['#00A19B', '#00C9C1'];
    }

    // American Express
    if (brandUpper.includes('AMEX') || brandUpper.includes('AMERICAN')) {
      return ['#006FCF', '#0077CC'];
    }

    // Default
    return ['#667eea', '#764ba2'];
  };

  const cardGradient = getCardGradient();

  const actions = [
    {
      icon: 'create',
      label: 'Düzenle',
      color: '#667eea',
      bgColor: 'rgba(102, 126, 234, 0.15)',
      onPress: () => handleAction(() => onEdit?.(card)),
    },
    {
      icon: 'share-social',
      label: 'Paylaş',
      color: '#ffc107',
      bgColor: 'rgba(255, 193, 7, 0.15)',
      onPress: () => handleAction(() => onShare?.(card)),
    },
    {
      icon: 'card',
      label: 'Kart No',
      color: '#43e97b',
      bgColor: 'rgba(67, 233, 123, 0.15)',
      onPress: () => handleAction(() => onCopy?.(card, 'number')),
    },
    {
      icon: 'calendar',
      label: 'SKT',
      color: '#4facfe',
      bgColor: 'rgba(79, 172, 254, 0.15)',
      onPress: () => handleAction(() => onCopy?.(card, 'expiry')),
    },
    {
      icon: 'shield-checkmark',
      label: 'CVC',
      color: '#fa709a',
      bgColor: 'rgba(250, 112, 154, 0.15)',
      onPress: () => handleAction(() => onCopy?.(card, 'cvc')),
    },
    {
      icon: 'person',
      label: 'İsim',
      color: '#f093fb',
      bgColor: 'rgba(240, 147, 251, 0.15)',
      onPress: () => handleAction(() => onCopy?.(card, 'holder')),
    },
    {
      icon: 'trash',
      label: 'Sil',
      color: '#ff6b6b',
      bgColor: 'rgba(255, 107, 107, 0.15)',
      onPress: () => handleAction(() => onDelete?.(card)),
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

            {/* Card Preview */}
            <View
              style={[
                styles.cardPreview,
                {
                  shadowColor: cardGradient[0],
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 12,
                },
              ]}
            >
              <LinearGradient
                colors={cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardLabel}>{card.label}</Text>
                  <CardBrandIcon brand={card.cardBrand} width={50} height={32} />
                </View>
                <Text style={styles.cardNumber}>{formatMaskedNumber(card.last_four)}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardHolder}>{card.holder_name_enc?.toUpperCase()}</Text>
                  <Text style={styles.cardExpiry}>{card.expiry || '--/--'}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.colors.text }]}>Kartın ile ne yapmak istersin?</Text>

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
  cardPreview: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 20,
    aspectRatio: 1.586,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: 'monospace',
    marginBottom: 'auto',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardHolder: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
  },
  cardExpiry: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'monospace',
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

export default CardActionSheet;
