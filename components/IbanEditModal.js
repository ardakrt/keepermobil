import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { getBankInfo } from '../lib/serviceIcons';
import ServiceLogo from './ServiceLogo';

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
  /* 
   * Redesigned IbanEditModal 
   * Includes a live card preview and cleaner input fields.
   */
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();

  const [label, setLabel] = useState('');
  const [ibanValue, setIbanValue] = useState('');
  const [bank, setBank] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Accent color or fallback
  const activeColor = accent || theme.colors.primary;

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      Animated.timing(keyboardHeight, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? 250 : 100,
        useNativeDriver: false,
      }).start();
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 250 : 100,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardHeight]);

  const handleInputFocus = (inputIndex) => {
    setKeyboardVisible(true);
    // ScrollView'ı input'a kaydır
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: inputIndex * 80, animated: true });
    }, 300);
  };

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
  const formattedIban = formatIbanGroups(ibanValue);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={[styles.sheetContainer, { backgroundColor: theme.colors.background }]}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: theme.dark ? '#38383A' : '#E5E5EA' }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              {mode === 'add' ? 'Yeni IBAN' : 'IBAN Düzenle'}
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.colors.surfaceElevated }]}
              onPress={handleClose}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={[styles.content, { paddingBottom: keyboardVisible ? 20 : 120 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
          >
            {/* Live Preview Card */}
            {!keyboardVisible && (
              <View style={styles.previewContainer}>
                <View style={[styles.cardPreview, { backgroundColor: activeColor, shadowColor: activeColor }]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.15)', 'rgba(0,0,0,0.05)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />

                  {/* Decoration Circles */}
                  <View style={[styles.decoCircle, { right: -20, top: -20, backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                  <View style={[styles.decoCircle, { left: -30, bottom: -30, width: 100, height: 100, backgroundColor: 'rgba(255,255,255,0.05)' }]} />

                  <View style={styles.cardHeader}>
                    <Text style={styles.cardBank} numberOfLines={1}>
                      {bank || 'Banka Adı'}
                    </Text>
                    {/* Bank Logo */}
                    {getBankInfo(bank) ? (
                      <ServiceLogo
                        brand={getBankInfo(bank)}
                        fallbackText={bank?.slice(0, 2) || '?'}
                        size="sm"
                        style={styles.bankLogo}
                      />
                    ) : (
                      <Ionicons name="copy-outline" size={18} color="rgba(255,255,255,0.6)" />
                    )}
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardIbanLabel}>TR</Text>
                    <Text style={styles.cardIban} adjustsFontSizeToFit numberOfLines={1}>
                      {formattedIban || '00 0000 0000 0000 0000 0000 00'}
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.cardLabelTitle}>HESAP SAHİBİ</Text>
                      <Text style={styles.cardLabel} numberOfLines={1}>
                        {label || 'İsim Soyisim'}
                      </Text>
                    </View>
                    {ibanIsValid !== null && (
                      <View style={[styles.validationBadge, { backgroundColor: ibanIsValid ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                        <Ionicons
                          name={ibanIsValid ? 'checkmark-circle' : 'alert-circle'}
                          size={14}
                          color={ibanIsValid ? '#4ade80' : '#f87171'}
                        />
                        <Text style={[styles.validationText, { color: ibanIsValid ? '#4ade80' : '#f87171' }]}>
                          {ibanIsValid ? 'Geçerli' : 'Hatalı'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Form Inputs */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>IBAN BİLGİLERİ</Text>

                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="person-outline" size={20} color={theme.colors.muted} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    value={label}
                    onChangeText={setLabel}
                    onFocus={() => handleInputFocus(0)}
                    placeholder="İsim Soyisim"
                    placeholderTextColor={theme.colors.muted}
                    autoCapitalize="words"
                  />
                </View>

                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={styles.inputIcon}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.muted }}>TR</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.ibanInput, { color: theme.colors.text }]}
                    value={formattedIban}
                    onChangeText={(value) => setIbanValue(value.toUpperCase())}
                    onFocus={() => handleInputFocus(1)}
                    placeholder="00 0000 0000 0000 0000 0000 00"
                    placeholderTextColor={theme.colors.muted}
                    autoCapitalize="characters"
                    keyboardType={Platform.OS === 'ios' ? 'default' : 'visible-password'}
                  />
                </View>

                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="business-outline" size={20} color={theme.colors.muted} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    value={bank}
                    onChangeText={setBank}
                    onFocus={() => handleInputFocus(2)}
                    placeholder="Banka Adı (İsteğe Bağlı)"
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>
              </View>

              {error ? (
                <View style={[styles.errorContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
                  <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
                </View>
              ) : null}
            </View>

          </ScrollView>

          {/* Footer Action - Hidden when keyboard is visible */}
          {!keyboardVisible && (
            <View style={[
              styles.footer,
              {
                backgroundColor: theme.colors.background,
                borderTopColor: theme.colors.border,
              }
            ]}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: activeColor, shadowColor: activeColor },
                  saving && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {mode === 'add' ? 'Ekle' : 'Kaydet'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dimmed background
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    marginTop: 60,
    flex: 1, // Use flex to fill available space instead of fixed percentage
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  previewContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  cardPreview: {
    width: '100%',
    height: 190,
    borderRadius: 24,
    padding: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  decoCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBank: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    opacity: 0.9,
    flex: 1,
    marginRight: 10,
  },
  bankLogo: {
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cardBody: {
    justifyContent: 'center',
  },
  cardIbanLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
    marginBottom: 4,
  },
  cardIban: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardLabelTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.6,
    marginBottom: 2,
  },
  cardLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    maxWidth: 160,
  },
  validationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  validationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  inputIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '500',
  },
  ibanInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
    fontSize: 15,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
