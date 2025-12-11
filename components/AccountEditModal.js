import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { useToast } from '../lib/toast';
import { getBasisTheory } from '../lib/basisTheory';
import { getBrandInfo, ALL_BRANDS } from '../lib/serviceIcons';
import ServiceLogo from './ServiceLogo';

// Parola gücü hesaplama
const calculatePasswordStrength = (password) => {
  if (!password) return { strength: 0, label: '', color: '#9ca3af' };

  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 15;
  if (password.length >= 16) strength += 10;
  if (/[a-z]/.test(password)) strength += 10;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 20;

  if (strength <= 30) return { strength, label: 'Zayıf', color: '#ef4444' };
  if (strength <= 60) return { strength, label: 'Orta', color: '#f59e0b' };
  if (strength <= 85) return { strength, label: 'İyi', color: '#3b82f6' };
  return { strength: 100, label: 'Mükemmel', color: '#22c55e' };
};

// Get service color from ALL_BRANDS
const getServiceColor = (serviceName) => {
  const brand = getBrandInfo(serviceName);
  return brand?.colors?.primary || '#667eea';
};

// Popüler hizmetler listesi - ALL_BRANDS'den otomatik oluştur
const POPULAR_SERVICES = [
  'netflix', 'spotify', 'youtube', 'instagram', 'twitter', 'facebook',
  'discord', 'google', 'github', 'steam', 'tiktok', 'linkedin',
  'apple', 'microsoft', 'amazon', 'trendyol', 'hepsiburada', 'getir'
].map(key => ALL_BRANDS[key]).filter(Boolean);

const AccountEditModal = ({ visible, account, onClose, onSave, mode = 'add' }) => {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const { showToast } = useToast();

  const [service, setService] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [showPresets, setShowPresets] = useState(false);

  // Marka rengi öncelikli - bulunursa markanın rengini kullan, yoksa accent veya default
  const serviceBrandColor = getServiceColor(service);
  const activeColor = serviceBrandColor !== '#667eea' ? serviceBrandColor : (accent || '#667eea');

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password]);

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

  // Hizmet adına göre önerileri filtrele
  const filteredPresets = useMemo(() => {
    if (!service.trim() || mode === 'edit') return [];
    const searchTerm = service.toLowerCase().trim();

    // ALL_BRANDS'den eşleşenleri bul
    const matched = Object.values(ALL_BRANDS).filter(brand =>
      brand.name.toLowerCase().includes(searchTerm) ||
      brand.id.toLowerCase().includes(searchTerm) ||
      brand.domain?.toLowerCase().includes(searchTerm)
    ).slice(0, 6);

    // Eğer eşleşen yoksa popüler servisleri göster
    if (matched.length === 0 && searchTerm.length <= 2) {
      return POPULAR_SERVICES.slice(0, 6);
    }

    return matched;
  }, [service, mode]);

  useEffect(() => {
    if (visible && account && mode === 'edit') {
      setService(account.service || '');
      setUsername(account.username_enc || '');
      setPassword(''); // Şifre gösterilmez, yeniden girilmeli
      setNote(account.note || '');
      setSelectedPreset(null);
      setShowPresets(false);
    } else if (visible && mode === 'add') {
      resetForm();
    }
  }, [visible, account, mode]);

  useEffect(() => {
    setShowPresets(filteredPresets.length > 0 && mode === 'add');
  }, [filteredPresets, mode]);

  const resetForm = () => {
    setService('');
    setUsername('');
    setPassword('');
    setNote('');
    setShowPassword(false);
    setError('');
    setSelectedPreset(null);
    setShowPresets(false);
  };

  const validateAccount = () => {
    if (!service.trim() || !username.trim()) {
      setError('Hizmet ve kullanıcı adı zorunludur.');
      return false;
    }
    // Yeni hesap eklerken parola zorunlu
    if (mode === 'add' && !password.trim()) {
      setError('Parola zorunludur.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateAccount()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      let btTokenId = account?.bt_token_id_password;

      // Parola varsa tokenize et
      if (password.trim()) {
        try {
          const bt = await getBasisTheory();

          // Eski token varsa sil
          if (account?.bt_token_id_password && mode === 'edit') {
            try {
              await bt.tokens.delete(account.bt_token_id_password);
            } catch (deleteErr) {
              console.warn('Old password token deletion failed:', deleteErr);
            }
          }

          // Yeni token oluştur
          const token = await bt.tokens.create({
            type: 'token',
            data: password.trim(),
          });

          btTokenId = token.id;
        } catch (btErr) {
          console.error('Basis Theory password tokenization failed:', btErr);
          throw new Error('Parola şifrelenemedi: ' + (btErr.message || 'Bilinmeyen hata'));
        }
      }

      const accountData = {
        service: service.trim(),
        username_enc: username.trim(),
        note: note.trim(),
      };

      // Sadece yeni parola girildiyse token ID'yi ekle
      if (password.trim() && btTokenId) {
        accountData.bt_token_id_password = btTokenId;
        accountData.password_enc = '•••••••••'; // Placeholder
      }

      await onSave(accountData, account?.id);

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      resetForm();
      onClose();
    } catch (err) {
      console.warn('Save account failed', err);
      setError(err.message ?? 'Hesap kaydedilemedi.');

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

  const handlePasteEmail = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setUsername(text.trim());
        showToast('Yapıştırıldı', 'Kullanıcı adı yapıştırıldı');
        if (hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      showToast('Hata', 'Yapıştırma hatası');
    }
  };

  const handlePastePassword = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setPassword(text);
        showToast('Yapıştırıldı', 'Parola yapıştırıldı');
        if (hapticsEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      showToast('Hata', 'Yapıştırma hatası');
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    showToast('Oluşturuldu', 'Güçlü parola oluşturuldu');
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleSelectPreset = useCallback((preset) => {
    setSelectedPreset(preset);
    setService(preset.name);
    setShowPresets(false);
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [hapticsEnabled]);

  const serviceBrand = getBrandInfo(service);

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
              {mode === 'add' ? 'Yeni Hesap' : 'Hesabı Düzenle'}
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
                    <Text style={styles.cardService} numberOfLines={1}>
                      {service || 'Hizmet Adı'}
                    </Text>
                    {/* Service Logo */}
                    {serviceBrand ? (
                      <ServiceLogo
                        brand={serviceBrand}
                        fallbackText={service?.slice(0, 2) || '?'}
                        variant="card"
                      />
                    ) : (
                      <View style={styles.logoPlaceholder}>
                        <Ionicons name="globe-outline" size={24} color="rgba(255,255,255,0.6)" />
                      </View>
                    )}
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardUsernameLabel}>KULLANICI ADI</Text>
                    <Text style={styles.cardUsername} numberOfLines={1}>
                      {username || 'kullanici@ornek.com'}
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.cardLabelTitle}>PAROLA</Text>
                      <Text style={styles.cardLabel}>
                        {password ? '••••••••••' : 'Girilmedi'}
                      </Text>
                    </View>
                    {password && (
                      <View style={[styles.strengthBadge, { backgroundColor: passwordStrength.color + '30' }]}>
                        <View style={[styles.strengthDot, { backgroundColor: passwordStrength.color }]} />
                        <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                          {passwordStrength.label}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Service Presets */}
            {showPresets && (
              <View style={[styles.presetsContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                <Text style={[styles.presetsTitle, { color: theme.colors.textSecondary }]}>ÖNERİLEN HİZMETLER</Text>
                <View style={styles.presetsGrid}>
                  {filteredPresets.map((brand) => (
                    <TouchableOpacity
                      key={brand.id}
                      style={[styles.presetChip, { backgroundColor: (brand.colors?.primary || '#667eea') + '15', borderColor: (brand.colors?.primary || '#667eea') + '30' }]}
                      onPress={() => handleSelectPreset(brand)}
                      activeOpacity={0.7}
                    >
                      <ServiceLogo
                        brand={brand}
                        fallbackText={brand.name?.slice(0, 2) || '?'}
                        size="xs"
                      />
                      <Text style={[styles.presetChipText, { color: theme.colors.text }]}>{brand.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Form Inputs */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>HESAP BİLGİLERİ</Text>

                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="globe-outline" size={20} color={theme.colors.muted} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    value={service}
                    onChangeText={setService}
                    onFocus={() => handleInputFocus(0)}
                    placeholder="Hizmet / Platform Adı"
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>

                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="person-outline" size={20} color={theme.colors.muted} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    value={username}
                    onChangeText={setUsername}
                    onFocus={() => handleInputFocus(1)}
                    placeholder="Kullanıcı Adı / E-posta"
                    placeholderTextColor={theme.colors.muted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TouchableOpacity onPress={handlePasteEmail} style={styles.inputAction}>
                    <Ionicons name="clipboard-outline" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={styles.inputIcon}>
                    <Ionicons name="lock-closed-outline" size={20} color={theme.colors.muted} />
                  </View>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => handleInputFocus(2)}
                    placeholder={mode === 'edit' ? 'Yeni parola' : 'Parola'}
                    placeholderTextColor={theme.colors.muted}
                    secureTextEntry={!showPassword}
                  />
                  <View style={styles.inputActions}>
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.inputAction}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePastePassword} style={styles.inputAction}>
                      <Ionicons name="clipboard-outline" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={generatePassword} style={styles.inputAction}>
                      <Ionicons name="flash-outline" size={20} color={theme.colors.warning || '#f59e0b'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <View style={styles.strengthContainer}>
                    <View style={[styles.strengthBar, { backgroundColor: theme.colors.border }]}>
                      <View style={[styles.strengthFill, { width: `${passwordStrength.strength}%`, backgroundColor: passwordStrength.color }]} />
                    </View>
                    <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                      {passwordStrength.label} ({passwordStrength.strength}%)
                    </Text>
                  </View>
                )}

                <View style={[styles.inputContainer, styles.noteContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
                  <View style={[styles.inputIcon, { alignSelf: 'flex-start', marginTop: 16 }]}>
                    <Ionicons name="document-text-outline" size={20} color={theme.colors.muted} />
                  </View>
                  <TextInput
                    style={[styles.input, styles.noteInput, { color: theme.colors.text }]}
                    value={note}
                    onChangeText={setNote}
                    onFocus={() => handleInputFocus(3)}
                    placeholder="Notlar (isteğe bağlı)"
                    placeholderTextColor={theme.colors.muted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
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

          {/* Footer Action */}
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
  cardService: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    opacity: 0.95,
    flex: 1,
    marginRight: 10,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  logoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    justifyContent: 'center',
  },
  cardUsernameLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
    marginBottom: 4,
  },
  cardUsername: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
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
  },
  strengthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  strengthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '700',
  },
  presetsContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    gap: 12,
  },
  presetsTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
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
  noteContainer: {
    height: 100,
    alignItems: 'flex-start',
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
  noteInput: {
    paddingTop: 16,
    paddingBottom: 16,
    textAlignVertical: 'top',
  },
  inputAction: {
    padding: 8,
  },
  inputActions: {
    flexDirection: 'row',
    gap: 4,
  },
  strengthContainer: {
    gap: 6,
    marginTop: -8,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
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

export default AccountEditModal;
