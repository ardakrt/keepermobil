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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';

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

const IbanEditModal = ({ visible, iban, onClose, onSave, mode = 'add' }) => {
  const { theme } = useAppTheme();
  const { hapticsEnabled } = usePrefs();

  const [label, setLabel] = useState('');
  const [ibanValue, setIbanValue] = useState('');
  const [bank, setBank] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && iban && mode === 'edit') {
      setLabel(iban.label || '');
      setIbanValue(iban.iban || '');
      setBank(iban.bank || '');
    } else if (visible && mode === 'add') {
      resetForm();
    }
  }, [visible, iban, mode]);

  const resetForm = () => {
    setLabel('');
    setIbanValue('');
    setBank('');
    setError('');
  };

  const validateIban = () => {
    if (!label.trim() || !ibanValue.trim()) {
      setError('IBAN etiketi ve numarası zorunludur.');
      return false;
    }

    const cleaned = normaliseIban(ibanValue);
    if (!isValidIban(cleaned)) {
      setError('Geçersiz IBAN. Lütfen kontrol edin.');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateIban()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const ibanData = {
        label: label.trim(),
        iban: normaliseIban(ibanValue),
        bank: bank.trim(),
      };

      await onSave(ibanData, iban?.id);

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      resetForm();
      onClose();
    } catch (err) {
      console.warn('Save iban failed', err);
      setError(err.message ?? 'IBAN kaydedilemedi.');

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

  const ibanIsValid = ibanValue.trim() ? isValidIban(ibanValue) : null;

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
            {mode === 'add' ? 'Yeni IBAN Ekle' : 'IBAN Düzenle'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                IBAN Etiketi
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
                placeholder="örn. Kişisel TR"
                placeholderTextColor={theme.colors.muted}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  IBAN Numarası
                </Text>
                {ibanIsValid !== null && (
                  <View
                    style={[
                      styles.validationBadge,
                      {
                        backgroundColor: ibanIsValid
                          ? theme.colors.success + '22'
                          : theme.colors.danger + '22',
                        borderColor: ibanIsValid
                          ? theme.colors.success + '55'
                          : theme.colors.danger + '55',
                      },
                    ]}
                  >
                    <Ionicons
                      name={ibanIsValid ? 'checkmark-circle' : 'close-circle'}
                      size={14}
                      color={ibanIsValid ? theme.colors.success : theme.colors.danger}
                    />
                    <Text
                      style={[
                        styles.validationText,
                        {
                          color: ibanIsValid ? theme.colors.success : theme.colors.danger,
                        },
                      ]}
                    >
                      {ibanIsValid ? 'Geçerli' : 'Hatalı'}
                    </Text>
                  </View>
                )}
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.ibanInput,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={formatIbanGroups(ibanValue)}
                onChangeText={(value) => setIbanValue(value.toUpperCase())}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                Banka Adı (İsteğe Bağlı)
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
                value={bank}
                onChangeText={setBank}
                placeholder="örn. Türkiye İş Bankası"
                placeholderTextColor={theme.colors.muted}
              />
            </View>
          </View>

          {/* IBAN Info */}
          <View style={[styles.infoBox, { backgroundColor: theme.colors.surfaceElevated }]}>
            <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              IBAN numaranız otomatik olarak doğrulanacaktır. TR ile başlayan Türkiye IBAN'ları 26
              karakter uzunluğundadır.
            </Text>
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
                  {mode === 'add' ? 'IBAN Ekle' : 'Değişiklikleri Kaydet'}
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
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  validationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  validationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  ibanInput: {
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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

export default IbanEditModal;
