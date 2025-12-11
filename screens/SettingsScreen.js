import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  TouchableOpacity,
  Alert,
  StatusBar,
  Linking,
  Share,
  LayoutAnimation,
  UIManager,
  Platform,
  TextInput,
  Modal,
} from 'react-native';

// Android için LayoutAnimation'ı aktifleştir (sadece eski mimaride gerekli)
// Yeni mimaride (New Architecture) bu özellik otomatiktir ve bu kod warning verir.
/*
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental &&
  !global.__turboModuleProxy
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
*/
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabaseClient';
import { biometricPrefs } from '../lib/biometricPrefs';
import { localAuth } from '../lib/localAuth';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { usePushAuth } from '../lib/PushAuthContext';
import Avatar from '../components/Avatar';
import { USER_PIN_KEY, PIN_SESSION_KEY } from '../lib/storageKeys';

const APP_VERSION = Application.nativeApplicationVersion || '1.0.0';
const BUILD_NUMBER = Application.nativeBuildVersion || '1';

const ACCENT_COLORS = [
  { color: '#7c3aed', name: 'Mor' },
  { color: '#ef4444', name: 'Kırmızı' },
  { color: '#f59e0b', name: 'Turuncu' },
  { color: '#22c55e', name: 'Yeşil' },
  { color: '#3b82f6', name: 'Mavi' },
  { color: '#ec4899', name: 'Pembe' },
  { color: '#14b8a6', name: 'Teal' },
  { color: '#8b5cf6', name: 'Eflatun' },
  { color: '#1e40af', name: 'Gece Mavisi' },
  { color: '#64748b', name: 'Andezit Gri' },
];

const SettingsScreen = () => {
  const { mode, theme, setMode, accent, setAccent } = useAppTheme();
  const { hapticsEnabled, toggleHaptics, reduceMotion, toggleReduceMotion } = usePrefs();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { enabled: pushAuthEnabled, setEnabled: setPushAuthEnabled, requireBiometric: pushAuthRequireBiometric, setRequireBiometric: setPushAuthRequireBiometric } = usePushAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasBiometricSession, setHasBiometricSession] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationSound, setNotificationSound] = useState(true);

  // Active category modal
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData?.session);
    })();
  }, []);

  const loadBiometricState = useCallback(async () => {
    setLoading(true);
    try {
      const hardware = await localAuth.hasHardwareAsync();
      const types = await localAuth.supportedAuthenticationTypesAsync();
      const supports = hardware || (types?.length ?? 0) > 0;
      const enrolled = supports ? await localAuth.isEnrolledAsync() : false;

      setBiometricSupported(supports);
      setBiometricEnrolled(!!enrolled);

      const optIn = await biometricPrefs.getOptIn();
      const storedSession = await biometricPrefs.getStoredSession();

      setBiometricEnabled(optIn);
      setHasBiometricSession(!!storedSession);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBiometricState();
  }, [loadBiometricState]);

  const enableBiometric = useCallback(async () => {
    if (!biometricSupported) {
      showToast('Desteklenmiyor', 'Bu cihaz biyometrik kimlik doğrulamayı desteklemiyor.');
      return;
    }
    if (!biometricEnrolled) {
      showToast('Kayıtlı Değil', 'Lütfen cihaz ayarlarından parmak izi veya yüz tanıma kaydedin.');
      return;
    }

    try {
      const result = await localAuth.authenticateAsync({
        promptMessage: 'Parmak izi ile giriş yapın',
        cancelLabel: 'Vazgeç',
      });

      if (!result.success) {
        showToast('İptal Edildi', 'Parmak izi doğrulaması tamamlanmadı.');
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        showToast('Hata', 'Oturum bilgisi alınamadı.');
        return;
      }

      await biometricPrefs.setOptIn(true);
      await biometricPrefs.setStoredSession(data.session);

      showToast('Aktif Edildi', 'Artık parmak izinizle giriş yapabilirsiniz 🎉');
      await loadBiometricState();
    } catch (err) {
      showToast('Hata', err.message ?? 'Parmak izi aktif edilemedi.');
    }
  }, [biometricSupported, biometricEnrolled, loadBiometricState, showToast]);

  const disableBiometric = useCallback(async () => {
    try {
      await biometricPrefs.setOptIn(false);
      await biometricPrefs.setStoredSession(null);
      showToast('Kapatıldı', 'Parmak izi ile giriş kapatıldı');
      await loadBiometricState();
    } catch (err) {
      Alert.alert('Hata', err.message ?? 'Parmak izi kapatılamadı.');
    }
  }, [loadBiometricState, showToast]);

  const handleToggleHaptics = useCallback(async () => {
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleHaptics();
  }, [hapticsEnabled, toggleHaptics]);

  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled((prev) => !prev);
  }, []);

  const toggleNotificationSound = useCallback(() => {
    setNotificationSound((prev) => !prev);
  }, []);

  const handleClearCache = useCallback(async () => {
    const ok = await confirm({
      title: 'Önbellek Temizle',
      message: 'Geçici dosyalar silinecek. Devam etmek istiyor musunuz?',
      confirmText: 'Temizle',
      cancelText: 'Vazgeç',
    });
    if (ok) {
      showToast('Temizlendi', 'Önbellek temizlendi');
    }
  }, [confirm, showToast]);

  const handleDeleteAllData = useCallback(async () => {
    const ok = await confirm({
      title: 'Tüm Verileri Sil',
      message: 'TÜM notlar, kartlar, hesaplar kalıcı olarak silinecek! Bu işlem geri alınamaz.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      destructive: true,
    });
    if (!ok) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      await Promise.all([
        supabase.from('notes').delete().eq('user_id', userData.user.id),
        supabase.from('reminders').delete().eq('user_id', userData.user.id),
        supabase.from('cards').delete().eq('user_id', userData.user.id),
        supabase.from('accounts').delete().eq('user_id', userData.user.id),
        supabase.from('ibans').delete().eq('user_id', userData.user.id),
      ]);

      showToast('Silindi', 'Tüm veriler silindi');
    } catch (err) {
      Alert.alert('Hata', err.message ?? 'Veriler silinemedi.');
    }
  }, [confirm, showToast]);

  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteEmailModalVisible, setDeleteEmailModalVisible] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');

  const handleDeleteAccount = useCallback(async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // İlk onay
    const firstConfirm = await confirm({
      title: '⚠️ Hesabı Kalıcı Olarak Sil',
      message: 'Bu işlem GERİ ALINAMAZ!\n\nSilinecekler:\n• Tüm notlarınız\n• Tüm kartlarınız\n• Tüm hesaplarınız\n• Tüm IBAN\'larınız\n• Tüm hatırlatıcılarınız\n• Profil fotoğrafınız\n• Hesap bilgileriniz\n\nDevam etmek istiyor musunuz?',
      confirmText: 'Evet, Devam Et',
      cancelText: 'Vazgeç',
      destructive: true,
    });
    if (!firstConfirm) return;

    // Email doğrulama modalını göster
    setDeleteEmailInput('');
    setDeleteEmailModalVisible(true);
  }, [confirm, hapticsEnabled]);

  const handleConfirmDeleteAccount = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        Alert.alert('Hata', 'Kullanıcı bilgisi alınamadı.');
        return;
      }

      if (deleteEmailInput.trim().toLowerCase() !== userData.user.email?.toLowerCase()) {
        Alert.alert('Hata', 'Email adresi eşleşmiyor.');
        return;
      }

      setDeleteEmailModalVisible(false);
      setDeleteAccountLoading(true);

      try {
        const userId = userData.user.id;
        const userEmail = userData.user.email;

        // 1. Tüm kullanıcı verilerini sil
        await Promise.all([
          supabase.from('notes').delete().eq('user_id', userId),
          supabase.from('reminders').delete().eq('user_id', userId),
          supabase.from('cards').delete().eq('user_id', userId),
          supabase.from('accounts').delete().eq('user_id', userId),
          supabase.from('ibans').delete().eq('user_id', userId),
          supabase.from('user_preferences').delete().eq('user_id', userId),
          supabase.from('user_tokens').delete().eq('user_id', userId),
          supabase.from('todos').delete().eq('user_id', userId),
          supabase.from('subscriptions').delete().eq('user_id', userId),
        ]);

        // 2. Avatar'ı storage'dan sil
        try {
          const { data: avatarFiles } = await supabase.storage
            .from('avatars')
            .list(userId);

          if (avatarFiles && avatarFiles.length > 0) {
            const filesToDelete = avatarFiles.map(f => `${userId}/${f.name}`);
            await supabase.storage.from('avatars').remove(filesToDelete);
          }
        } catch (e) {
          console.warn('Avatar silme hatası:', e);
        }

        // 3. Lokal verileri temizle (kullanıcıya özel PIN key'i dahil)
        const userPinKey = `${USER_PIN_KEY}_${userId}`;
        await Promise.all([
          SecureStore.deleteItemAsync(userPinKey),
          SecureStore.deleteItemAsync(PIN_SESSION_KEY),
          SecureStore.deleteItemAsync(`google_drive_token_${userId}`),
          SecureStore.deleteItemAsync('kis_not_kasasi_biometric_enabled'),
          AsyncStorage.removeItem('REMEMBER_EMAIL_KEY'),
          AsyncStorage.removeItem(`REMEMBER_FIRST_NAME_KEY_${userEmail}`),
          AsyncStorage.removeItem(`REMEMBER_AVATAR_URL_KEY_${userEmail}`),
          AsyncStorage.removeItem('kis_not_kasasi_biometric_session'),
          biometricPrefs.setOptIn(false),
          biometricPrefs.setStoredSession(null),
        ]).catch(() => { });

        // 4. Supabase hesabını sil (RPC fonksiyonu gerekli)
        const { error: deleteError } = await supabase.rpc('delete_user_account');

        if (deleteError) {
          console.warn('RPC hatası:', deleteError);
        }

        // 5. Çıkış yap
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Hesap silme hatası:', err);
        Alert.alert('Hata', err.message ?? 'Hesap silinemedi. Lütfen tekrar deneyin.');
      } finally {
        setDeleteAccountLoading(false);
      }
    } catch (err) {
      Alert.alert('Hata', 'Bir sorun oluştu.');
    }
  }, [deleteEmailInput]);

  const handleShareApp = useCallback(async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: 'Keeper - Güvenli not ve şifre yöneticisi. Hemen dene!',
        title: 'Keeper Uygulaması',
      });
    } catch (err) {
      console.log(err);
    }
  }, [hapticsEnabled]);

  const handleContactSupport = useCallback(() => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:destek@ardakaratas.com.tr?subject=Keeper%20Destek');
  }, [hapticsEnabled]);

  const toggleCategory = (category) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCategory(prev => prev === category ? null : category);
  };

  // Kategori tanımları
  const categories = [
    {
      id: 'appearance',
      title: 'Görünüm',
      subtitle: 'Tema ve renk ayarları',
      icon: 'color-palette',
      color: '#8B5CF6',
    },
    {
      id: 'security',
      title: 'Güvenlik',
      subtitle: 'Parmak izi ve giriş ayarları',
      icon: 'shield-checkmark',
      color: '#10B981',
    },
    {
      id: 'notifications',
      title: 'Bildirimler',
      subtitle: 'Bildirim tercihleri',
      icon: 'notifications',
      color: '#F59E0B',
    },
    {
      id: 'preferences',
      title: 'Tercihler',
      subtitle: 'Uygulama davranışları',
      icon: 'settings',
      color: '#6366F1',
    },
    {
      id: 'data',
      title: 'Veri Yönetimi',
      subtitle: 'Önbellek ve veri işlemleri',
      icon: 'server',
      color: '#EF4444',
    },
    {
      id: 'support',
      title: 'Destek',
      subtitle: 'Yardım ve iletişim',
      icon: 'help-circle',
      color: '#3B82F6',
    },
  ];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: accent && theme.colors.backgroundTinted
            ? theme.colors.backgroundTinted
            : (theme.dark ? '#000000' : '#F2F2F7'),
        },
        header: {
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 20,
          backgroundColor: 'transparent',
        },
        headerTop: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        },
        headerTitle: {
          fontSize: 32,
          fontWeight: '700',
          color: theme.dark ? '#FFFFFF' : '#000000',
        },
        headerSubtitle: {
          fontSize: 15,
          color: theme.dark ? '#8E8E93' : '#6D6D72',
        },
        scrollContent: {
          padding: 20,
          paddingTop: 0,
          gap: 12,
        },
        // Category Card (Accordion)
        categoryWrapper: {
          backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
          borderRadius: 16,
          overflow: 'hidden',
        },
        categoryCard: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          gap: 14,
        },
        categoryCardActive: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.dark ? '#38383A' : '#E5E5EA',
        },
        categoryIcon: {
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        categoryContent: {
          flex: 1,
        },
        categoryTitle: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.dark ? '#FFFFFF' : '#000000',
          marginBottom: 2,
        },
        categorySubtitle: {
          fontSize: 14,
          color: theme.dark ? '#8E8E93' : '#6D6D72',
        },
        categoryChevron: {
          opacity: 0.4,
        },
        // Expanded Content
        expandedContent: {
          padding: 16,
          paddingTop: 8,
        },
        innerSettingItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          gap: 12,
        },
        settingLabel: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.dark ? '#8E8E93' : '#6D6D72',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        // Footer
        footer: {
          alignItems: 'center',
          paddingVertical: 32,
          gap: 4,
        },
        footerText: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.dark ? '#48484A' : '#AEAEB2',
        },
        footerVersion: {
          fontSize: 12,
          color: theme.dark ? '#38383A' : '#C7C7CC',
        },
        // Modal
        modalOverlay: {
          flex: 1,
          backgroundColor: theme.dark ? '#000000' : '#F2F2F7',
        },
        modalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
          gap: 12,
        },
        modalBackButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        },
        modalTitle: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.dark ? '#FFFFFF' : '#000000',
        },
        modalContent: {
          flex: 1,
          paddingHorizontal: 20,
        },
        // Settings Items
        settingCard: {
          backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
          borderRadius: 16,
          marginBottom: 16,
          overflow: 'hidden',
        },
        settingItem: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          minHeight: 60,
        },
        settingItemBorder: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.dark ? '#38383A' : '#E5E5EA',
        },
        settingIcon: {
          width: 36,
          height: 36,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        },
        settingContent: {
          flex: 1,
        },
        settingTitle: {
          fontSize: 17,
          fontWeight: '500',
          color: theme.dark ? '#FFFFFF' : '#000000',
        },
        settingSubtitle: {
          fontSize: 14,
          color: theme.dark ? '#8E8E93' : '#6D6D72',
          marginTop: 2,
        },
        // Theme buttons
        themeRow: {
          flexDirection: 'row',
          gap: 10,
          marginBottom: 16,
        },
        themeButton: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 20,
          borderRadius: 12,
          backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
          borderWidth: 2,
          borderColor: 'transparent',
        },
        themeButtonActive: {
          backgroundColor: (accent || theme.colors.primary) + '15',
          borderColor: accent || theme.colors.primary,
        },
        themeButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.dark ? '#8E8E93' : '#6D6D72',
          marginTop: 8,
        },
        themeButtonTextActive: {
          color: accent || theme.colors.primary,
        },
        // Color picker
        colorGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        },
        colorButton: {
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: 'transparent',
        },
        colorButtonActive: {
          borderColor: theme.dark ? '#FFFFFF' : '#000000',
        },
        colorInner: {
          width: 38,
          height: 38,
          borderRadius: 19,
        },
        resetButton: {
          padding: 14,
          borderRadius: 12,
          backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
          alignItems: 'center',
        },
        resetButtonText: {
          fontSize: 15,
          fontWeight: '600',
          color: theme.dark ? '#8E8E93' : '#6D6D72',
        },
        // Danger button
        dangerItem: {
          backgroundColor: '#FF3B3010',
        },
        dangerText: {
          color: '#FF3B30',
        },
      }),
    [theme, accent, insets],
  );

  // Render category content based on id
  const renderCategoryContent = (categoryId) => {
    switch (categoryId) {
      case 'appearance':
        return (
          <View style={styles.expandedContent}>
            <Text style={[styles.settingLabel, { marginBottom: 12 }]}>Tema</Text>
            <View style={styles.themeRow}>
              <TouchableOpacity
                style={[styles.themeButton, mode === 'system' && styles.themeButtonActive]}
                onPress={() => setMode('system')}
              >
                <Ionicons name="phone-portrait" size={24} color={mode === 'system' ? (accent || theme.colors.primary) : (theme.dark ? '#8E8E93' : '#6D6D72')} />
                <Text style={[styles.themeButtonText, mode === 'system' && styles.themeButtonTextActive]}>Sistem</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeButton, mode === 'light' && styles.themeButtonActive]}
                onPress={() => setMode('light')}
              >
                <Ionicons name="sunny" size={24} color={mode === 'light' ? (accent || theme.colors.primary) : (theme.dark ? '#8E8E93' : '#6D6D72')} />
                <Text style={[styles.themeButtonText, mode === 'light' && styles.themeButtonTextActive]}>Açık</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeButton, mode === 'dark' && styles.themeButtonActive]}
                onPress={() => setMode('dark')}
              >
                <Ionicons name="moon" size={24} color={mode === 'dark' ? (accent || theme.colors.primary) : (theme.dark ? '#8E8E93' : '#6D6D72')} />
                <Text style={[styles.themeButtonText, mode === 'dark' && styles.themeButtonTextActive]}>Koyu</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.settingLabel, { marginBottom: 12, marginTop: 8 }]}>Vurgu Rengi</Text>
            <View style={styles.colorGrid}>
              {ACCENT_COLORS.map((item) => (
                <TouchableOpacity
                  key={item.color}
                  style={[styles.colorButton, accent === item.color && styles.colorButtonActive]}
                  onPress={() => {
                    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setAccent(item.color);
                  }}
                >
                  <View style={[styles.colorInner, { backgroundColor: item.color }]} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.resetButton} onPress={() => setAccent(null)}>
              <Text style={styles.resetButtonText}>Varsayılan Renge Dön</Text>
            </TouchableOpacity>
          </View>
        );

      case 'security':
        return (
          <View style={styles.expandedContent}>
            <View style={styles.innerSettingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="finger-print" size={18} color="#10B981" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Parmak İzi ile Giriş</Text>
                <Text style={styles.settingSubtitle}>{loading ? 'Yükleniyor...' : biometricEnabled ? 'Aktif' : 'Kapalı'}</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={biometricEnabled ? disableBiometric : enableBiometric}
                disabled={loading}
                trackColor={{ false: theme.dark ? '#38383A' : '#E5E5EA', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.innerSettingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#6366F120' }]}>
                <MaterialCommunityIcons name="shield-key" size={18} color="#6366F1" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Push to Login</Text>
                <Text style={styles.settingSubtitle}>Web girişinde mobil onay</Text>
              </View>
              <Switch
                value={pushAuthEnabled}
                onValueChange={setPushAuthEnabled}
                trackColor={{ false: theme.dark ? '#38383A' : '#E5E5EA', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {pushAuthEnabled && (
              <View style={styles.innerSettingItem}>
                <View style={[styles.settingIcon, { backgroundColor: '#F59E0B20' }]}>
                  <Ionicons name="finger-print" size={18} color="#F59E0B" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Biyometrik Onay</Text>
                  <Text style={styles.settingSubtitle}>Onaylamadan önce parmak izi iste</Text>
                </View>
                <Switch
                  value={pushAuthRequireBiometric}
                  onValueChange={setPushAuthRequireBiometric}
                  trackColor={{ false: theme.dark ? '#38383A' : '#E5E5EA', true: '#F59E0B' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            )}
          </View>
        );

      case 'notifications':
        return (
          <View style={styles.expandedContent}>
            <View style={styles.innerSettingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="notifications" size={18} color="#F59E0B" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Push Bildirimleri</Text>
                <Text style={styles.settingSubtitle}>{notificationsEnabled ? 'Açık' : 'Kapalı'}</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: theme.dark ? '#38383A' : '#E5E5EA', true: '#F59E0B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.innerSettingItem, !notificationsEnabled && { opacity: 0.4 }]}>
              <View style={[styles.settingIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="volume-high" size={18} color="#3B82F6" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Bildirim Sesi</Text>
                <Text style={styles.settingSubtitle}>{notificationSound ? 'Açık' : 'Kapalı'}</Text>
              </View>
              <Switch
                value={notificationSound}
                onValueChange={toggleNotificationSound}
                disabled={!notificationsEnabled}
                trackColor={{ false: theme.dark ? '#38383A' : '#E5E5EA', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        );

      case 'preferences':
        return (
          <View style={styles.expandedContent}>
            <View style={styles.innerSettingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="phone-portrait" size={18} color="#8B5CF6" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Titreşim</Text>
                <Text style={styles.settingSubtitle}>{hapticsEnabled ? 'Açık' : 'Kapalı'}</Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: theme.dark ? '#38383A' : '#E5E5EA', true: '#8B5CF6' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.innerSettingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#EC489920' }]}>
                <Ionicons name="flash-off" size={18} color="#EC4899" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Animasyonları Azalt</Text>
                <Text style={styles.settingSubtitle}>{reduceMotion ? 'Açık' : 'Kapalı'}</Text>
              </View>
              <Switch
                value={reduceMotion}
                onValueChange={toggleReduceMotion}
                trackColor={{ false: theme.dark ? '#38383A' : '#E5E5EA', true: '#EC4899' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        );

      case 'data':
        return (
          <View style={styles.expandedContent}>
            <TouchableOpacity style={styles.innerSettingItem} onPress={handleClearCache}>
              <View style={[styles.settingIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="trash" size={18} color="#F59E0B" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Önbellek Temizle</Text>
                <Text style={styles.settingSubtitle}>Geçici dosyaları sil</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.dark ? '#48484A' : '#C7C7CC'} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.innerSettingItem, styles.dangerItem]} onPress={handleDeleteAllData}>
              <View style={[styles.settingIcon, { backgroundColor: '#FF3B3020' }]}>
                <Ionicons name="warning" size={18} color="#FF3B30" />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, styles.dangerText]}>Tüm Verileri Sil</Text>
                <Text style={styles.settingSubtitle}>Bu işlem geri alınamaz</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.dark ? '#48484A' : '#C7C7CC'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.innerSettingItem, styles.dangerItem, { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.dark ? '#38383A' : '#E5E5EA', paddingTop: 16 }]}
              onPress={handleDeleteAccount}
              disabled={deleteAccountLoading}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#DC262620' }]}>
                <Ionicons name="skull" size={18} color="#DC2626" />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: '#DC2626', fontWeight: '700' }]}>Hesabı Kalıcı Olarak Sil</Text>
                <Text style={styles.settingSubtitle}>Hesap ve tüm veriler silinir</Text>
              </View>
              {deleteAccountLoading ? (
                <Ionicons name="sync" size={18} color="#DC2626" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.dark ? '#48484A' : '#C7C7CC'} />
              )}
            </TouchableOpacity>
          </View>
        );

      case 'support':
        return (
          <View style={styles.expandedContent}>
            <TouchableOpacity style={styles.innerSettingItem} onPress={handleShareApp}>
              <View style={[styles.settingIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="share-social" size={18} color="#10B981" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Arkadaşlarınla Paylaş</Text>
                <Text style={styles.settingSubtitle}>Keeper'ı öner</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.dark ? '#48484A' : '#C7C7CC'} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.innerSettingItem} onPress={handleContactSupport}>
              <View style={[styles.settingIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="mail" size={18} color="#3B82F6" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Destek</Text>
                <Text style={styles.settingSubtitle}>Bize ulaşın</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.dark ? '#48484A' : '#C7C7CC'} />
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Ayarlar</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <Avatar
              name={session?.user?.user_metadata?.full_name || session?.user?.email}
              imageUrl={session?.user?.user_metadata?.avatar_url}
              size={40}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>Uygulama tercihlerinizi yönetin</Text>
      </View>

      {/* Category List (Accordion) */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {categories.map((category, index) => {
          const isExpanded = activeCategory === category.id;
          return (
            <Animated.View key={category.id} entering={FadeInDown.delay(index * 50).duration(300)}>
              <View style={styles.categoryWrapper}>
                <TouchableOpacity
                  style={[styles.categoryCard, isExpanded && styles.categoryCardActive]}
                  onPress={() => toggleCategory(category.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                    <Ionicons name={category.icon} size={24} color={category.color} />
                  </View>
                  <View style={styles.categoryContent}>
                    <Text style={styles.categoryTitle}>{category.title}</Text>
                    <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.dark ? '#48484A' : '#C7C7CC'}
                    style={styles.categoryChevron}
                  />
                </TouchableOpacity>
                {isExpanded && renderCategoryContent(category.id)}
              </View>
            </Animated.View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Keeper</Text>
          <Text style={styles.footerVersion}>v{APP_VERSION} ({BUILD_NUMBER})</Text>
        </View>
      </ScrollView>

      {/* Email Doğrulama Modal */}
      <Modal
        visible={deleteEmailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteEmailModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 340,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: '#DC2626',
              textAlign: 'center',
              marginBottom: 12,
            }}>Email Doğrulama</Text>
            <Text style={{
              fontSize: 14,
              color: theme.dark ? '#8E8E93' : '#6D6D72',
              textAlign: 'center',
              marginBottom: 20,
            }}>Hesabınızı silmek için email adresinizi yazın</Text>
            <TextInput
              value={deleteEmailInput}
              onChangeText={setDeleteEmailInput}
              placeholder="ornek@email.com"
              placeholderTextColor={theme.dark ? '#48484A' : '#C7C7CC'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: theme.dark ? '#2C2C2E' : '#F2F2F7',
                borderRadius: 10,
                padding: 14,
                fontSize: 16,
                color: theme.dark ? '#FFFFFF' : '#000000',
                marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDeleteEmailModalVisible(false)}
                style={{
                  flex: 1,
                  backgroundColor: theme.dark ? '#2C2C2E' : '#E5E5EA',
                  borderRadius: 10,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.dark ? '#FFFFFF' : '#000000', fontWeight: '600' }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDeleteAccount}
                style={{
                  flex: 1,
                  backgroundColor: '#DC2626',
                  borderRadius: 10,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Devam Et</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SettingsScreen;
