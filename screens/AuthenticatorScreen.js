import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabaseClient';
import { BasisTheory } from '@basis-theory/basis-theory-js';
import QRScanner from '../components/QRScanner';
import TOTPCodeCard from '../components/TOTPCodeCard';
import Constants from 'expo-constants';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { useAuthenticator } from '../lib/authenticator';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';

// Initialize Basis Theory
const btApiKey = Constants.expoConfig?.extra?.basisTheoryApiKey || process.env.EXPO_PUBLIC_BASIS_THEORY_API_KEY;
let bt;

// Memoized item component
const AuthenticatorItem = React.memo(({ item, secret, theme, accent, onDelete }) => {
  if (!secret) {
    return (
      <View style={styles(theme, accent).loadingCard}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles(theme, accent).loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <TOTPCodeCard
      serviceName={item.service_name}
      accountName={item.account_name}
      secret={secret}
      algorithm={item.algorithm}
      digits={item.digits}
      period={item.period}
      onDelete={() => onDelete(item.id, item.bt_token_id_secret)}
    />
  );
});

// Helper for dynamic styles in extracted component
const styles = (theme, accent) => StyleSheet.create({
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: accent && theme.colors.surfaceTinted
      ? theme.colors.surfaceTinted
      : theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: accent && theme.colors.borderTinted
      ? theme.colors.borderTinted
      : theme.colors.border,
    gap: 12,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
});

export default function AuthenticatorScreen() {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const { otpCodes, secrets, loading, reload } = useAuthenticator();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [showScanner, setShowScanner] = useState(false);
  const [importing, setImporting] = useState(false);
  const [session, setSession] = useState(null);

  // Session bilgisini al
  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData?.session);
    })();
  }, []);

  const dynamicStyles = useMemo(() => ({
    customHeader: {
      paddingTop: insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: accent && theme.colors.backgroundTinted
        ? theme.colors.backgroundTinted
        : theme.colors.background,
    },
    keeperTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    keeperIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary + '30',
    },
    keeperText: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 26,
      letterSpacing: 0.8,
    },
    profileButton: {
      padding: 3,
      borderRadius: 999,
      borderWidth: 2.5,
      borderColor: theme.colors.primary + '40',
      backgroundColor: theme.colors.surface,
    },
  }), [theme, accent, insets]);

  const screenStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: accent && theme.colors.backgroundTinted
            ? theme.colors.backgroundTinted
            : theme.colors.background,
        },
        scrollContent: {
          paddingBottom: 100,
        },
        emptyContainer: {
          alignItems: 'center',
          paddingVertical: 80,
          paddingHorizontal: 40,
        },
        emptyIcon: {
          marginBottom: 16,
        },
        emptyTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 8,
          textAlign: 'center',
        },
        emptyText: {
          fontSize: 15,
          color: theme.colors.textSecondary,
          textAlign: 'center',
          lineHeight: 22,
        },
        loadingContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 60,
        },
        listContainer: {
          flex: 1,
        },
        list: {
          paddingTop: 8,
          paddingBottom: 180,
        },
        loadingText: {
          color: theme.colors.textSecondary,
          fontSize: 14,
        },
        addButtonContainer: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          paddingBottom: 100,
          paddingTop: 16,
          backgroundColor: accent && theme.colors.backgroundTinted
            ? theme.colors.backgroundTinted
            : theme.colors.background,
        },
        addButton: {
          backgroundColor: 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 16,
          borderRadius: 30,
          gap: 10,
          borderWidth: 2,
          borderColor: theme.colors.text,
        },
        addButtonText: {
          color: theme.colors.text,
          fontSize: 17,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
        importingOverlay: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        },
        importingContainer: {
          padding: 32,
          borderRadius: 20,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          gap: 16,
          minWidth: 200,
        },
        importingText: {
          color: theme.colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
      }),
    [theme, accent]
  );

  useEffect(() => {
    const initBasisTheory = async () => {
      try {
        if (!bt && btApiKey) {
          bt = await new BasisTheory().init(btApiKey);
        }
      } catch (error) {
        console.error('Init error:', error);
        Alert.alert('Hata', 'Başlatma sırasında hata oluştu: ' + error.message);
      }
    };
    initBasisTheory();
  }, []);

  const handleScan = async (scannedCodes) => {
    setShowScanner(false);
    setImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let successCount = 0;

      // Ensure Basis Theory is initialized
      if (!bt && btApiKey) {
        bt = await new BasisTheory().init(btApiKey);
      }

      for (const code of scannedCodes) {
        try {
          // Tokenize secret with Basis Theory
          const token = await bt.tokens.create({
            type: 'token',
            data: code.secret,
          });

          // Insert into database
          const { error } = await supabase.from('otp_codes').insert({
            user_id: user.id,
            service_name: code.serviceName,
            account_name: code.accountName,
            issuer: code.issuer,
            bt_token_id_secret: token.id,
            algorithm: code.algorithm,
            digits: code.digits,
            period: code.period || 30,
          });

          if (error) throw error;
          successCount++;
        } catch (error) {
          console.error(`Failed to import ${code.serviceName}:`, error);
        }
      }

      if (hapticsEnabled) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        'Başarılı',
        `${successCount} adet 2FA kodu eklendi`,
        [{ text: 'Tamam', onPress: reload }]
      );
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Hata', '2FA kodları eklenirken hata oluştu');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = useCallback(async (id, btTokenId) => {
    try {
      // Delete from Basis Theory
      await bt.tokens.delete(btTokenId);

      // Delete from database
      const { error } = await supabase
        .from('otp_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (hapticsEnabled) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      reload();
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Hata', 'Kod silinirken hata oluştu');
    }
  }, [hapticsEnabled, reload]);

  const handleAddCode = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowScanner(true);
  };

  const renderItem = useCallback(({ item }) => (
    <AuthenticatorItem
      item={item}
      secret={secrets[item.id]}
      theme={theme}
      accent={accent}
      onDelete={handleDelete}
    />
  ), [secrets, theme, accent, handleDelete]);

  return (
    <View style={screenStyles.container}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      {/* Custom Header */}
      <View style={dynamicStyles.customHeader}>
        <View style={dynamicStyles.keeperTitle}>
          <View style={dynamicStyles.keeperIcon}>
            <MaterialCommunityIcons name="shield-lock" size={22} color={theme.colors.primary} />
          </View>
          <Text style={dynamicStyles.keeperText}>Keeper</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={dynamicStyles.profileButton}
          activeOpacity={0.7}
        >
          <Avatar
            name={session?.user?.user_metadata?.full_name || session?.user?.email}
            imageUrl={session?.user?.user_metadata?.avatar_url}
            size={40}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={screenStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={screenStyles.loadingText}>Kodlar yükleniyor...</Text>
        </View>
      ) : otpCodes.length === 0 ? (
        <ScrollView contentContainerStyle={screenStyles.scrollContent}>
          <View style={screenStyles.emptyContainer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={80}
              color={theme.colors.textSecondary}
              style={screenStyles.emptyIcon}
            />
            <Text style={screenStyles.emptyTitle}>Henüz 2FA kodunuz yok</Text>
            <Text style={screenStyles.emptyText}>
              2FA kodlarınızı güvenle saklayın. Yeni kod eklemek için aşağıdaki butona dokunun.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={screenStyles.listContainer}>
          <FlatList
            data={otpCodes}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={screenStyles.list}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={true}
          />
        </View>
      )}

      {/* Add Button (Fixed at Bottom, above navigation) */}
      <View style={screenStyles.addButtonContainer}>
        <TouchableOpacity
          style={screenStyles.addButton}
          onPress={handleAddCode}
          onPressIn={() => {
            if (hapticsEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
        >
          <Text style={screenStyles.addButtonText}>QR Kod Tara</Text>
          <Ionicons name="scan-circle" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* QR Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      </Modal>

      {/* Importing Modal */}
      <Modal visible={importing} transparent animationType="fade">
        <View style={screenStyles.importingOverlay}>
          <View style={screenStyles.importingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={screenStyles.importingText}>2FA kodları ekleniyor...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}
