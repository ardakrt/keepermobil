import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { lookupBin } from '../lib/binLookup';
import CreditCard from './CreditCard';

const formatCardNumber = (value) => {
  const cleaned = value.replace(/\D/g, '');
  const chunks = cleaned.match(/.{1,4}/g) || [];
  return chunks.join(' ');
};

const formatExpiryInput = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const normaliseNumber = (value) => value.replace(/\D/g, '');

const CardEditModal = ({ visible, card, onClose, onSave, mode = 'add' }) => {
  const { theme } = useAppTheme();
  const { hapticsEnabled } = usePrefs();

  const [label, setLabel] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [holderName, setHolderName] = useState('');
  const [binInfo, setBinInfo] = useState(null);
  const [cardBrand, setCardBrand] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form verilerini kart objesi olarak önizleme için hazırla
  const previewCard = {
    label: label || 'Yeni Kart',
    number_enc: number,
    holder_name_enc: holderName,
    expiry: expiry,
    cvc_enc: cvc,
    exp_month_enc: expiry.split('/')[0],
    exp_year_enc: expiry.split('/')[1],
  };

  useEffect(() => {
    if (visible && card && mode === 'edit') {
      setLabel(card.label || '');
      setNumber(card.number_enc || '');
      setHolderName(card.holder_name_enc || '');
      setExpiry(card.expiry || '');
      setCvc(card.cvc_enc || '');
    } else if (visible && mode === 'add') {
      resetForm();
    }
  }, [visible, card, mode]);

  // BIN lookup
  useEffect(() => {
    const performBinLookup = async () => {
      const cleanNumber = normaliseNumber(number);

      if (cleanNumber.length >= 6) {
        try {
          const result = await lookupBin(cleanNumber);
          setBinInfo(result);
          setCardBrand(result?.cardBrand || null);

          if (result && result.bankName && !label.trim() && mode === 'add') {
            const programSuffix = result.cardProgram ? ` ${result.cardProgram}` : '';
            setLabel(`${result.bankName}${programSuffix}`);
          }
        } catch (error) {
          console.warn('BIN sorgulanamadı:', error);
          setBinInfo(null);
          setCardBrand(null);
        }
      } else {
        setBinInfo(null);
        setCardBrand(null);
      }
    };

    const timeoutId = setTimeout(performBinLookup, 500);
    return () => clearTimeout(timeoutId);
  }, [number]);

  const resetForm = () => {
    setLabel('');
    setNumber('');
    setExpiry('');
    setCvc('');
    setHolderName('');
    setBinInfo(null);
    setCardBrand(null);
    setError('');
  };

  const validateCard = () => {
    if (!label.trim() || !number.trim() || !holderName.trim()) {
      setError('Kart etiketi, numarası ve kart sahibi adı zorunludur.');
      return false;
    }

    const cleaned = normaliseNumber(number);
    if (cleaned.length < 12 || cleaned.length > 19) {
      setError('Kart numarası 12-19 hane olmalıdır.');
      return false;
    }

    if (expiry && !/^\d{2}\/\d{2}$/.test(expiry)) {
      setError('SKT formatı MM/YY olmalıdır.');
      return false;
    }

    if (cvc && !/^\d{3,4}$/.test(cvc)) {
      setError('CVC 3 veya 4 haneli olmalıdır.');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateCard()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const [month, year] = expiry.trim().split('/');

      const cardData = {
        label: label.trim(),
        number_enc: normaliseNumber(number),
        cvc_enc: cvc.trim(),
        holder_name_enc: holderName.trim(),
        exp_month_enc: month,
        exp_year_enc: year,
      };

      await onSave(cardData, card?.id);

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      resetForm();
      onClose();
    } catch (err) {
      console.warn('Save card failed', err);
      setError(err.message ?? 'Kart kaydedilemedi.');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            onPressIn={() => {
              if (hapticsEnabled) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          >
            <Ionicons name="close" size={28} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {mode === 'add' ? 'Yeni Kart Ekle' : 'Kartı Düzenle'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Card Preview */}
          <View style={styles.previewContainer}>
            <CreditCard card={previewCard} index={0} style={styles.cardPreview} cardBrand={cardBrand} />
          </View>

          {/* BIN Info */}
          {binInfo && binInfo.bankName && (
            <View style={[styles.binInfo, { backgroundColor: theme.colors.surfaceElevated }]}>
              <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
              <Text style={[styles.binInfoText, { color: theme.colors.text }]}>
                {binInfo.bankName} {binInfo.cardBrand && `• ${binInfo.cardBrand}`}
              </Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                Kart Etiketi
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={label}
                onChangeText={setLabel}
                placeholder="örn. İş Bankası Gold"
                placeholderTextColor={theme.colors.muted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                Kart Sahibi Adı
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={holderName}
                onChangeText={setHolderName}
                placeholder="AD SOYAD"
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                Kart Numarası
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={formatCardNumber(number)}
                onChangeText={(value) => {
                  const cleaned = value.replace(/\D/g, '').slice(0, 19);
                  setNumber(cleaned);
                }}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={theme.colors.muted}
                keyboardType="number-pad"
                maxLength={23}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Son Kullanma Tarihi
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surfaceElevated,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  value={expiry}
                  onChangeText={(value) => setExpiry(formatExpiryInput(value))}
                  placeholder="MM/YY"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  CVC/CVV
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surfaceElevated,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  value={cvc}
                  onChangeText={(value) => setCvc(value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: theme.colors.dangerLight }]}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
              <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: theme.colors.primary },
              saving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
            onPressIn={() => {
              if (hapticsEnabled) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {mode === 'add' ? 'Kartı Ekle' : 'Değişiklikleri Kaydet'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 36,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  previewContainer: {
    paddingVertical: 10,
  },
  cardPreview: {
    marginBottom: 0,
  },
  binInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  binInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default CardEditModal;
