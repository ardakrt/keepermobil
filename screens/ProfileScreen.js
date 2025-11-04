import React, { useMemo, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAppTheme } from '../lib/theme';
import { useConfirm } from '../lib/confirm';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabaseClient';
import { REMEMBER_FIRST_NAME_KEY } from '../lib/storageKeys';

import Card from '../components/Card';
import Avatar from '../components/Avatar';
import InputModal from '../components/InputModal';

const ProfileScreen = ({ navigation }) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [modalConfig, setModalConfig] = useState({ visible: false });

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

  const handleChoosePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('İzin Gerekli', 'Profil fotoğrafı seçmek için galeriye erişim izni vermeniz gerekiyor.');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (pickerResult.canceled) {
      return;
    }

    const asset = pickerResult.assets[0];
    const uri = asset.uri;
    const fileExt = uri.split('.').pop();
    const fileName = `${user.id}.${new Date().getTime()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const formData = new FormData();
    formData.append('file', {
      uri: uri,
      name: fileName,
      type: asset.type ? `${asset.type}/${fileExt}` : `image/${fileExt}`,
    });

    showToast('Yükleniyor...', 'Profil fotoğrafınız yükleniyor...');

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, formData, {
        upsert: true,
      });

    if (uploadError) {
      showToast('Hata', 'Fotoğraf yüklenemedi: ' + uploadError.message);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const { error: updateUserError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl }
    });

    if (updateUserError) {
      showToast('Hata', 'Profil güncellenemedi: ' + updateUserError.message);
      return;
    }

    setAvatarUrl(publicUrl);
    showToast('Başarılı', 'Profil fotoğrafı güncellendi.');
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

  const handleUpdateName = async (newName) => {
    if (!newName || newName.trim() === '') {
      showToast('Hata', 'İsim boş olamaz.');
      return;
    }
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: newName }
    });
    if (error) {
      showToast('Hata', error.message);
    } else {
      setUser(data.user);
      showToast('Başarılı', 'İsminiz güncellendi.');
      setModalConfig({ visible: false });
      try {
        const email = data?.user?.email;
        if (email) {
          await AsyncStorage.setItem(`${REMEMBER_FIRST_NAME_KEY}_${email}`, newName.trim());
        }
      } catch {}
    }
  };

  const handleUpdateEmail = async (newEmail) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      showToast('Hata', error.message);
    } else {
      showToast('E-posta Gönderildi', 'Lütfen yeni e-posta adresinizi onaylamak için gelen kutunuzu kontrol edin.');
      setModalConfig({ visible: false });
    }
  };

  const handleUpdatePassword = async (newPassword) => {
    if (newPassword.length < 6) {
        showToast('Hata', 'Şifre en az 6 karakter olmalıdır.');
        return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      showToast('Hata', error.message);
    } else {
      showToast('Başarılı', 'Şifreniz güncellendi.');
      setModalConfig({ visible: false });
    }
  };

  const openModal = (config) => {
    setModalConfig({ ...config, visible: true });
  }

  const renderEditableItem = (icon, label, onPress) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Feather name={icon} size={22} color={theme.colors.muted} />
      <Text style={styles.menuItemText}>{label}</Text>
      <Feather name="chevron-right" size={22} color={theme.colors.muted} />
    </TouchableOpacity>
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingTop: insets.top + 16,
      paddingBottom: 16,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      marginLeft: 16,
    },
    scrollContainer: {
      padding: 20,
    },
    profileHeader: {
      alignItems: 'center',
      marginBottom: 32,
    },
    avatarContainer: {
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 5,
      elevation: 10,
    },
    userName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    userEmail: {
      fontSize: 16,
      color: theme.colors.muted,
      marginTop: 4,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
    },
    menuItemText: {
      flex: 1,
      marginLeft: 16,
      fontSize: 17,
      color: theme.colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: 20,
    },
    signOutButton: {
      marginTop: 32,
      backgroundColor: theme.colors.danger,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    signOutText: {
      color: theme.colors.background,
      fontSize: 16,
      fontWeight: 'bold',
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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {user && (
          <View style={styles.profileHeader}>
            <TouchableOpacity style={styles.avatarContainer} onPress={handleChoosePhoto}>
              <Avatar name={user.user_metadata.full_name || user.email} imageUrl={avatarUrl} size={120} />
            </TouchableOpacity>
            <Text style={styles.userName}>{user.user_metadata.full_name || 'İsimsiz'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        )}

        <Card style={{ padding: 0, gap: 0 }}>
          {renderEditableItem('user', 'İsim Değiştir', () => openModal({ title: 'İsminizi Değiştirin', label: 'Yeni İsim', initialValue: user?.user_metadata?.full_name, onSubmit: handleUpdateName }))}
          <View style={styles.divider} />
          {renderEditableItem('mail', 'E-posta Değiştir', () => openModal({ title: 'E-postanızı Değiştirin', label: 'Yeni E-posta Adresi', initialValue: user?.email, onSubmit: handleUpdateEmail }))}
          <View style={styles.divider} />
          {renderEditableItem('lock', 'Şifre Değiştir', () => openModal({ title: 'Yeni Şifre Belirleyin', label: 'Yeni Şifre', secureTextEntry: true, onSubmit: handleUpdatePassword }))}
        </Card>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
      <InputModal {...modalConfig} onClose={() => setModalConfig({ visible: false })} />
    </View>
  );
};



export default ProfileScreen;