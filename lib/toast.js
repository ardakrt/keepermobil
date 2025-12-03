import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from './theme';

const ToastContext = createContext({
  showToast: (title, body, duration) => {},
});

export const useToast = () => useContext(ToastContext);

// Toast türüne göre ikon ve renk
const getToastStyle = (title, theme) => {
  const lowerTitle = title?.toLowerCase() || '';
  
  // Hata durumları
  if (lowerTitle.includes('hata') || lowerTitle.includes('başarısız') || lowerTitle.includes('alınamadı')) {
    return {
      icon: 'alert-circle',
      iconColor: '#EF4444',
      borderColor: '#EF444440',
      bgTint: '#EF444410',
    };
  }
  
  // Başarı durumları
  if (lowerTitle.includes('eklendi') || lowerTitle.includes('kaydedildi') || lowerTitle.includes('başarılı') || lowerTitle.includes('aktif')) {
    return {
      icon: 'check-circle',
      iconColor: '#22C55E',
      borderColor: '#22C55E40',
      bgTint: '#22C55E10',
    };
  }
  
  // Silme/Çıkarma durumları
  if (lowerTitle.includes('çıkarıldı') || lowerTitle.includes('silindi')) {
    return {
      icon: 'minus-circle',
      iconColor: '#F59E0B',
      borderColor: '#F59E0B40',
      bgTint: '#F59E0B10',
    };
  }
  
  // İptal durumları (parmak izi iptal, işlem iptal vb.)
  if (lowerTitle.includes('iptal') || lowerTitle.includes('vazgeçildi') || lowerTitle.includes('engellendi')) {
    return {
      icon: 'close-circle',
      iconColor: '#6B7280',
      borderColor: '#6B728040',
      bgTint: '#6B728010',
    };
  }
  
  // Uyarı durumları
  if (lowerTitle.includes('uyarı') || lowerTitle.includes('dikkat') || lowerTitle.includes('kayıtlı değil') || lowerTitle.includes('desteklenmiyor')) {
    return {
      icon: 'alert',
      iconColor: '#F59E0B',
      borderColor: '#F59E0B40',
      bgTint: '#F59E0B10',
    };
  }
  
  // Varsayılan - info
  return {
    icon: 'information',
    iconColor: theme.colors.primary,
    borderColor: theme.colors.border,
    bgTint: 'transparent',
  };
};

export const ToastProvider = ({ children }) => {
  const { theme, accent } = useAppTheme();
  const [toast, setToast] = useState(null); // { title, body }
  const timeoutRef = useRef(null);
  const anim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible

  const showToast = useCallback((title, body = null, duration = 2500) => {
    if (!title) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setToast({ title, body });
    anim.stopAnimation();
    anim.setValue(0);
    Animated.spring(anim, { 
      toValue: 1, 
      tension: 100,
      friction: 8,
      useNativeDriver: true 
    }).start();
    timeoutRef.current = setTimeout(() => setToast(null), duration);
    // Animate out slightly before removal
    const outDelay = Math.max(0, duration - 200);
    setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }, outDelay);
  }, [anim]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const toastStyle = toast ? getToastStyle(toast.title, theme) : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        toastContainer: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 100,
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          paddingLeft: 16,
          borderRadius: 16,
          backgroundColor: accent && theme.colors.surfaceElevatedTinted 
            ? theme.colors.surfaceElevatedTinted 
            : theme.colors.surfaceElevated,
          borderWidth: 1.5,
          gap: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        },
        iconContainer: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        textContainer: {
          flex: 1,
          gap: 2,
        },
        toastTitle: {
          color: theme.colors.text,
          fontWeight: '700',
          fontSize: 15,
        },
        toastBody: {
          color: theme.colors.textSecondary,
          fontSize: 13,
          lineHeight: 18,
        },
      }),
    [theme, accent],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && toastStyle ? (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              borderColor: toastStyle.borderColor,
              backgroundColor: theme.colors.surfaceElevated,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }),
                },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.iconContainer, { backgroundColor: toastStyle.bgTint }]}>
            <MaterialCommunityIcons 
              name={toastStyle.icon} 
              size={22} 
              color={toastStyle.iconColor} 
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.toastTitle}>{toast.title}</Text>
            {toast.body ? <Text style={styles.toastBody}>{toast.body}</Text> : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};
