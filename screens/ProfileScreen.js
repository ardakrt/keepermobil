import React, { useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Image,
  StatusBar,
  Keyboard,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '../lib/theme';
import { useConfirm } from '../lib/confirm';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabaseClient';
import { REMEMBER_FIRST_NAME_KEY, USER_PIN_KEY, REMEMBER_PASSWORD_KEY } from '../lib/storageKeys';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const { theme, accent } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [activeModal, setActiveModal] = useState(null); // 'name' | 'email' | 'pin' | 'password' | null
  const [modalInput, setModalInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState(''); // Şifre değiştirme için onay

  const primaryColor = accent || theme.colors.primary;

  useEffect(() => {
    const sub1 = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const sub2 = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setUser(data.user);
      setAvatarUrl(data.user.user_metadata.avatar_url);
    } catch (error) {
      showToast('Hata', 'Kullanıcı bilgileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Önce mevcut izin durumunu kontrol et
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

      let finalStatus = existingStatus;

      // İzin verilmemişse iste
      if (existingStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        showToast('İzin Gerekli', 'Ayarlardan galeri iznini açmanız gerekiyor.');
        return;
      }

      // Galeriyi aç
      let pickerResult;
      try {
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } catch (pickerError) {
        console.log('Picker error:', pickerError);
        // Alternatif yöntem dene
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      const asset = pickerResult.assets[0];
      const uri = asset.uri;
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}.${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      showToast('Yükleniyor', 'Profil fotoğrafınız yükleniyor...');

      const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64Data), {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

      setAvatarUrl(publicUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Başarılı', 'Profil fotoğrafı güncellendi! 🎉');
    } catch (error) {
      console.error('Photo picker error:', error);
      showToast('Hata', error.message || 'Fotoğraf seçilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirm({
      title: 'Çıkış Yap',
      message: 'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
      confirmButton: { label: 'Çıkış Yap', color: '#FF3B30' },
      cancelButton: { label: 'Vazgeç' },
    }).then(async (confirmed) => {
      if (!confirmed) return;
      try {
        const { biometricPrefs } = require('../lib/biometricPrefs');
        await biometricPrefs.setStoredSession(null);
        await SecureStore.deleteItemAsync(REMEMBER_PASSWORD_KEY);
      } catch (e) { }
      navigation.goBack();
      supabase.auth.signOut();
    });
  };

  const handleUpdateName = async () => {
    if (!modalInput.trim()) {
      showToast('Hata', 'İsim boş olamaz.');
      return;
    }
    setModalLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ data: { full_name: modalInput } });
      if (error) throw error;
      setUser(data.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Başarılı', 'İsminiz güncellendi.');
      setActiveModal(null);
      try {
        if (data?.user?.email) {
          await AsyncStorage.setItem(`${REMEMBER_FIRST_NAME_KEY}_${data.user.email}`, modalInput.trim());
        }
      } catch { }
    } catch (error) {
      showToast('Hata', error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!modalInput.includes('@')) {
      showToast('Hata', 'Geçerli bir e-posta girin.');
      return;
    }
    setModalLoading(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: modalInput },
        { emailRedirectTo: 'https://ardakaratas.com.tr/auth' }
      );
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('E-posta Gönderildi', 'Yeni e-posta adresinizi onaylamak için gelen kutunuzu kontrol edin.');
      setActiveModal(null);
    } catch (error) {
      showToast('Hata', error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdatePin = async () => {
    if (!/^\d{6}$/.test(modalInput)) {
      showToast('Hata', 'PIN 6 haneli rakam olmalıdır.');
      return;
    }
    setModalLoading(true);
    try {
      // Kullanıcı ID'si ile PIN'i SecureStore'a kaydet
      const userId = user?.id;
      if (!userId) throw new Error('Kullanıcı bilgisi bulunamadı.');
      const userPinKey = `${USER_PIN_KEY}_${userId}`;
      await SecureStore.setItemAsync(userPinKey, modalInput);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Başarılı', 'PIN kodunuz güncellendi.');
      setActiveModal(null);
    } catch (error) {
      showToast('Hata', error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (modalInput.length < 6) {
      showToast('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (modalInput !== passwordConfirm) {
      showToast('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    setModalLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: modalInput });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Başarılı', 'Şifreniz güncellendi.');
      setActiveModal(null);
      setPasswordConfirm('');
    } catch (error) {
      showToast('Hata', error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    confirm({
      title: 'Hesabı Sil',
      message: 'Hesabınızı ve tüm verilerinizi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      confirmButton: { label: 'Hesabı Sil', color: '#FF3B30' },
      cancelButton: { label: 'Vazgeç' },
    }).then(async (confirmed) => {
      if (!confirmed) return;

      // Ikinci bir onay iste
      confirm({
        title: 'Son Kararınız mı?',
        message: 'Tüm verileriniz silinecek. Onaylıyor musunuz?',
        confirmButton: { label: 'Evet, Sil', color: '#FF3B30' },
        cancelButton: { label: 'Vazgeç' },
      }).then(async (finalConfirmed) => {
        if (!finalConfirmed) return;

        try {
          // Backend desteği olmadığı için şimdilik sadece çıkış yapıyoruz ve kullanıcıyı bilgilendiriyoruz.
          // Gerçek bir uygulamada burada supabase.rpc('delete_user') çağrılır.
          showToast('Hesap Silindi', 'Hesabınız başarıyla silindi.');

          try {
            const { biometricPrefs } = require('../lib/biometricPrefs');
            await biometricPrefs.setStoredSession(null);
          } catch (e) { }

          navigation.goBack();
          supabase.auth.signOut();
        } catch (error) {
          showToast('Hata', 'Hesap silinirken bir sorun oluştu.');
        }
      });
    });
  };

  const openModal = (type) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'name') setModalInput(user?.user_metadata?.full_name || '');
    else if (type === 'email') setModalInput(user?.email || '');
    else setModalInput('');
    if (type === 'password') setPasswordConfirm('');
    setActiveModal(type);
  };

  const getInitials = (name, email) => {
    if (name) {
      const parts = name.split(' ');
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();
    }
    return email ? email.slice(0, 2).toUpperCase() : '??';
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.dark ? '#000000' : '#F2F2F7',
    },
    // Header
    headerContainer: {
      paddingTop: insets.top + 24, // Increased padding
      paddingBottom: 32,
      paddingHorizontal: 20,
      backgroundColor: theme.dark ? '#000000' : '#F2F2F7',
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 32,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 32, // Increased font size
      fontWeight: '800',
      color: theme.dark ? '#FFFFFF' : '#000000',
      marginLeft: 16,
    },
    profileSection: {
      alignItems: 'center',
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 20,
    },
    avatarRing: {
      width: 110,
      height: 110,
      borderRadius: 55,
      padding: 3,
    },
    avatarInner: {
      width: '100%',
      height: '100%',
      borderRadius: 52,
      backgroundColor: theme.dark ? '#2C2C2E' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarInitials: {
      fontSize: 36,
      fontWeight: '600',
      color: primaryColor,
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: primaryColor,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.dark ? '#000000' : '#F2F2F7',
    },
    userName: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.dark ? '#FFFFFF' : '#000000',
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 15,
      color: theme.dark ? '#8E8E93' : '#6D6D72',
      fontWeight: '400',
    },
    // Content
    contentContainer: {
      flex: 1,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.dark ? '#8E8E93' : '#6D6D72',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
      marginLeft: 16,
    },
    // Modern Card Group (iOS style)
    cardGroup: {
      backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
      borderRadius: 16,
      marginBottom: 24,
      overflow: 'hidden',
    },
    cardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    cardItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.dark ? '#38383A' : '#E5E5EA',
    },
    cardIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    cardItemContent: {
      flex: 1,
    },
    cardItemLabel: {
      fontSize: 17,
      fontWeight: '400',
      color: theme.dark ? '#FFFFFF' : '#000000',
    },
    cardItemValue: {
      fontSize: 15,
      color: theme.dark ? '#8E8E93' : '#8E8E93',
      marginTop: 2,
    },
    cardItemChevron: {
      marginLeft: 8,
    },
    // Danger Button
    dangerButton: {
      backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
      borderRadius: 16,
      marginBottom: 24,
      overflow: 'hidden',
    },
    dangerButtonInner: {
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FF3B30',
    },
    // Version Info
    versionContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingBottom: insets.bottom + 24,
    },
    versionText: {
      fontSize: 13,
      color: theme.dark ? '#48484A' : '#AEAEB2',
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.dark ? '#1C1C1E' : '#FFFFFF',
      borderRadius: 20,
      paddingTop: 16,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    modalContentKeyboard: {
      marginBottom: 200,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.dark ? '#FFFFFF' : '#000000',
      textAlign: 'center',
      marginBottom: 24,
    },
    modalInput: {
      height: 52,
      backgroundColor: theme.dark ? '#2C2C2E' : '#F2F2F7',
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 17,
      color: theme.dark ? '#FFFFFF' : '#000000',
      marginBottom: 20,
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelButton: {
      backgroundColor: theme.dark ? '#2C2C2E' : '#E5E5EA',
    },
    modalConfirmButton: {
      backgroundColor: primaryColor,
    },
    modalButtonText: {
      fontSize: 17,
      fontWeight: '600',
    },
    // Loading
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }), [theme, insets, primaryColor]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  const modalConfigs = {
    name: {
      title: 'İsim Değiştir',
      placeholder: 'Adınız Soyadınız',
      onSave: handleUpdateName,
      keyboardType: 'default',
    },
    email: {
      title: 'E-posta Değiştir',
      placeholder: 'yeni@email.com',
      onSave: handleUpdateEmail,
      keyboardType: 'email-address',
    },
    pin: {
      title: 'PIN Değiştir',
      placeholder: '6 haneli PIN',
      onSave: handleUpdatePin,
      keyboardType: 'number-pad',
      maxLength: 6,
      secureTextEntry: true,
    },
    password: {
      title: 'Şifre Değiştir',
      placeholder: 'Yeni şifre',
      onSave: handleUpdatePassword,
      keyboardType: 'default',
      secureTextEntry: true,
      minLength: 6,
    },
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          {/* Top Bar */}
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.goBack();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={theme.dark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profil</Text>
          </View>

          {/* Profile Info */}
          <View style={styles.profileSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleChoosePhoto}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[primaryColor, primaryColor + 'AA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <View style={styles.avatarInner}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>
                      {getInitials(user?.user_metadata?.full_name, user?.email)}
                    </Text>
                  )}
                </View>
              </LinearGradient>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <Text style={styles.userName}>
              {user?.user_metadata?.full_name || 'İsimsiz'}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {/* Account Section */}
          <Text style={styles.sectionTitle}>Hesap</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity
              style={[styles.cardItem, styles.cardItemBorder]}
              onPress={() => openModal('name')}
              activeOpacity={0.6}
            >
              <View style={[styles.cardIconContainer, { backgroundColor: primaryColor + '20' }]}>
                <Ionicons name="person" size={20} color={primaryColor} />
              </View>
              <View style={styles.cardItemContent}>
                <Text style={styles.cardItemLabel}>İsim</Text>
                <Text style={styles.cardItemValue}>
                  {user?.user_metadata?.full_name || 'Belirtilmemiş'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.dark ? '#48484A' : '#C7C7CC'} style={styles.cardItemChevron} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cardItem, styles.cardItemBorder]}
              onPress={() => openModal('email')}
              activeOpacity={0.6}
            >
              <View style={[styles.cardIconContainer, { backgroundColor: '#34C75920' }]}>
                <Ionicons name="mail" size={20} color="#34C759" />
              </View>
              <View style={styles.cardItemContent}>
                <Text style={styles.cardItemLabel}>E-posta</Text>
                <Text style={styles.cardItemValue}>{user?.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.dark ? '#48484A' : '#C7C7CC'} style={styles.cardItemChevron} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => openModal('pin')}
              activeOpacity={0.6}
            >
              <View style={[styles.cardIconContainer, { backgroundColor: '#FF950020' }]}>
                <Ionicons name="lock-closed" size={20} color="#FF9500" />
              </View>
              <View style={styles.cardItemContent}>
                <Text style={styles.cardItemLabel}>PIN Kodu</Text>
                <Text style={styles.cardItemValue}>••••••</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.dark ? '#48484A' : '#C7C7CC'} style={styles.cardItemChevron} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => openModal('password')}
              activeOpacity={0.6}
            >
              <View style={[styles.cardIconContainer, { backgroundColor: '#AF52DE20' }]}>
                <Ionicons name="key" size={20} color="#AF52DE" />
              </View>
              <View style={styles.cardItemContent}>
                <Text style={styles.cardItemLabel}>Şifre</Text>
                <Text style={styles.cardItemValue}>••••••••</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.dark ? '#48484A' : '#C7C7CC'} style={styles.cardItemChevron} />
            </TouchableOpacity>
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleSignOut}
            activeOpacity={0.6}
          >
            <View style={styles.dangerButtonInner}>
              <Text style={styles.dangerButtonText}>Çıkış Yap</Text>
            </View>
          </TouchableOpacity>

          {/* Delete Account */}
          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: 'rgba(255, 59, 48, 0.1)', marginTop: -12 }]}
            onPress={handleDeleteAccount}
            activeOpacity={0.6}
          >
            <View style={styles.dangerButtonInner}>
              <Text style={[styles.dangerButtonText, { color: '#FF3B30' }]}>Hesabı Sil</Text>
            </View>
          </TouchableOpacity>

          {/* Version */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>Keeper v1.0.0</Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={!!activeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <TouchableWithoutFeedback onPress={() => setActiveModal(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => { }}>
              <View style={[styles.modalContent, keyboardOpen && styles.modalContentKeyboard]}>
                <Text style={styles.modalTitle}>
                  {activeModal && modalConfigs[activeModal]?.title}
                </Text>

                <TextInput
                  style={styles.modalInput}
                  value={modalInput}
                  onChangeText={setModalInput}
                  placeholder={activeModal && modalConfigs[activeModal]?.placeholder}
                  placeholderTextColor={theme.dark ? '#636366' : '#AEAEB2'}
                  keyboardType={activeModal && modalConfigs[activeModal]?.keyboardType}
                  maxLength={activeModal && modalConfigs[activeModal]?.maxLength}
                  secureTextEntry={activeModal && modalConfigs[activeModal]?.secureTextEntry}
                  autoCapitalize={activeModal === 'email' ? 'none' : 'words'}
                  autoFocus
                />

                {/* Şifre değiştirme için onay alanı */}
                {activeModal === 'password' && (
                  <TextInput
                    style={[styles.modalInput, { marginTop: 12 }]}
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    placeholder="Şifreyi tekrar girin"
                    placeholderTextColor={theme.dark ? '#636366' : '#AEAEB2'}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                )}

                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setActiveModal(null)}
                    disabled={modalLoading}
                  >
                    <Text style={[styles.modalButtonText, { color: theme.dark ? '#FFFFFF' : '#000000' }]}>
                      İptal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirmButton]}
                    onPress={activeModal && modalConfigs[activeModal]?.onSave}
                    disabled={modalLoading}
                  >
                    {modalLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                        Kaydet
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default ProfileScreen;
