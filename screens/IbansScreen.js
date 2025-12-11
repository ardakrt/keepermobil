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
import { getBankInfo } from '../lib/serviceIcons';
import ServiceLogo from '../components/ServiceLogo';

import IbanActionSheet from '../components/IbanActionSheet';
import IbanEditModal from '../components/IbanEditModal';

const normaliseIban = (value) => value.replace(/\s+/g, '').toUpperCase();

const formatIbanGroups = (value) =>
  normaliseIban(value)
    .replace(/(.{4})/g, '$1 ')
    .trim();

const isValidIban = (value) => {
  const iban = normaliseIban(value);
  if (iban.length < 15 || iban.length > 34) return false;
  if (!/^[A-Z0-9]+$/.test(iban)) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const converted = rearranged
    .split('')
    .map((ch) => (ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch))
    .join('');

  let remainder = 0;
  for (let i = 0; i < converted.length; i += 1) {
    remainder = (remainder * 10 + Number(converted[i])) % 97;
  }
  return remainder === 1;
};

const bankInitials = (name) => {
  const n = (name || '').trim();
  if (!n) return 'TR';
  const parts = n.split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return initials || 'TR';
};

const IbansScreen = () => {
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
        ibanItem: {
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
        bankBadge: {
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
        bankBadgeText: {
          fontSize: 14,
          fontWeight: '800',
          color: theme.colors.text,
        },
        ibanInfo: {
          flex: 1,
        },
        ibanHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
        },
        ibanLabel: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.colors.text,
          flex: 1,
        },
        validBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: theme.colors.success + '22',
          borderWidth: 1,
          borderColor: theme.colors.success + '55',
        },
        invalidBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: theme.colors.danger + '22',
          borderWidth: 1,
          borderColor: theme.colors.danger + '55',
        },
        badgeTextValid: {
          color: theme.colors.success,
          fontWeight: '700',
          fontSize: 10,
        },
        badgeTextInvalid: {
          color: theme.colors.danger,
          fontWeight: '700',
          fontSize: 10,
        },
        ibanNumber: {
          fontSize: 14,
          color: theme.colors.textSecondary,
          fontFamily: 'monospace',
          letterSpacing: 0.5,
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
  const [ibans, setIbans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Action Sheet State
  const [selectedIban, setSelectedIban] = useState(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingIban, setEditingIban] = useState(null);
  const [editMode, setEditMode] = useState('add');

  const fetchIbans = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const currentUser = userData?.user;
      if (!currentUser) {
        setError('Oturum bulunamadı. Tekrar giriş yapın.');
        setIbans([]);
        return;
      }

      setUserId(currentUser.id);

      const { data: ibansData, error: ibansError } = await supabase
        .from('ibans')
        .select('id, user_id, label, iban, bank, created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (ibansError) throw ibansError;

      setIbans(ibansData ?? []);
    } catch (err) {
      console.warn('Fetch ibans failed', err);
      setError(err.message ?? 'IBANlar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIbans();
  }, [fetchIbans]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('ibans-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ibans',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchIbans();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchIbans]);

  const handleIbanPress = (iban) => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedIban(iban);
    setShowActionSheet(true);
  };

  const handleAddIban = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setEditMode('add');
    setEditingIban(null);
    setShowEditModal(true);
  };

  const handleEditIban = (iban) => {
    setEditMode('edit');
    setEditingIban(iban);
    setShowEditModal(true);
  };

  const handleCopyIban = async (iban) => {
    try {
      await Clipboard.setStringAsync(iban.iban ?? '');
      showToast('IBAN panoya kopyalandı.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Copy failed', err);
      showToast('Kopyalama başarısız oldu.');
    }
  };

  const handleShare = async (iban) => {
    try {
      const message = `${iban.label}\n\nIBAN: ${iban.iban}\nBanka: ${iban.bank || 'Belirtilmemiş'}`;

      await Share.share({
        message: message,
        title: `${iban.label} - IBAN Bilgisi`,
      });

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Share failed', err);
      showToast('Paylaşım başarısız oldu.');
    }
  };

  const handleDeleteIban = async (iban) => {
    const confirmed = await confirm(
      'IBAN Sil',
      `"${iban.label}" IBAN'ını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
    );

    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase.from('ibans').delete().eq('id', iban.id);

      if (deleteError) throw deleteError;

      setIbans((prev) => prev.filter((item) => item.id !== iban.id));
      showToast('IBAN başarıyla silindi.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Delete iban failed', err);
      showToast('IBAN silinemedi.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleSaveIban = async (ibanData, ibanId) => {
    if (!userId) {
      throw new Error('Oturum bulunamadı. Tekrar giriş yapın.');
    }

    const payload = {
      ...ibanData,
      user_id: userId,
    };

    if (ibanId) {
      // Update existing iban
      const { data, error: updateError } = await supabase
        .from('ibans')
        .update(payload)
        .eq('id', ibanId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      setIbans((prev) => prev.map((i) => (i.id === ibanId ? data : i)));
      showToast('IBAN güncellendi.');
    } else {
      // Insert new iban
      const { data, error: insertError } = await supabase
        .from('ibans')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) throw insertError;

      setIbans((prev) => [data, ...prev]);
      showToast('IBAN başarıyla eklendi.');
    }
  };

  const filteredIbans = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ibans;

    return ibans.filter(
      (e) =>
        (e.label || '').toLowerCase().includes(q) ||
        (e.iban || '').toLowerCase().includes(q) ||
        (e.bank || '').toLowerCase().includes(q)
    );
  }, [ibans, search]);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Ara: etiket, IBAN veya banka"
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
      ) : filteredIbans.length === 0 ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.emptyContainer}>
            <Ionicons
              name="card-outline"
              size={80}
              color={theme.colors.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {search ? 'Sonuç bulunamadı' : 'Henüz IBAN yok'}
            </Text>
            <Text style={styles.emptyText}>
              {search
                ? 'Arama kriterlerinize uygun IBAN bulunamadı.'
                : 'IBAN bilgilerinizi güvenle saklayın. Yeni IBAN eklemek için aşağıdaki butona dokunun.'}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filteredIbans.map((iban) => {
            const valid = isValidIban(iban.iban ?? '');

            return (
              <TouchableOpacity
                key={iban.id}
                style={styles.ibanItem}
                onPress={() => handleIbanPress(iban)}
                activeOpacity={0.7}
              >
                {/* Bank Badge / Logo */}
                {getBankInfo(iban.bank) ? (
                  <ServiceLogo
                    brand={getBankInfo(iban.bank)}
                    fallbackText={bankInitials(iban.bank)}
                    size="sm"
                  />
                ) : (
                  <View style={styles.bankBadge}>
                    <Text style={styles.bankBadgeText}>{bankInitials(iban.bank)}</Text>
                  </View>
                )}

                {/* IBAN Info */}
                <View style={styles.ibanInfo}>
                  <View style={styles.ibanHeader}>
                    <Text style={styles.ibanLabel} numberOfLines={1}>
                      {iban.label}
                    </Text>
                    <View style={valid ? styles.validBadge : styles.invalidBadge}>
                      <Text style={valid ? styles.badgeTextValid : styles.badgeTextInvalid}>
                        {valid ? 'GEÇERLİ' : 'HATALI'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ibanNumber} numberOfLines={1}>
                    {formatIbanGroups(iban.iban ?? '')}
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
          onPress={handleAddIban}
          onPressIn={() => {
            if (hapticsEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
        >
          <Text style={styles.addButtonText}>Yeni IBAN</Text>
          <Ionicons name="add-circle" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Action Sheet */}
      <IbanActionSheet
        visible={showActionSheet}
        iban={selectedIban}
        onClose={() => setShowActionSheet(false)}
        onEdit={handleEditIban}
        onDelete={handleDeleteIban}
        onCopy={handleCopyIban}
        onShare={handleShare}
      />

      {/* Edit Modal */}
      <IbanEditModal
        visible={showEditModal}
        iban={editingIban}
        mode={editMode}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveIban}
      />
    </View>
  );
};

export default IbansScreen;
