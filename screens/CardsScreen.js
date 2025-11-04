import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
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
import { lookupBin } from '../lib/binLookup';

import CardActionSheet from '../components/CardActionSheet';
import CardEditModal from '../components/CardEditModal';
import CardBrandIcon from '../components/CardBrandIcon';

const normaliseCard = (card) => {
  if (!card) return card;

  const expiry =
    card.exp_month_enc && card.exp_year_enc
      ? `${String(card.exp_month_enc).padStart(2, '0')}/${String(card.exp_year_enc).slice(-2)}`
      : '';

  return {
    ...card,
    expiry,
  };
};

const formatMaskedNumber = (number) => {
  if (!number) return '•••• •••• •••• ••••';
  const cleaned = number.replace(/\D/g, '');
  const first4 = cleaned.substring(0, 4);
  const last4 = cleaned.substring(cleaned.length - 4);
  return `${first4} ${cleaned.substring(4, 6)}** **** ${last4}`;
};

const getCardBrand = (number) => {
  if (!number) return null;
  const cleaned = number.replace(/\D/g, '');
  const firstDigit = cleaned[0];
  const firstTwo = cleaned.substring(0, 2);

  if (firstDigit === '4') return 'VISA';
  if (firstTwo >= '51' && firstTwo <= '55') return 'MASTERCARD';
  if (firstTwo === '65') return 'TROY';
  if (firstTwo === '35') return 'MASTERCARD';
  if (firstTwo === '37') return 'MASTERCARD';

  return 'CARD';
};

const CardsScreen = () => {
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
        cardItem: {
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
        cardInfo: {
          flex: 1,
        },
        cardLabel: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: 4,
        },
        cardNumber: {
          fontSize: 15,
          color: theme.colors.textSecondary,
          fontFamily: 'monospace',
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
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Action Sheet State
  const [selectedCard, setSelectedCard] = useState(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [editMode, setEditMode] = useState('add');

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const currentUser = userData?.user;
      if (!currentUser) {
        setError('Oturum bulunamadı. Tekrar giriş yapın.');
        setCards([]);
        return;
      }

      setUserId(currentUser.id);

      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select(
          'id, user_id, label, number_enc, cvc_enc, created_at, exp_month_enc, exp_year_enc, holder_name_enc'
        )
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (cardsError) throw cardsError;

      // Kartları hemen yükle, BIN lookup yapmadan (performans için)
      const cardsWithBrand = (cardsData ?? []).map((card) => {
        const normalized = normaliseCard(card);
        return {
          ...normalized,
          cardBrand: getCardBrand(card.number_enc), // Sadece regex ile hızlı marka tespiti
        };
      });

      setCards(cardsWithBrand);
    } catch (err) {
      console.warn('Fetch cards failed', err);
      setError(err.message ?? 'Kartlar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('cards-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cards',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchCards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCards]);

  const handleCardPress = (card) => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCard(card);
    setShowActionSheet(true);
  };

  const handleAddCard = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setEditMode('add');
    setEditingCard(null);
    setShowEditModal(true);
  };

  const handleEditCard = (card) => {
    setEditMode('edit');
    setEditingCard(card);
    setShowEditModal(true);
  };

  const handleCopyField = async (card, field) => {
    try {
      let value = '';
      switch (field) {
        case 'number':
          value = card.number_enc ?? '';
          break;
        case 'expiry':
          value = card.expiry ?? '';
          break;
        case 'cvc':
          value = card.cvc_enc ?? '';
          break;
        case 'holder':
          value = card.holder_name_enc ?? '';
          break;
      }

      await Clipboard.setStringAsync(value);
      showToast('Panoya kopyalandı.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Copy failed', err);
      showToast('Kopyalama başarısız oldu.');
    }
  };

  const handleLongPress = async (card) => {
    if (hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const cardInfo = `Kart No: ${card.number_enc}\nSKT: ${card.expiry}\nCVC: ${card.cvc_enc}`;

    try {
      await Clipboard.setStringAsync(cardInfo);
      showToast('Kart bilgileri kopyalandı!');
    } catch (err) {
      console.warn('Long press copy failed', err);
      showToast('Kopyalama başarısız oldu.');
    }
  };

  const handleShare = async (card) => {
    try {
      const message = `${card.label}\n\nKart No: ${card.number_enc}\nSKT: ${card.expiry}\nCVC: ${card.cvc_enc}\nKart Sahibi: ${card.holder_name_enc}`;

      await Share.share({
        message: message,
        title: `${card.label} - Kart Bilgileri`,
      });

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Share failed', err);
      showToast('Paylaşım başarısız oldu.');
    }
  };

  const handleDeleteCard = async (card) => {
    const confirmed = await confirm(
      'Kartı Sil',
      `"${card.label}" kartını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
    );

    if (!confirmed) return;

    try {
      const { error: deleteError } = await supabase.from('cards').delete().eq('id', card.id);

      if (deleteError) throw deleteError;

      setCards((prev) => prev.filter((item) => item.id !== card.id));
      showToast('Kart başarıyla silindi.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.warn('Delete card failed', err);
      showToast('Kart silinemedi.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleSaveCard = async (cardData, cardId) => {
    if (!userId) {
      throw new Error('Oturum bulunamadı. Tekrar giriş yapın.');
    }

    const payload = {
      ...cardData,
      user_id: userId,
    };

    if (cardId) {
      // Update existing card
      const { data, error: updateError } = await supabase
        .from('cards')
        .update(payload)
        .eq('id', cardId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      const updatedCard = normaliseCard(data);

      // BIN lookup
      try {
        const binInfo = await lookupBin(data.number_enc);
        updatedCard.binInfo = binInfo;
        updatedCard.cardBrand = binInfo?.cardBrand || getCardBrand(data.number_enc);
      } catch (err) {
        console.warn('BIN lookup failed:', err);
        updatedCard.cardBrand = getCardBrand(data.number_enc);
      }

      setCards((prev) => prev.map((c) => (c.id === cardId ? updatedCard : c)));
      showToast('Kart güncellendi.');
    } else {
      // Insert new card
      const { data, error: insertError } = await supabase
        .from('cards')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) throw insertError;

      const insertedCard = normaliseCard(data);

      // BIN lookup
      try {
        const binInfo = await lookupBin(data.number_enc);
        insertedCard.binInfo = binInfo;
        insertedCard.cardBrand = binInfo?.cardBrand || getCardBrand(data.number_enc);
      } catch (err) {
        console.warn('BIN lookup failed:', err);
        insertedCard.cardBrand = getCardBrand(data.number_enc);
      }

      setCards((prev) => [insertedCard, ...prev]);
      showToast('Kart başarıyla eklendi.');
    }
  };

  return (
    <View style={styles.container}>
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
      ) : cards.length === 0 ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.emptyContainer}>
            <Ionicons
              name="card-outline"
              size={80}
              color={theme.colors.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>Henüz kart yok</Text>
            <Text style={styles.emptyText}>
              Kartlarınızı güvenle saklayın. Yeni kart eklemek için aşağıdaki butona dokunun.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {cards.map((card, index) => (
            <TouchableOpacity
              key={card.id}
              style={styles.cardItem}
              onPress={() => handleCardPress(card)}
              onLongPress={() => handleLongPress(card)}
              delayLongPress={500}
              activeOpacity={0.7}
            >
              {/* Card Brand Icon */}
              <CardBrandIcon brand={card.cardBrand} width={60} height={38} />

              {/* Card Info */}
              <View style={styles.cardInfo}>
                <Text style={styles.cardLabel}>{card.label}</Text>
                <Text style={styles.cardNumber}>{formatMaskedNumber(card.number_enc)}</Text>
              </View>

              {/* Chevron */}
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
                style={styles.chevron}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Add Button (Fixed at Bottom, above navigation) */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddCard}
          onPressIn={() => {
            if (hapticsEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
        >
          <Text style={styles.addButtonText}>Yeni Kart</Text>
          <Ionicons name="add-circle" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Action Sheet */}
      <CardActionSheet
        visible={showActionSheet}
        card={selectedCard}
        onClose={() => setShowActionSheet(false)}
        onEdit={handleEditCard}
        onDelete={handleDeleteCard}
        onCopy={handleCopyField}
        onShare={handleShare}
      />

      {/* Edit Modal */}
      <CardEditModal
        visible={showEditModal}
        card={editingCard}
        mode={editMode}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveCard}
      />
    </View>
  );
};

export default CardsScreen;
