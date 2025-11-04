import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const CardBrandIcon = ({ brand, width = 60, height = 38 }) => {
  const getBrandInfo = () => {
    const brandUpper = brand?.toUpperCase() || '';

    // Visa
    if (brandUpper.includes('VISA')) {
      return {
        gradient: ['#1434CB', '#1A1F71'],
        logo: 'VISA',
        textColor: '#FFFFFF',
      };
    }

    // Mastercard
    if (brandUpper.includes('MASTER') || brandUpper === 'MC') {
      return {
        gradient: ['#EB001B', '#FF5F00'],
        logo: 'MC',
        circles: true,
      };
    }

    // Troy
    if (brandUpper.includes('TROY')) {
      return {
        gradient: ['#00A19B', '#00C9C1'],
        logo: 'TROY',
        textColor: '#FFFFFF',
      };
    }

    // American Express
    if (brandUpper.includes('AMEX') || brandUpper.includes('AMERICAN')) {
      return {
        gradient: ['#006FCF', '#0077CC'],
        logo: 'AMEX',
        textColor: '#FFFFFF',
      };
    }

    // Default
    return {
      gradient: ['#667eea', '#764ba2'],
      logo: '💳',
      textColor: '#FFFFFF',
    };
  };

  const brandInfo = getBrandInfo();

  if (brandInfo.circles) {
    // Mastercard circles
    return (
      <View style={[styles.container, { width, height }]}>
        <View style={styles.mastercardContainer}>
          <View style={[styles.circle, styles.circleLeft]} />
          <View style={[styles.circle, styles.circleRight]} />
          <View style={styles.circleOverlap} />
        </View>
      </View>
    );
  }

  // Visa, Troy or default gradient
  return (
    <LinearGradient
      colors={brandInfo.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { width, height }]}
    >
      <Text style={[styles.logoText, { color: brandInfo.textColor }]}>
        {brandInfo.logo}
      </Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  mastercardContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
  },
  circleLeft: {
    backgroundColor: '#EB001B',
    left: 14,
  },
  circleRight: {
    backgroundColor: '#FF5F00',
    right: 14,
  },
  circleOverlap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
    backgroundColor: '#F79E1B',
    opacity: 0.7,
  },
});

export default CardBrandIcon;
