import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { usePushAuth } from '../lib/PushAuthContext';
import { useAppTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Basit logo bileşeni
const KeeperLogo = ({ isDark }: { isDark: boolean }) => (
  <View style={[styles.logoContainer, { backgroundColor: isDark ? '#333' : '#F0F0F0' }]}>
    <Image
      source={require('../assets/icon.png')}
      style={styles.logoImage}
      resizeMode="contain"
    />
  </View>
);

export default function PushAuthModal() {
  const insets = useSafeAreaInsets();
  const { pendingRequest, approveRequest, rejectRequest, isProcessing } = usePushAuth();
  const { theme } = useAppTheme();
  const isDark = theme.dark;
  const visible = !!pendingRequest;
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    if (pendingRequest?.ip_address) {
      // Şimdilik API çağrısı yapmıyoruz (hata riskini azaltmak için), doğrudan IP gösteriyoruz
      setCity(null);
    }
  }, [pendingRequest]);

  if (!pendingRequest) return null;

  const handleApprove = async () => {
    if (pendingRequest) {
      await approveRequest(pendingRequest.id);
    }
  };

  const handleReject = async () => {
    if (pendingRequest) {
      await rejectRequest(pendingRequest.id);
    }
  };

  const formattedDate = new Date(pendingRequest.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleReject}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Arka plan bulanıklığı */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]} />
        )}

        <View style={[styles.container, { paddingBottom: insets.bottom + 20, backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF' }]}>

          <View style={styles.header}>
            <KeeperLogo isDark={isDark} />
            <Text style={[styles.title, { color: isDark ? '#FFF' : '#000' }]}>Giriş İsteği</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#AAA' : '#666' }]}>
              {pendingRequest.location || 'Bilinmeyen konum'} • {formattedDate}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: isDark ? '#252525' : '#F5F5F5' }]}>
            <View style={styles.infoRow}>
              <Ionicons name="globe-outline" size={20} color={isDark ? '#AAA' : '#666'} />
              <Text style={[styles.infoText, { color: isDark ? '#EEE' : '#333' }]}>
                {pendingRequest.browser_info || 'Tarayıcı'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="hardware-chip-outline" size={20} color={isDark ? '#AAA' : '#666'} />
              <Text style={[styles.infoText, { color: isDark ? '#EEE' : '#333' }]}>
                {pendingRequest.device_info || 'Cihaz'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="wifi-outline" size={20} color={isDark ? '#AAA' : '#666'} />
              <Text style={[styles.infoText, { color: isDark ? '#EEE' : '#333' }]}>
                {pendingRequest.ip_address}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              onPress={handleReject}
              disabled={isProcessing}
            >
              <Text style={styles.rejectText}>Reddet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.approveButton]}
              onPress={handleApprove}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.approveText}>Onayla</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  logoContainer: {
    alignSelf: 'center',
    marginBottom: 16,
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  approveButton: {
    backgroundColor: '#007AFF', // Keeper Blue
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  rejectText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '600',
  },
  approveText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
