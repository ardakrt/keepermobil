import React, { useMemo, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Animated as RNAnimated, Modal, TextInput, ActivityIndicator, Pressable, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { useAppTheme } from '../lib/theme';
import { useConfirm } from '../lib/confirm';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabaseClient';
import { REMEMBER_FIRST_NAME_KEY } from '../lib/storageKeys';

import Card from '../components/Card';
import Avatar from '../components/Avatar';

const ProfileScreen = ({ navigation }) => {
  const { theme, accent } = useAppTheme();
  
  // Dark modda primary beyaz olduğunda, butonlarda kullanılacak güvenli renk
  const safeButtonColor = accent || (theme.dark ? '#6366F1' : theme.colors.primary);
  const buttonTextColor = accent ? '#fff' : (theme.dark ? '#fff' : '#fff');
  const insets = useSafeAreaInsets();
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Modal states
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [modalInput, setModalInput] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalFocused, setModalFocused] = useState(false);

  // Keyboard animation
  const keyboardOffset = React.useRef(new RNAnimated.Value(0)).current;

  // Animation values for micro-interactions
  const scaleAnims = {
    name: React.useRef(new RNAnimated.Value(1)).current,
    email: React.useRef(new RNAnimated.Value(1)).current,
    password: React.useRef(new RNAnimated.Value(1)).current,
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        showToast('Hata', 'Kullanıcı bilgileri alınamadı.');
        console.error(error);
      } else {
        setUser(data.user);
        setAvatarUrl(data.user.user_metadata.avatar_url);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        RNAnimated.timing(keyboardOffset, {
          toValue: -50,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        RNAnimated.timing(keyboardOffset, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const handleChoosePhoto = async () => {
    try {
      console.log('📷 Fotoğraf seçme başlatılıyor...');
      
      // İzin iste
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('📷 İzin durumu:', permissionResult);
      
      if (permissionResult.granted === false) {
        showToast('İzin Gerekli', 'Galeriye erişim izni vermeniz gerekiyor.');
        return;
      }

      // Galeri aç
      console.log('📷 Galeri açılıyor...');
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      console.log('📷 Picker sonucu:', pickerResult);

      if (pickerResult.canceled) {
        console.log('📷 Kullanıcı iptal etti');
        return;
      }

      if (!pickerResult.assets || pickerResult.assets.length === 0) {
        showToast('Hata', 'Fotoğraf seçilemedi.');
        return;
      }

      const asset = pickerResult.assets[0];
      const uri = asset.uri;
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}.${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      showToast('Yükleniyor', 'Profil fotoğrafınız yükleniyor...');

      // React Native'de blob desteklenmediği için base64 kullanıyoruz
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      console.log('📷 Dosya yükleniyor:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64Data), {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) {
        console.error('📷 Upload hatası:', uploadError);
        showToast('Hata', 'Fotoğraf yüklenemedi: ' + uploadError.message);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('📷 Public URL:', publicUrl);

      const { error: updateUserError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateUserError) {
        console.error('📷 Profil güncelleme hatası:', updateUserError);
        showToast('Hata', 'Profil güncellenemedi: ' + updateUserError.message);
        return;
      }

      setAvatarUrl(publicUrl);
      showToast('Başarılı', 'Profil fotoğrafı güncellendi! 🎉');
      
    } catch (error) {
      console.error('📷 Beklenmeyen hata:', error);
      showToast('Hata', 'Bir sorun oluştu: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  const handleSignOut = () => {
    confirm({
      title: 'Çıkış Yap',
      message: 'Çıkış yapmak istediğinizden emin misiniz?',
      confirmButton: { label: 'Çıkış Yap', color: theme.colors.danger },
      cancelButton: { label: 'İptal' },
    }).then((confirmed) => {
      if (!confirmed) return;
      navigation.goBack();
      supabase.auth.signOut();
      // The onAuthStateChange listener in App.js will handle navigation
    });
  };

  const handleUpdateName = async () => {
    if (!modalInput || modalInput.trim() === '') {
      showToast('Hata', 'İsim boş olamaz.');
      return;
    }
    setModalLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: modalInput }
      });
      if (error) {
        showToast('Hata', error.message);
      } else {
        setUser(data.user);
        showToast('Başarılı', 'İsminiz güncellendi.');
        setNameModalVisible(false);
        try {
          const email = data?.user?.email;
          if (email) {
            await AsyncStorage.setItem(`${REMEMBER_FIRST_NAME_KEY}_${email}`, modalInput.trim());
          }
        } catch {}
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    setModalLoading(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: modalInput },
        { emailRedirectTo: 'https://ardakaratas.com.tr/auth' }
      );
      if (error) {
        showToast('Hata', error.message);
      } else {
        showToast('E-posta Gönderildi', 'Lütfen yeni e-posta adresinizi onaylamak için gelen kutunuzu kontrol edin.');
        setEmailModalVisible(false);
      }
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    // PIN sadece 6 rakam olmalı
    if (modalInput.length !== 6 || !/^\d{6}$/.test(modalInput)) {
        showToast('Hata', 'PIN 6 haneli rakam olmalıdır.');
        return;
    }
    setModalLoading(true);
    try {
      const { error} = await supabase.auth.updateUser({ password: modalInput });
      if (error) {
        showToast('Hata', error.message);
      } else {
        showToast('Başarılı', 'PIN kodunuz güncellendi.');
        setPasswordModalVisible(false);
      }
    } finally {
      setModalLoading(false);
    }
  };

  const openNameModal = () => {
    setModalInput(user?.user_metadata?.full_name || '');
    setNameModalVisible(true);
  };

  const openEmailModal = () => {
    setModalInput(user?.email || '');
    setEmailModalVisible(true);
  };

  const openPasswordModal = () => {
    setModalInput('');
    setPasswordModalVisible(true);
  };

  const animatePress = (key, callback) => {
    RNAnimated.sequence([
      RNAnimated.spring(scaleAnims[key], {
        toValue: 0.95,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      RNAnimated.spring(scaleAnims[key], {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
    ]).start();
    setTimeout(callback, 100);
  };

  const renderEditableItem = (animKey, icon, label, gradientColors, onPress) => {
    // Gradient renkleri düzeltmesi - dark modda primary beyaz ise alternatif kullan
    const safeGradientColors = gradientColors.map(c => {
      if (c.includes(theme.colors.primary) && theme.dark && !accent) {
        return c.replace(theme.colors.primary, '#6366F1');
      }
      return c;
    });
    
    return (
      <RNAnimated.View style={{ transform: [{ scale: scaleAnims[animKey] }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => animatePress(animKey, onPress)}
          style={styles.modernMenuItem}
        >
          <LinearGradient
            colors={safeGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <MaterialCommunityIcons name={icon} size={24} color="#ffffff" />
          </LinearGradient>
          <View style={styles.menuItemContent}>
            <Text style={styles.menuItemLabel}>{label}</Text>
          </View>
          <View style={styles.chevronContainer}>
            <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </RNAnimated.View>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingTop: insets.top + 12,
      paddingBottom: 12,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border + '40',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginLeft: 16,
      letterSpacing: 0.5,
    },
    scrollContainer: {
      padding: 20,
    },
    profileHeader: {
      alignItems: 'center',
      marginBottom: 36,
      paddingTop: 16,
    },
    avatarContainer: {
      marginBottom: 20,
      position: 'relative',
    },
    avatarGradientBorder: {
      padding: 3,
      borderRadius: 68,
      shadowColor: accent || (theme.dark ? '#6366F1' : theme.colors.primary),
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 15,
    },
    avatarInner: {
      borderRadius: 65,
      borderWidth: 5,
      borderColor: theme.colors.background,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 8,
    },
    editAvatarBadge: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: theme.colors.background,
      shadowColor: accent || (theme.dark ? '#6366F1' : theme.colors.primary),
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 8,
    },
    userName: {
      fontSize: 26,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
      letterSpacing: 0.3,
    },
    userEmail: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      letterSpacing: 0.2,
    },
    modernMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border + '60',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    iconGradient: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    menuItemContent: {
      flex: 1,
      marginLeft: 16,
    },
    menuItemLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    chevronContainer: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutButton: {
      marginTop: 24,
      marginBottom: 20,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: theme.colors.danger,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    signOutGradient: {
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOutText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    // Modal styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 340,
      padding: 20,
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    modalIconGradient: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    modalTitleContainer: {
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    modalInputContainer: {
      marginBottom: 20,
    },
    modalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    modalInput: {
      height: 50,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      fontSize: 16,
      color: theme.colors.text,
    },
    modalInputFocused: {
      borderColor: accent || (theme.dark ? '#6366F1' : theme.colors.primary),
    },
    modalButtonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      overflow: 'hidden',
    },
    modalCancelButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    modalButtonContent: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalButtonText: {
      fontWeight: '700',
      fontSize: 16,
    },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {user && (
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              style={styles.avatarContainer} 
              onPress={() => {
                console.log('📷 Avatar tıklandı!');
                handleChoosePhoto();
              }} 
              activeOpacity={0.7}
            >
              <View pointerEvents="none">
                <LinearGradient
                  colors={[safeButtonColor + 'FF', safeButtonColor + 'EE', safeButtonColor + 'BB', safeButtonColor + '88']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1.2, y: 1.2 }}
                  style={styles.avatarGradientBorder}
                >
                  <View style={styles.avatarInner}>
                    <Avatar name={user.user_metadata.full_name || user.email} imageUrl={avatarUrl} size={120} />
                  </View>
                </LinearGradient>
                <LinearGradient
                  colors={[safeButtonColor, safeButtonColor + 'DD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.editAvatarBadge}
                >
                  <MaterialCommunityIcons name="camera" size={18} color="#ffffff" />
                </LinearGradient>
              </View>
            </TouchableOpacity>
            <Text style={styles.userName}>{user.user_metadata.full_name || 'İsimsiz'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        )}

        <View style={{ gap: 0 }}>
          {renderEditableItem(
            'name',
            'account',
            'İsim Değiştir',
            [safeButtonColor, safeButtonColor + 'DD'],
            openNameModal
          )}
          {renderEditableItem(
            'email',
            'email',
            'E-posta Değiştir',
            ['#10b981', '#059669'],
            openEmailModal
          )}
          {renderEditableItem(
            'password',
            'lock',
            'Şifre Değiştir',
            ['#f59e0b', '#d97706'],
            openPasswordModal
          )}
        </View>

        <View style={styles.signOutButton}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleSignOut}>
            <LinearGradient
              colors={[theme.colors.danger, theme.colors.danger + 'DD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signOutGradient}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="logout" size={20} color="#ffffff" />
                <Text style={styles.signOutText}>Çıkış Yap</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Name Modal */}
      <Modal visible={nameModalVisible} transparent animationType="fade" onRequestClose={() => setNameModalVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdrop}>
            <RNAnimated.View style={{ transform: [{ translateY: keyboardOffset }] }}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <Card style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <LinearGradient
                    colors={[safeButtonColor, safeButtonColor + 'DD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalIconGradient}
                  >
                    <MaterialCommunityIcons name="account" size={28} color="#ffffff" />
                  </LinearGradient>
                  <Text style={styles.modalTitle}>İsminizi Değiştirin</Text>
                  <Text style={styles.modalSubtitle}>Bilgilerinizi güncelleyin</Text>
                </View>
                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalLabel}>Yeni İsim</Text>
                  <TextInput
                    style={[styles.modalInput, modalFocused && styles.modalInputFocused]}
                    value={modalInput}
                    onChangeText={setModalInput}
                    onFocus={() => setModalFocused(true)}
                    onBlur={() => setModalFocused(false)}
                    autoFocus
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>
                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setNameModalVisible(false)}
                    disabled={modalLoading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.modalButtonContent}>
                      <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>İptal</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={handleUpdateName}
                    disabled={modalLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[safeButtonColor, safeButtonColor + 'DD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalButtonContent}
                    >
                      {modalLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Kaydet</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                </Card>
              </TouchableWithoutFeedback>
            </RNAnimated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Email Modal */}
      <Modal visible={emailModalVisible} transparent animationType="fade" onRequestClose={() => setEmailModalVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdrop}>
            <RNAnimated.View style={{ transform: [{ translateY: keyboardOffset }] }}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <Card style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalIconGradient}
                  >
                    <MaterialCommunityIcons name="email" size={28} color="#ffffff" />
                  </LinearGradient>
                  <Text style={styles.modalTitle}>E-postanızı Değiştirin</Text>
                  <Text style={styles.modalSubtitle}>Bilgilerinizi güncelleyin</Text>
                </View>
                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalLabel}>Yeni E-posta Adresi</Text>
                  <TextInput
                    style={[styles.modalInput, modalFocused && styles.modalInputFocused]}
                    value={modalInput}
                    onChangeText={setModalInput}
                    onFocus={() => setModalFocused(true)}
                    onBlur={() => setModalFocused(false)}
                    autoFocus
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>
                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setEmailModalVisible(false)}
                    disabled={modalLoading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.modalButtonContent}>
                      <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>İptal</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={handleUpdateEmail}
                    disabled={modalLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#10b981', '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalButtonContent}
                    >
                      {modalLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Kaydet</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                </Card>
              </TouchableWithoutFeedback>
            </RNAnimated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Password Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="fade" onRequestClose={() => setPasswordModalVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdrop}>
            <RNAnimated.View style={{ transform: [{ translateY: keyboardOffset }] }}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <Card style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <LinearGradient
                    colors={['#f59e0b', '#d97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalIconGradient}
                  >
                    <MaterialCommunityIcons name="lock" size={28} color="#ffffff" />
                  </LinearGradient>
                  <Text style={styles.modalTitle}>Yeni Şifre Belirleyin</Text>
                  <Text style={styles.modalSubtitle}>Bilgilerinizi güncelleyin</Text>
                </View>
                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalLabel}>Yeni PIN (6 Haneli)</Text>
                  <TextInput
                    style={[styles.modalInput, modalFocused && styles.modalInputFocused]}
                    value={modalInput}
                    onChangeText={setModalInput}
                    onFocus={() => setModalFocused(true)}
                    onBlur={() => setModalFocused(false)}
                    autoFocus
                    secureTextEntry
                    keyboardType="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>
                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => setPasswordModalVisible(false)}
                    disabled={modalLoading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.modalButtonContent}>
                      <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>İptal</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={handleUpdatePassword}
                    disabled={modalLoading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#f59e0b', '#d97706']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalButtonContent}
                    >
                      {modalLoading ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Kaydet</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                </Card>
              </TouchableWithoutFeedback>
            </RNAnimated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};



export default ProfileScreen;