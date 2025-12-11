import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useAppTheme } from '../lib/theme';
import Svg, { Path, SvgUri } from 'react-native-svg';

/**
 * ServiceLogo Component
 * Web'deki ServiceLogo.tsx'in mobil versiyonu
 * Brandfetch CDN kullanılıyor
 * Fallback olarak text gösterir
 * 
 * @param variant - 'default' | 'card' (card variant: no border, white bg, shadow)
 */
export default function ServiceLogo({ brand, fallbackText, size = 'md', style, variant = 'default' }) {
  const { theme } = useAppTheme();
  const [imgError, setImgError] = useState(false);
  const [forceSvg, setForceSvg] = useState(false);

  const sizeMap = {
    xs: { container: 24, text: 8, logo: 16 },
    sm: { container: 32, text: 10, logo: 20 },
    md: { container: 48, text: 14, logo: 32 },
    lg: { container: 64, text: 18, logo: 44 },
    xl: { container: 80, text: 22, logo: 56 },
  };

  const sizes = sizeMap[size] || sizeMap.md;

  // Card variant için özel boyutlar
  const cardSizes = {
    container: 44,
    logo: 32,
    text: 12,
  };

  const activeSizes = variant === 'card' ? cardSizes : sizes;

  // Variant'a göre container stili
  const getContainerStyle = () => {
    if (variant === 'card') {
      return {
        width: cardSizes.container,
        height: cardSizes.container,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      };
    }
    return {
      width: sizes.container,
      height: sizes.container,
      backgroundColor: brand?.colors?.bg || theme.colors.surface,
      borderColor: theme.colors.border,
    };
  };

  const renderFallback = () => (
    <View
      style={[
        variant === 'card' ? styles.cardContainer : styles.fallback,
        getContainerStyle(),
        style,
      ]}
    >
      <Text
        style={[
          styles.fallbackText,
          {
            fontSize: activeSizes.text,
            color: brand?.colors?.primary || theme.colors.textSecondary,
          },
        ]}
      >
        {(fallbackText || '?').slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );

  if (!brand) {
    return renderFallback();
  }

  // SVG path render (custom SVG'ler için)
  if (brand.type === 'svg-path' && brand.content) {
    return (
      <View
        style={[
          variant === 'card' ? styles.cardContainer : styles.container,
          getContainerStyle(),
          style,
        ]}
      >
        <Svg
          width={activeSizes.logo}
          height={activeSizes.logo}
          viewBox={brand.viewBox || '0 0 24 24'}
        >
          <Path
            d={brand.content}
            fill={brand.colors?.primary || theme.colors.text}
          />
        </Svg>
      </View>
    );
  }

  // Logo URL'sini belirle
  const getLogoUrl = () => {
    if (brand.iconUrl) {
      return brand.iconUrl;
    }
    if (brand.domain) {
      return `https://cdn.brandfetch.io/${brand.domain}?c=1bxid64Mup7aczewSAYMX`;
    }
    return null;
  };

  const logoUrl = getLogoUrl();

  // Logo göster
  if (logoUrl && !imgError) {
    const isSvg = logoUrl.toLowerCase().includes('.svg') || forceSvg;

    return (
      <View
        style={[
          variant === 'card' ? styles.cardContainer : styles.container,
          getContainerStyle(),
          style,
        ]}
      >
        {isSvg ? (
          <SvgUri
            width={activeSizes.logo}
            height={activeSizes.logo}
            uri={logoUrl}
            onError={() => {
              if (forceSvg) {
                setImgError(true);
              } else {
                setForceSvg(false);
                setImgError(true);
              }
            }}
          />
        ) : (
          <Image
            source={{ uri: logoUrl }}
            style={{
              width: activeSizes.logo,
              height: activeSizes.logo,
              resizeMode: 'contain',
            }}
            onError={() => setImgError(true)}
          />
        )}
      </View>
    );
  }

  return renderFallback();
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContainer: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // border yok - getContainerStyle'dan geliyor
  },
  fallback: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fallbackText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
