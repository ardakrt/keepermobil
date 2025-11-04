import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import { supabase } from '../lib/supabaseClient';
import { useAppTheme } from '../lib/theme';
import { useToast } from '../lib/toast';
import { usePrefs } from '../lib/prefs';
import { useConfirm } from '../lib/confirm';

import AccountActionSheet from '../components/AccountActionSheet';
import AccountEditModal from '../components/AccountEditModal';

const getServiceIcon = (service) => {
  const s = service.toLowerCase();
  if (s.includes('google') || s.includes('gmail')) return 'logo-google';
  if (s.includes('facebook')) return 'logo-facebook';
  if (s.includes('twitter') || s.includes('x')) return 'logo-twitter';
  if (s.includes('instagram')) return 'logo-instagram';
  if (s.includes('linkedin')) return 'logo-linkedin';
  if (s.includes('github')) return 'logo-github';
  if (s.includes('apple')) return 'logo-apple';
  if (s.includes('microsoft')) return 'logo-microsoft';
  if (s.includes('netflix')) return 'logo-netflix';
  if (s.includes('spotify')) return 'logo-spotify';
  if (s.includes('amazon')) return 'logo-amazon';
  return 'person-circle';
};

const getServiceIconColor = (service) => {
  const s = service.toLowerCase();
  if (s.includes('google') || s.includes('gmail')) return '#4285F4';
  if (s.includes('facebook')) return '#1877F2';
  if (s.includes('twitter') || s.includes('x')) return '#1DA1F2';
  if (s.includes('instagram')) return '#E4405F';
  if (s.includes('linkedin')) return '#0A66C2';
  if (s.includes('github')) return '#181717';
  if (s.includes('apple')) return '#000000';
  if (s.includes('microsoft')) return '#00A4EF';
  if (s.includes('netflix')) return '#E50914';
  if (s.includes('spotify')) return '#1DB954';
  if (s.includes('amazon')) return '#FF9900';
  return null;
};

const AccountsScreen = () => {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: 'transparent',
        },
        searchContainer: {
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 8,
        },
        searchInput: {
          height: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceElevated,
          color: theme.colors.text,
          paddingHorizontal: 14,
          fontSize: 15,
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
        errorContainer: {
          backgroundColor: theme.colors.dangerLight,
          padding: 16,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginHorizontal: 20,
          marginTop: 8,
          marginBottom: 12,
        },
        errorText: {
          flex: 1,
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.danger,
        },
        accountItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: accent && theme.colors.surfaceTinted
            ? theme.colors.surfaceTinted
            : theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: accent && theme.colors.borderTinted
            ? theme.colors.borderTinted
            : theme.colors.border,
          gap: 16,
        },
        iconContainer: {
          height: 44,
          width: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: accent && theme.colors.surfaceElevatedTinted
            ? theme.colors.surfaceElevatedTinted
            : theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: accent && theme.colors.borderTinted
            ? theme.colors.borderTinted
            : theme.colors.border,
        },
        accountInfo: {
          flex: 1,
        },
        accountLabel: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: 4,
        },
        accountUsername: {
          fontSize: 14,
          color: theme.colors.textSecondary,
        },
        chevron: {
          marginLeft: 8,
        },
        addButtonContainer: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          paddingBottom: 100,
          backgroundColor: 'transparent',
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
      }),
    [theme, accent]
  );

  const [userId, setUserId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Action Sheet State
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editMode, setEditMode] = useState('add');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const currentUser = userData?.user;
      if (!currentUser) {
        setError('Oturum bulunamadı. Tekrar giriş yapın.');
        setAccounts([]);
        return;
      }

      setUserId(currentUser.id);

      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('id, user_id, service, username_enc, password_enc, note, created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (accountsError) throw accountsError;

      setAccounts(accountsData ?? []);
    } catch (err) {
      console.warn('Fetch accounts failed', err);
      setError(err.message ?? 'Hesaplar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('accounts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchAccounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchAccounts]);

  const handleAccountPress = (account) => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedAccount(account);
    setShowActionSheet(true);
  };

  const handleAddAccount = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setEditMode('add');
    setEditingAccount(null);
    setShowEditModal(true);
  };

  const handleEditAccount = (account) => {
    setEditMode('edit');
    setEditingAccount(account);
    setShowEditModal(true);
  };

  const handleCopyUsername = async (account) => {
    try {
      await Clipboard.setStringAsync(account.username_enc ?? '');
      showToast('Kullanıcı adı panoya kopyalandı.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Copy failed', err);
      showToast('Kopyalama başarısız oldu.');
    }
  };

  const handleCopyPassword = async (account) => {
    try {
      await Clipboard.setStringAsync(account.password_enc ?? '');
      showToast('Parola panoya kopyalandı.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Copy failed', err);
      showToast('Kopyalama başarısız oldu.');
    }
  };

  const handleShare = async (account) => {
    try {
      const message = `${account.service}\n\nKullanıcı Adı: ${account.username_enc}\nParola: ${account.password_enc}${
        account.note ? `\n\nNot: ${account.note}` : ''
      }`;

      await Share.share({
        message: message,
        title: `${account.service} - Hesap Bilgisi`,
      });

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Share failed', err);
      showToast('Paylaşım başarısız oldu.');
    }
  };

  const handleDeleteAccount = async (account) => {
    const confirmed = await confirm(
      'Hesabı Sil',
      `"${account.service}" hesabını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
    );

    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase.from('accounts').delete().eq('id', account.id);

      if (deleteError) throw deleteError;

      setAccounts((prev) => prev.filter((item) => item.id !== account.id));
      showToast('Hesap başarıyla silindi.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Delete account failed', err);
      showToast('Hesap silinemedi.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleSaveAccount = async (accountData, accountId) => {
    if (!userId) {
      throw new Error('Oturum bulunamadı. Tekrar giriş yapın.');
    }

    const payload = {
      ...accountData,
      user_id: userId,
    };

    if (accountId) {
      // Update existing account
      const { data, error: updateError } = await supabase
        .from('accounts')
        .update(payload)
        .eq('id', accountId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      setAccounts((prev) => prev.map((a) => (a.id === accountId ? data : a)));
      showToast('Hesap güncellendi.');
    } else {
      // Insert new account
      const { data, error: insertError } = await supabase
        .from('accounts')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) throw insertError;

      setAccounts((prev) => [data, ...prev]);
      showToast('Hesap başarıyla eklendi.');
    }
  };

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;

    return accounts.filter(
      (a) =>
        (a.service || '').toLowerCase().includes(q) ||
        (a.username_enc || '').toLowerCase().includes(q) ||
        (a.note || '').toLowerCase().includes(q)
    );
  }, [accounts, search]);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Ara: hizmet, kullanıcı adı veya not"
          placeholderTextColor={theme.colors.muted}
        />
      </View>

      {/* Error */}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : filteredAccounts.length === 0 ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.emptyContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={80}
              color={theme.colors.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {search ? 'Sonuç bulunamadı' : 'Henüz hesap yok'}
            </Text>
            <Text style={styles.emptyText}>
              {search
                ? 'Arama kriterlerinize uygun hesap bulunamadı.'
                : 'Hesap bilgilerinizi güvenle saklayın. Yeni hesap eklemek için aşağıdaki butona dokunun.'}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filteredAccounts.map((account) => {
            const iconColor = getServiceIconColor(account.service);

            return (
              <TouchableOpacity
                key={account.id}
                style={styles.accountItem}
                onPress={() => handleAccountPress(account)}
                activeOpacity={0.7}
              >
                {/* Service Icon */}
                <View
                  style={[
                    styles.iconContainer,
                    iconColor && { backgroundColor: iconColor + '15', borderColor: iconColor + '30' },
                  ]}
                >
                  <Ionicons
                    name={getServiceIcon(account.service)}
                    size={24}
                    color={iconColor || theme.colors.text}
                  />
                </View>

                {/* Account Info */}
                <View style={styles.accountInfo}>
                  <Text style={styles.accountLabel} numberOfLines={1}>
                    {account.service}
                  </Text>
                  <Text style={styles.accountUsername} numberOfLines={1}>
                    {account.username_enc}
                  </Text>
                </View>

                {/* Chevron */}
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.textSecondary}
                  style={styles.chevron}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Add Button (Fixed at Bottom) */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddAccount}
          onPressIn={() => {
            if (hapticsEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
        >
          <Text style={styles.addButtonText}>Yeni Hesap</Text>
          <Ionicons name="add-circle" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Action Sheet */}
      <AccountActionSheet
        visible={showActionSheet}
        account={selectedAccount}
        onClose={() => setShowActionSheet(false)}
        onEdit={handleEditAccount}
        onDelete={handleDeleteAccount}
        onCopyUsername={handleCopyUsername}
        onCopyPassword={handleCopyPassword}
        onShare={handleShare}
      />

      {/* Edit Modal */}
      <AccountEditModal
        visible={showEditModal}
        account={editingAccount}
        mode={editMode}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveAccount}
      />
    </View>
  );
};

export default AccountsScreen;
