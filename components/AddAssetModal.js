import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { assetConfig } from '../lib/markets';

// Kategori seçenekleri
const CATEGORIES = [
  { key: 'currency', label: 'Döviz', icon: 'currency-usd' },
  { key: 'gold', label: 'Altın', icon: 'gold' },
  { key: 'crypto', label: 'Kripto', icon: 'bitcoin' },
];

export default function AddAssetModal({ visible, onClose, onSave, editingAsset, marketData }) {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();

  const [selectedCategory, setSelectedCategory] = useState('currency');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingAsset) {
      setSelectedCategory(editingAsset.category || 'currency');
      setSelectedSymbol(editingAsset.symbol);
      setAmount(editingAsset.amount?.toString() || '');
    } else {
      setSelectedCategory('currency');
      setSelectedSymbol('');
      setAmount('');
    }
  }, [editingAsset, visible]);

  const handleCategoryChange = async (category) => {
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCategory(category);
    setSelectedSymbol('');
  };

  const handleSymbolSelect = async (symbol) => {
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedSymbol(symbol);
  };

  const handleSave = async () => {
    if (!selectedSymbol || !amount) return;

    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsSaving(true);

    try {
      let assetData;
      const parsedAmount = parseFloat(amount);

      if (selectedCategory === 'currency') {
        const currency = marketData?.currencies?.find(c => c.code === selectedSymbol);
        if (currency) {
          const config = assetConfig[selectedSymbol] || {};
          assetData = {
            symbol: selectedSymbol,
            name: currency.name,
            icon: config.icon || '$',
            color: config.color || '#22C55E',
            amount: parsedAmount,
            price: currency.selling,
            change24h: currency.change,
            category: 'currency',
          };
        }
      } else if (selectedCategory === 'gold') {
        const gold = marketData?.golds?.find(g => g.code === selectedSymbol);
        if (gold) {
          const config = assetConfig[selectedSymbol] || {};
          assetData = {
            symbol: selectedSymbol,
            name: gold.name,
            icon: config.icon || '◉',
            color: config.color || '#F59E0B',
            amount: parsedAmount,
            price: gold.selling,
            change24h: gold.change || 0,
            category: 'gold',
          };
        }
      } else if (selectedCategory === 'crypto') {
        const crypto = marketData?.cryptos?.find(c => c.code === selectedSymbol);
        if (crypto) {
          const config = assetConfig[selectedSymbol] || {};
          assetData = {
            symbol: selectedSymbol,
            name: crypto.name,
            icon: config.icon || '₿',
            color: config.color || '#F7931A',
            amount: parsedAmount,
            price: crypto.priceTRY,
            change24h: crypto.change,
            category: 'crypto',
          };
        }
      }

      if (assetData) {
        if (editingAsset) {
          assetData.id = editingAsset.id;
        }
        await onSave(assetData);
        onClose();
      }
    } catch (error) {
      console.error('Save asset error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getAvailableAssets = () => {
    if (!marketData) return [];

    if (selectedCategory === 'currency') {
      return marketData.currencies || [];
    } else if (selectedCategory === 'gold') {
      return marketData.golds || [];
    } else if (selectedCategory === 'crypto') {
      return marketData.cryptos || [];
    }
    return [];
  };

  const availableAssets = getAvailableAssets();

  const dynamicStyles = {
    modalBackground: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
      backgroundColor: accent && theme.colors.surfaceTinted
        ? theme.colors.surfaceTinted
        : theme.colors.surface,
      borderColor: accent && theme.colors.borderTinted
        ? theme.colors.borderTinted
        : theme.colors.border,
    },
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.modalOverlay, dynamicStyles.modalBackground]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalContainer, dynamicStyles.modalContainer]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingAsset ? 'Varlık Düzenle' : 'Varlık Ekle'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Kategori Seçimi */}
            <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>Kategori</Text>
            <View style={styles.categoryContainer}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => handleCategoryChange(cat.key)}
                  style={[
                    styles.categoryButton,
                    {
                      backgroundColor: selectedCategory === cat.key
                        ? (accent || theme.colors.primary)
                        : theme.colors.surface,
                      borderColor: selectedCategory === cat.key
                        ? (accent || theme.colors.primary)
                        : theme.colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={cat.icon}
                    size={20}
                    color={
                      selectedCategory === cat.key
                        ? (accent ? '#fff' : (theme.dark ? '#000' : '#fff'))
                        : theme.colors.muted
                    }
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      {
                        color: selectedCategory === cat.key
                          ? (accent ? '#fff' : (theme.dark ? '#000' : '#fff'))
                          : theme.colors.muted,
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Varlık Seçimi */}
            <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>Varlık</Text>
            <View style={styles.assetsGrid}>
              {availableAssets.map((asset) => {
                const code = asset.code;
                const config = assetConfig[code] || {};
                const isSelected = selectedSymbol === code;

                return (
                  <TouchableOpacity
                    key={code}
                    onPress={() => handleSymbolSelect(code)}
                    style={[
                      styles.assetItem,
                      {
                        backgroundColor: isSelected
                          ? (accent || theme.colors.primary) + '20'
                          : theme.colors.surface,
                        borderColor: isSelected
                          ? (accent || theme.colors.primary)
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.assetIcon,
                        {
                          backgroundColor: (config.color || theme.colors.primary) + '20',
                        },
                      ]}
                    >
                      <Text style={[styles.assetIconText, { color: config.color || theme.colors.primary }]}>
                        {config.icon || '●'}
                      </Text>
                    </View>
                    <Text
                      style={[styles.assetCode, { color: theme.colors.text }]}
                      numberOfLines={1}
                    >
                      {code}
                    </Text>
                    <Text
                      style={[styles.assetName, { color: theme.colors.muted }]}
                      numberOfLines={1}
                    >
                      {asset.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Miktar Girişi */}
            {selectedSymbol && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>Miktar</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="Örn: 1.5"
                  placeholderTextColor={theme.colors.muted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </>
            )}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.button,
                styles.cancelButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: theme.colors.muted }]}>İptal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={!selectedSymbol || !amount || isSaving}
              style={[
                styles.button,
                styles.saveButton,
                {
                  backgroundColor: accent || theme.colors.primary,
                  opacity: (!selectedSymbol || !amount || isSaving) ? 0.5 : 1,
                },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={accent ? '#fff' : (theme.dark ? '#000' : '#fff')} />
              ) : (
                <Text
                  style={[
                    styles.buttonText,
                    { color: accent ? '#fff' : (theme.dark ? '#000' : '#fff') },
                  ]}
                >
                  {editingAsset ? 'Güncelle' : 'Ekle'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  assetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  assetItem: {
    width: '31%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  assetIconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  assetCode: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  assetName: {
    fontSize: 10,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 12,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
