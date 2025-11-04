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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabaseClient';
import { biometricPrefs } from '../lib/biometricPrefs';
import { localAuth } from '../lib/localAuth';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import Avatar from '../components/Avatar';

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

  // Session bilgisini al
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
      const session = await biometricPrefs.getStoredSession();

      setBiometricEnabled(optIn);
      setHasBiometricSession(!!session);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBiometricState();
  }, [loadBiometricState]);

  const enableBiometric = useCallback(async () => {
    if (!biometricSupported) {
      Alert.alert('Desteklenmiyor', 'Bu cihaz biyometrik kimlik doğrulamayı desteklemiyor.');
      return;
    }
    if (!biometricEnrolled) {
      Alert.alert('Kayıtlı değil', 'Lütfen cihaz ayarlarınızdan parmak izi/yüz tanıma kaydedin.');
      return;
    }

    try {
      const result = await localAuth.authenticateAsync({ promptMessage: 'Parmak izi ile giriş yapın' });
      if (!result.success) {
        Alert.alert('İptal edildi', 'Parmak izi doğrulaması iptal edildi.');
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        Alert.alert('Hata', 'Oturum bilgisi alınamadı.');
        return;
      }

      await biometricPrefs.setOptIn(true);
      await biometricPrefs.setStoredSession(data.session);

      showToast('Başarılı', 'Parmak izi ile giriş aktif edildi');
      await loadBiometricState();
    } catch (err) {
      Alert.alert('Hata', err.message ?? 'Parmak izi aktif edilemedi.');
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: accent && theme.colors.backgroundTinted
            ? theme.colors.backgroundTinted
            : theme.colors.background,
        },
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
        scrollContent: {
          padding: 16,
          paddingBottom: 120,
          gap: 12,
        },
        sectionCard: {
          backgroundColor: accent && theme.colors.surfaceTinted
            ? theme.colors.surfaceTinted
            : theme.colors.surface,
          borderRadius: 16,
          padding: 4,
          borderWidth: 1,
          borderColor: accent && theme.colors.borderTinted
            ? theme.colors.borderTinted
            : theme.colors.border,
          overflow: 'hidden',
        },
        sectionTitle: {
          fontSize: 13,
          fontWeight: '700',
          color: theme.colors.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
        },
        settingItem: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          minHeight: 64,
          borderRadius: 12,
          backgroundColor: 'transparent',
        },
        settingItemActive: {
          backgroundColor: accent && theme.colors.surfaceElevatedTinted
            ? theme.colors.surfaceElevatedTinted
            : theme.colors.surfaceElevated,
        },
        iconContainer: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        settingContent: {
          flex: 1,
          justifyContent: 'center',
        },
        settingTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: 2,
        },
        settingSubtitle: {
          fontSize: 13,
          color: theme.colors.textSecondary,
        },
        themeRow: {
          flexDirection: 'row',
          padding: 12,
          gap: 8,
        },
        themeButton: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 16,
          borderRadius: 12,
          backgroundColor: accent && theme.colors.surfaceElevatedTinted
            ? theme.colors.surfaceElevatedTinted
            : theme.colors.surfaceElevated,
          borderWidth: 2,
          borderColor: 'transparent',
        },
        themeButtonActive: {
          backgroundColor: theme.colors.primary + '20',
          borderColor: theme.colors.primary,
        },
        themeButtonText: {
          fontSize: 12,
          fontWeight: '600',
          color: theme.colors.textSecondary,
          marginTop: 4,
        },
        themeButtonTextActive: {
          color: theme.colors.primary,
          fontWeight: '700',
        },
        colorPicker: {
          padding: 12,
          gap: 12,
        },
        colorRow: {
          flexDirection: 'row',
          gap: 12,
          flexWrap: 'wrap',
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
          borderColor: theme.colors.text,
        },
        colorButtonInner: {
          width: 38,
          height: 38,
          borderRadius: 19,
        },
        resetButton: {
          padding: 12,
          borderRadius: 8,
          backgroundColor: accent && theme.colors.surfaceElevatedTinted
            ? theme.colors.surfaceElevatedTinted
            : theme.colors.surfaceElevated,
          alignItems: 'center',
        },
        resetButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.textSecondary,
        },
      }),
    [theme, accent, insets],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        <View style={styles.keeperTitle}>
          <View style={styles.keeperIcon}>
            <MaterialCommunityIcons name="cog" size={22} color={theme.colors.primary} />
          </View>
          <Text style={styles.keeperText}>Keeper</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.profileButton}
          activeOpacity={0.7}
        >
          <Avatar
            name={session?.user?.user_metadata?.full_name || session?.user?.email}
            imageUrl={session?.user?.user_metadata?.avatar_url}
            size={40}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Güvenlik */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Güvenlik</Text>

          <TouchableOpacity
            style={[styles.settingItem, biometricEnabled && styles.settingItemActive]}
            onPress={biometricEnabled ? disableBiometric : enableBiometric}
            disabled={loading}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="finger-print" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Parmak İzi ile Giriş</Text>
              <Text style={styles.settingSubtitle}>
                {loading ? 'Yükleniyor...' : biometricEnabled ? 'Aktif' : 'Kapalı'}
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={biometricEnabled ? disableBiometric : enableBiometric}
              disabled={loading}
              trackColor={{ false: theme.colors.muted, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Görünüm */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Görünüm</Text>

          <View style={styles.themeRow}>
            <TouchableOpacity
              style={[styles.themeButton, mode === 'system' && styles.themeButtonActive]}
              onPress={() => setMode('system')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="phone-portrait"
                size={24}
                color={mode === 'system' ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[styles.themeButtonText, mode === 'system' && styles.themeButtonTextActive]}>
                Sistem
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeButton, mode === 'light' && styles.themeButtonActive]}
              onPress={() => setMode('light')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="sunny"
                size={24}
                color={mode === 'light' ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[styles.themeButtonText, mode === 'light' && styles.themeButtonTextActive]}>
                Açık
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeButton, mode === 'dark' && styles.themeButtonActive]}
              onPress={() => setMode('dark')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="moon"
                size={24}
                color={mode === 'dark' ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[styles.themeButtonText, mode === 'dark' && styles.themeButtonTextActive]}>
                Koyu
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.colorPicker}>
            <Text style={[styles.settingTitle, { paddingHorizontal: 0 }]}>Vurgu Rengi</Text>
            <View style={styles.colorRow}>
              {ACCENT_COLORS.map((item) => (
                <TouchableOpacity
                  key={item.color}
                  style={[
                    styles.colorButton,
                    accent === item.color && styles.colorButtonActive,
                  ]}
                  onPress={() => {
                    if (hapticsEnabled) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setAccent(item.color);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.colorButtonInner, { backgroundColor: item.color }]} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => setAccent(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.resetButtonText}>Varsayılan Renge Dön</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Tercihler */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tercihler</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleToggleHaptics}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="phone-portrait" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Haptik Geri Bildirim</Text>
              <Text style={styles.settingSubtitle}>{hapticsEnabled ? 'Açık' : 'Kapalı'}</Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={handleToggleHaptics}
              trackColor={{ false: theme.colors.muted, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={toggleReduceMotion}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="flash-off" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Animasyonları Azalt</Text>
              <Text style={styles.settingSubtitle}>{reduceMotion ? 'Açık' : 'Kapalı'}</Text>
            </View>
            <Switch
              value={reduceMotion}
              onValueChange={toggleReduceMotion}
              trackColor={{ false: theme.colors.muted, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Bildirimler */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Bildirimler</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={toggleNotifications}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="notifications" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Push Bildirimleri</Text>
              <Text style={styles.settingSubtitle}>{notificationsEnabled ? 'Açık' : 'Kapalı'}</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: theme.colors.muted, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={toggleNotificationSound}
            disabled={!notificationsEnabled}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="volume-high" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, !notificationsEnabled && { color: theme.colors.muted }]}>
                Bildirim Sesi
              </Text>
              <Text style={styles.settingSubtitle}>{notificationSound ? 'Açık' : 'Kapalı'}</Text>
            </View>
            <Switch
              value={notificationSound}
              onValueChange={toggleNotificationSound}
              disabled={!notificationsEnabled}
              trackColor={{ false: theme.colors.muted, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Veri Yönetimi */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Veri Yönetimi</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.warning + '20' }]}>
              <Ionicons name="trash" size={22} color={theme.colors.warning} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Önbellek Temizle</Text>
              <Text style={styles.settingSubtitle}>Geçici dosyaları sil</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleDeleteAllData}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.danger + '20' }]}>
              <Ionicons name="warning" size={22} color={theme.colors.danger} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: theme.colors.danger }]}>Tüm Verileri Sil</Text>
              <Text style={styles.settingSubtitle}>Geri alınamaz</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
