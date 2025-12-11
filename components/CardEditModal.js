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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { lookupBin } from '../lib/binLookup';
import { getBasisTheory } from '../lib/basisTheory';
import { getBankInfo } from '../lib/serviceIcons';
import ServiceLogo from './ServiceLogo';

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

// Helper function to darken a color
const darkenColor = (hex, percent = 20) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
  const B = Math.max((num & 0x0000FF) - amt, 0);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
};

// Get card brand color
const getCardBrandColor = (brand) => {
  const brandLower = (brand || '').toLowerCase();
  if (brandLower.includes('visa')) return '#1A1F71';
  if (brandLower.includes('master')) return '#EB001B';
  if (brandLower.includes('troy')) return '#00A3E0';
  if (brandLower.includes('amex')) return '#006FCF';
  return '#667eea'; // Default purple
};

const CardEditModal = ({ visible, card, onClose, onSave, mode = 'add' }) => {
  const { theme, accent } = useAppTheme();
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

  // Accent color or card brand color
  const activeColor = cardBrand ? getCardBrandColor(cardBrand) : (accent || '#667eea');

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
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: inputIndex * 80, animated: true });
    }, 300);
  };

  useEffect(() => {
    if (visible && card && mode === 'edit') {
      setLabel(card.label || '');
      setNumber(card.last_four || '');
      setHolderName(card.holder_name_enc || '');
      setExpiry(card.expiry || '');
      setCvc(card.cvc_enc || '');
      setCardBrand(card.cardBrand);
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

          let normalizedBrand = result?.cardBrand || null;
          if (normalizedBrand) {
            const brandLower = normalizedBrand.toLowerCase();
            if (brandLower.includes('master')) normalizedBrand = 'Mastercard';
            else if (brandLower.includes('visa')) normalizedBrand = 'Visa';
            else if (brandLower.includes('troy')) normalizedBrand = 'Troy';
            else if (brandLower.includes('amex') || brandLower.includes('american')) normalizedBrand = 'Amex';
          }

          setCardBrand(normalizedBrand);

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
        if (mode === 'edit' && card && card.cardBrand && cleanNumber === card.last_four) {
          setCardBrand(card.cardBrand);
        } else if (cleanNumber.length < 6) {
          setCardBrand(null);
        }
      }
    };

    const timeoutId = setTimeout(performBinLookup, 500);
    return () => clearTimeout(timeoutId);
  }, [number, mode, card]);

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
    if (mode === 'add' && (cleaned.length < 12 || cleaned.length > 19)) {
      setError('Kart numarası 12-19 hane olmalıdır.');
      return false;
    }

    if (mode === 'edit' && cleaned.length !== 4 && (cleaned.length < 12 || cleaned.length > 19)) {
      setError('Kart numarası geçerli değil.');
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
      const cleanNumber = normaliseNumber(number);

      let btTokenId = card?.bt_token_id;
      let lastFour = cleanNumber.length >= 4 ? cleanNumber.slice(-4) : cleanNumber;

      if (mode === 'add' || (mode === 'edit' && cleanNumber.length >= 12)) {
        try {
          const bt = await getBasisTheory();

          if (card?.bt_token_id && mode === 'edit') {
            try {
              await bt.tokens.delete(card.bt_token_id);
            } catch (deleteErr) {
              console.warn('Old token deletion failed:', deleteErr);
            }
          }

          const token = await bt.tokens.create({
            type: 'card',
            data: {
              number: cleanNumber,
              expiration_month: parseInt(month, 10),
              expiration_year: parseInt(year.length === 2 ? `20${year}` : year, 10),
              cvc: cvc.trim(),
            },
          });

          btTokenId = token.id;
          lastFour = cleanNumber.slice(-4);
        } catch (btErr) {
          console.error('Basis Theory tokenization failed:', btErr);
          throw new Error('Kart tokenizasyonu başarısız: ' + (btErr.message || 'Bilinmeyen hata'));
        }
      }

      const cardData = {
        label: label.trim(),
        last_four: lastFour,
        cvc_enc: '***',
        holder_name_enc: holderName.trim(),
        exp_month_enc: month,
        exp_year_enc: year,
        card_brand: cardBrand ? cardBrand.toLowerCase() : 'unknown',
        bt_token_id: btTokenId,
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

  const formattedNumber = formatCardNumber(number);
  const isCardValid = normaliseNumber(number).length >= 12;

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
              {mode === 'add' ? 'Yeni Kart' : 'Kartı Düzenle'}
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
                      {label || 'Kart Adı'}
                    </Text>
                    {/* Card Brand Logo */}
                    {cardBrand ? (
                      <View style={styles.brandBadge}>
                        <Text style={styles.brandText}>{cardBrand}</Text>
                      </View>
                    ) : (
                      <Ionicons name="card-outline" size={24} color="rgba(255,255,255,0.6)" />
                    )}
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardNumberLabel}>KART NUMARASI</Text>
                    <Text style={styles.cardNumber} adjustsFontSizeToFit numberOfLines={1}>
                      {formattedNumber || '•••• •••• •••• ••••'}
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.cardLabelTitle}>KART SAHİBİ</Text>
                      <Text style={styles.cardLabel} numberOfLines={1}>
                        {holderName || 'İsim Soyisim'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.cardLabelTitle}>SKT</Text>
                      <Text style={styles.cardLabel}>
                        {expiry || 'MM/YY'}
                      </Text>
                    </View>
                    {isCardValid && (
                      <View style={[styles.validationBadge, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                        <Ionicons name="checkmark-circle" size={14} color="#4ade80" />
                        <Text style={[styles.validationText, { color: '#4ade80' }]}>Geçerli</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* BIN Info */}
            {binInfo && binInfo.bankName && (
              <View style={[styles.binInfo, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                {getBankInfo(binInfo.bankName) ? (
                  <ServiceLogo
                    brand={getBankInfo(binInfo.bankName)}
                    fallbackText={binInfo.bankName?.slice(0, 2) || '?'}
                    size="sm"
                  />
                ) : (
                  <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
                )}
                <Text style={[styles.binInfoText, { color: theme.colors.text }]}>
                  {binInfo.bankName} {binInfo.cardBrand && `• ${binInfo.cardBrand}`}
                </Text>
              </View>
            )}

            {/* Form Inputs */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>KART BİLGİLERİ</Text>

                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="card-outline" size={20} color={theme.colors.muted} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    value={label}
                    onChangeText={setLabel}
                    onFocus={() => handleInputFocus(0)}
                    placeholder="Kart Adı (örn. İş Bankası Visa)"
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>

                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="person-outline" size={20} color={theme.colors.muted} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    value={holderName}
                    onChangeText={setHolderName}
                    onFocus={() => handleInputFocus(1)}
                    placeholder="Kart Sahibi Adı"
                    placeholderTextColor={theme.colors.muted}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={styles.inputIcon}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.muted }}>****</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.numberInput, { color: theme.colors.text }]}
                    value={formattedNumber}
                    onChangeText={(value) => {
                      const cleaned = value.replace(/\D/g, '').slice(0, 19);
                      setNumber(cleaned);
                    }}
                    onFocus={() => handleInputFocus(2)}
                    placeholder={mode === 'edit' ? "•••• 1234" : "1234 5678 9012 3456"}
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="number-pad"
                    maxLength={23}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputContainer, styles.flex1, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                    <View style={styles.inputIcon}>
                      <Ionicons name="calendar-outline" size={20} color={theme.colors.muted} />
                    </View>
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      value={expiry}
                      onChangeText={(value) => setExpiry(formatExpiryInput(value))}
                      onFocus={() => handleInputFocus(3)}
                      placeholder="MM/YY"
                      placeholderTextColor={theme.colors.muted}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>

                  <View style={[styles.inputContainer, styles.flex1, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                    <View style={styles.inputIcon}>
                      <Ionicons name="lock-closed-outline" size={20} color={theme.colors.muted} />
                    </View>
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      value={cvc}
                      onChangeText={(value) => setCvc(value.replace(/\D/g, '').slice(0, 4))}
                      onFocus={() => handleInputFocus(4)}
                      placeholder="CVC"
                      placeholderTextColor={theme.colors.muted}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                    />
                  </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    marginTop: 60,
    flex: 1,
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
    marginBottom: 24,
    alignItems: 'center',
  },
  cardPreview: {
    width: '100%',
    height: 200,
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
  brandBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cardBody: {
    justifyContent: 'center',
  },
  cardNumberLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
    marginBottom: 4,
  },
  cardNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    letterSpacing: 2,
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
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 120,
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
  binInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
  },
  binInfoText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
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
  numberInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
    fontSize: 15,
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

export default CardEditModal;
