import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAppTheme } from '../lib/theme';
import { usePushAuth } from '../lib/PushAuthContext';

const { width, height } = Dimensions.get('window');

export default function PushAuthModal() {
  const { theme } = useAppTheme();
  const { pendingRequest, approveRequest, rejectRequest, isProcessing } = usePushAuth();
  const [city, setCity] = useState<string>('');

  // ========== ANIMATION VALUES ==========
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const slideY = useSharedValue(30);

  const visible = !!pendingRequest;

  // ========== FETCH CITY FROM IP ==========
  useEffect(() => {
    const fetchCity = async () => {
      if (!pendingRequest?.ip_address) return;

      try {
        const response = await fetch(`https://ipapi.co/${pendingRequest.ip_address}/json/`);
        const data = await response.json();
        if (data.city) {
          setCity(`${data.city}, ${data.country_name}`);
        }
      } catch (error) {
        console.log('City lookup failed:', error);
      }
    };

    if (visible) {
      fetchCity();
    }
  }, [visible, pendingRequest]);

  // ========== ANIMATIONS ==========
  useEffect(() => {
    if (visible) {
      // Entry animation - gentle and smooth
      scale.value = withSpring(1, { damping: 20, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 250 });
      slideY.value = withSpring(0, { damping: 25, stiffness: 100 });
    } else {
      // Exit animation
      scale.value = withTiming(0.9, { duration: 180 });
      opacity.value = withTiming(0, { duration: 180 });
      slideY.value = withTiming(30, { duration: 180 });
    }
  }, [visible]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: slideY.value }
    ],
    opacity: opacity.value,
  }));

  // ========== HANDLERS ==========
  const handleApprove = () => {
    if (pendingRequest && !isProcessing) {
      approveRequest(pendingRequest.id);
    }
  };

  const handleReject = () => {
    if (pendingRequest && !isProcessing) {
      rejectRequest(pendingRequest.id);
    }
  };

  // ========== UTILITIES ==========
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now.getTime() - then.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 5) return 'Şimdi';
    if (diffSecs < 60) return `${diffSecs} saniye önce`;
    if (diffSecs < 120) return '1 dakika önce';
    return formatDate(dateString);
  };

  if (!pendingRequest) return null;

  // ========== STYLES ==========
  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalContainer: {
      width: '100%',
      backgroundColor: theme.dark ? '#1a1a1a' : '#f5f5f7',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingBottom: 40,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
    },
    contentContainer: {
      paddingHorizontal: 24,
      paddingTop: 28,
    },

    // Title Section
    titleContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.dark ? '#ffffff' : '#1d1d1f',
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: theme.dark ? '#a1a1a6' : '#86868b',
      textAlign: 'center',
      marginBottom: 12,
      lineHeight: 21,
      fontWeight: '500',
      paddingHorizontal: 20,
    },
    timeBadge: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: theme.dark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(99, 102, 241, 0.1)',
    },
    timeText: {
      fontSize: 13,
      color: theme.dark ? '#8b8dff' : '#6366f1',
      fontWeight: '700',
    },

    // Info Cards Container
    infoCardsContainer: {
      marginBottom: 24,
      gap: 10,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.dark ? '#2a2a2a' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      gap: 14,
      shadowColor: theme.dark ? '#000' : 'rgba(0, 0, 0, 0.04)',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: theme.dark ? 0.3 : 1,
      shadowRadius: 4,
      elevation: 2,
    },
    infoIconWrapper: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.dark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 11,
      color: theme.dark ? '#86868b' : '#86868b',
      fontWeight: '600',
      marginBottom: 3,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    infoValue: {
      fontSize: 15,
      color: theme.dark ? '#ffffff' : '#1d1d1f',
      fontWeight: '600',
    },

    // Action Buttons
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 18,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    rejectButton: {
      backgroundColor: theme.dark ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255, 59, 48, 0.08)',
      borderWidth: 1.5,
      borderColor: theme.dark ? 'rgba(255, 59, 48, 0.4)' : 'rgba(255, 59, 48, 0.3)',
    },
    approveButton: {
      backgroundColor: theme.dark ? '#6366f1' : '#6366f1',
      shadowColor: '#6366f1',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '700',
    },
    rejectButtonText: {
      color: theme.dark ? '#ff6961' : '#ff3b30',
    },
    approveButtonText: {
      color: '#ffffff',
    },

    // Loading Overlay
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.dark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
    },
    loadingContent: {
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      color: theme.dark ? '#ffffff' : '#1d1d1f',
      fontSize: 15,
      fontWeight: '600',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleReject}
      statusBarTranslucent
    >
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor="rgba(0, 0, 0, 0.4)"
      />

      <View style={styles.overlay}>
        <Animated.View style={[styles.modalContainer, animatedContainerStyle]}>
          <View style={styles.contentContainer}>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Web Giriş İsteği</Text>
              <Text style={styles.subtitle}>
                Bilgisayarınızdan hesabınıza giriş yapmak için onay bekleniyor
              </Text>
              <View style={styles.timeBadge}>
                <Text style={styles.timeText}>
                  {getTimeAgo(pendingRequest.created_at)}
                </Text>
              </View>
            </View>

            {/* Info Cards */}
            <View style={styles.infoCardsContainer}>
              {city && (
                <View style={styles.infoCard}>
                  <View style={styles.infoIconWrapper}>
                    <Ionicons
                      name="location"
                      size={20}
                      color={theme.dark ? '#8b8dff' : '#6366f1'}
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Konum</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                      {city}
                    </Text>
                  </View>
                </View>
              )}

              {pendingRequest.device_info && (
                <View style={styles.infoCard}>
                  <View style={styles.infoIconWrapper}>
                    <Ionicons
                      name="desktop"
                      size={20}
                      color={theme.dark ? '#8b8dff' : '#6366f1'}
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Cihaz</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                      {pendingRequest.device_info}
                    </Text>
                  </View>
                </View>
              )}

              {pendingRequest.browser_info && (
                <View style={styles.infoCard}>
                  <View style={styles.infoIconWrapper}>
                    <Ionicons
                      name="globe"
                      size={20}
                      color={theme.dark ? '#8b8dff' : '#6366f1'}
                    />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Tarayıcı</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                      {pendingRequest.browser_info}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.infoCard}>
                <View style={styles.infoIconWrapper}>
                  <Ionicons
                    name="time"
                    size={20}
                    color={theme.dark ? '#8b8dff' : '#6366f1'}
                  />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Zaman</Text>
                  <Text style={styles.infoValue}>
                    {formatDate(pendingRequest.created_at)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.rejectButton]}
                onPress={handleReject}
                activeOpacity={0.7}
                disabled={isProcessing}
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={theme.dark ? '#ff6961' : '#ff3b30'}
                />
                <Text style={[styles.buttonText, styles.rejectButtonText]}>
                  Reddet
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.approveButton]}
                onPress={handleApprove}
                activeOpacity={0.7}
                disabled={isProcessing}
              >
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={[styles.buttonText, styles.approveButtonText]}>
                  Onayla
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Loading Overlay */}
          {isProcessing && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContent}>
                <ActivityIndicator
                  size="large"
                  color={theme.dark ? '#8b8dff' : '#6366f1'}
                />
                <Text style={styles.loadingText}>İşleniyor...</Text>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
