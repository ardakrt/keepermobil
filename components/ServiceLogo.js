import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useAppTheme } from '../lib/theme';
import Svg, { Path } from 'react-native-svg';

/**
 * ServiceLogo Component
 * Web'deki ServiceLogo.tsx'in mobil versiyonu
 * Brandfetch CDN'den logoları gösterir, fallback olarak text gösterir
 */
export default function ServiceLogo({ brand, fallbackText, size = 'md', style }) {
  const { theme } = useAppTheme();
  const [imgError, setImgError] = useState(false);
  const isDark = theme.mode === 'dark';

  const sizeMap = {
    sm: { container: 32, text: 10 },
    md: { container: 48, text: 14 },
    lg: { container: 64, text: 18 },
    xl: { container: 80, text: 22 },
  };

  const sizes = sizeMap[size] || sizeMap.md;

  const renderFallback = () => (
    <View
      style={[
        styles.fallback,
        {
          width: sizes.container,
          height: sizes.container,
          backgroundColor: brand?.colors?.bg || theme.colors.surface,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.fallbackText,
          {
            fontSize: sizes.text,
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

  // İş Bankası için SVG path render
  if (brand.type === 'svg-path' && brand.content) {
    return (
      <View
        style={[
          styles.container,
          {
            width: sizes.container,
            height: sizes.container,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
          style,
        ]}
      >
        <Svg
          width={sizes.container - 8}
          height={sizes.container - 8}
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

  // Discord için özel light/dark mode desteği
  if (brand.id === 'discord') {
    const discordForLightMode = 'https://cdn.brandfetch.io/idM8Hlme1a/idZ9ykLN4b.svg?c=1bxid64Mup7aczewSAYMX&t=1646262546276';
    const discordForDarkMode = 'https://cdn.brandfetch.io/idM8Hlme1a/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1668075053047';

    if (!imgError) {
      return (
        <View
          style={[
            styles.container,
            {
              width: sizes.container,
              height: sizes.container,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
            style,
          ]}
        >
          <Image
            source={{ uri: isDark ? discordForDarkMode : discordForLightMode }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setImgError(true)}
          />
        </View>
      );
    }
    return renderFallback();
  }

  // Binance için özel light/dark mode desteği
  if (brand.id === 'binance') {
    const binanceDarkMode = 'https://cdn.brandfetch.io/id-pjrLx_q/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1675846248522';
    const binanceLightMode = 'https://cdn.brandfetch.io/id-pjrLx_q/theme/dark/idtm0kR5Wk.svg?c=1bxid64Mup7aczewSAYMX&t=1675846247575';

    if (!imgError) {
      return (
        <View
          style={[
            styles.container,
            {
              width: sizes.container,
              height: sizes.container,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
            style,
          ]}
        >
          <Image
            source={{ uri: isDark ? binanceDarkMode : binanceLightMode }}
            style={styles.image}
            resizeMode="contain"
            onError={() => setImgError(true)}
          />
        </View>
      );
    }
    return renderFallback();
  }

  // Brandfetch CDN'den logo çek
  if (brand.type === 'brandfetch' && brand.domain && !imgError) {
    const logoUrl = `https://cdn.brandfetch.io/${brand.domain}?c=1idHS4FIS8wG7IAYxk8`;

    return (
      <View
        style={[
          styles.container,
          {
            width: sizes.container,
            height: sizes.container,
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
          style,
        ]}
      >
        <Image
          source={{ uri: logoUrl }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setImgError(true)}
        />
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
    padding: 6,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
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







