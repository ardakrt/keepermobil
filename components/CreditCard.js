import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { usePrefs } from '../lib/prefs';

const formatCardNumber = (value) => {
  const cleaned = value.replace(/\D/g, '');
  const chunks = cleaned.match(/.{1,4}/g) || [];
  return chunks.join(' ');
};

const getCardGradient = (brand, index = 0) => {
  const brandUpper = brand?.toUpperCase() || '';

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

  // Default - random gradient based on index
  const gradients = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#30cfd0', '#330867'],
    ['#a8edea', '#fed6e3'],
    ['#ff9a9e', '#fecfef'],
  ];
  return gradients[index % gradients.length];
};

const getCardBrand = (number) => {
  if (!number) return null;
  const cleaned = number.replace(/\D/g, '');
  const firstDigit = cleaned[0];
  const firstTwo = cleaned.substring(0, 2);

  if (firstDigit === '4') return 'VISA';
  if (firstTwo >= '51' && firstTwo <= '55') return 'MC';
  if (firstTwo === '65') return 'TROY';
  if (firstTwo === '35') return 'JCB';
  if (firstTwo === '37') return 'AMEX';

  return null;
};

const CreditCard = ({ card, index = 0, onPress, style, cardBrand: propCardBrand }) => {
  const { hapticsEnabled } = usePrefs();
  const flipAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(1);

  const cardBrand = propCardBrand || card.cardBrand || getCardBrand(card.number_enc);
  const gradient = getCardGradient(cardBrand, index);

  const handlePressIn = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    scaleAnim.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scaleAnim.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    if (onPress) {
      onPress(card);
    }
    // Flip animasyonu
    flipAnim.value = withSpring(flipAnim.value === 0 ? 1 : 0, {
      damping: 20,
      stiffness: 300,
    });
  };

  const animatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipAnim.value, [0, 1], [0, 180]);
    return {
      transform: [
        { scale: scaleAnim.value },
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
      ],
    };
  });

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(flipAnim.value, [0, 0.5, 1], [1, 0, 0]);
    return { opacity };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(flipAnim.value, [0, 0.5, 1], [0, 0, 1]);
    const rotateY = 180;
    return {
      opacity,
      transform: [{ rotateY: `${rotateY}deg` }],
    };
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
    >
      <Animated.View style={[styles.cardContainer, animatedStyle]}>
        {/* FRONT SIDE */}
        <Animated.View style={[styles.cardSide, frontAnimatedStyle]}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* EMV Chip */}
            <View style={styles.chip}>
              <View style={styles.chipInner}>
                <View style={styles.chipGrid}>
                  {[...Array(16)].map((_, i) => (
                    <View key={i} style={styles.chipCell} />
                  ))}
                </View>
              </View>
            </View>

            {/* Card Brand Logo */}
            {cardBrand && (
              <View style={styles.brandContainer}>
                <Text style={styles.brandText}>{cardBrand}</Text>
              </View>
            )}

            {/* Card Number */}
            <View style={styles.numberContainer}>
              <Text style={styles.cardNumber}>
                {formatCardNumber(card.number_enc || '')}
              </Text>
            </View>

            {/* Card Holder & Expiry */}
            <View style={styles.bottomRow}>
              <View style={styles.holderContainer}>
                <Text style={styles.label}>KART SAHİBİ</Text>
                <Text style={styles.holderName} numberOfLines={1}>
                  {(card.holder_name_enc || 'AD SOYAD').toUpperCase()}
                </Text>
              </View>
              <View style={styles.expiryContainer}>
                <Text style={styles.label}>SKT</Text>
                <Text style={styles.expiry}>{card.expiry || '--/--'}</Text>
              </View>
            </View>

            {/* Card Label Badge */}
            <View style={styles.labelBadge}>
              <Text style={styles.labelText} numberOfLines={1}>
                {card.label || 'Banka Kartı'}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* BACK SIDE */}
        <Animated.View style={[styles.cardSide, styles.cardBack, backAnimatedStyle]}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Magnetic Strip */}
            <View style={styles.magneticStrip} />

            {/* Signature Panel */}
            <View style={styles.signaturePanel}>
              <Text style={styles.signatureText}>İmza</Text>
            </View>

            {/* CVC */}
            <View style={styles.cvcContainer}>
              <Text style={styles.cvcLabel}>CVC</Text>
              <View style={styles.cvcBox}>
                <Text style={styles.cvcText}>{card.cvc_enc || '***'}</Text>
              </View>
            </View>

            {/* Info Text */}
            <Text style={styles.backInfo}>
              Bu kart sahibine aittir. Bulunduğunda lütfen iade edin.
            </Text>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    aspectRatio: 1.586, // Standart kredi kartı oranı (85.60mm × 53.98mm)
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardSide: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    position: 'absolute',
  },
  gradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  chip: {
    width: 50,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    padding: 4,
    marginBottom: 8,
  },
  chipInner: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 5,
    padding: 4,
  },
  chipGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  chipCell: {
    width: '22%',
    height: '22%',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 1,
  },
  brandContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  brandText: {
    fontSize: 24,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  numberContainer: {
    marginVertical: 10,
  },
  cardNumber: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: 'monospace',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  holderContainer: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
    letterSpacing: 1,
  },
  holderName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  expiryContainer: {
    alignItems: 'flex-end',
  },
  expiry: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  labelBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: '60%',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // BACK SIDE STYLES
  magneticStrip: {
    height: 50,
    backgroundColor: '#000',
    marginHorizontal: -20,
    marginTop: 15,
  },
  signaturePanel: {
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginTop: 20,
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  signatureText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
  },
  cvcContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 8,
  },
  cvcLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1,
  },
  cvcBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  cvcText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  backInfo: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

export default CreditCard;
