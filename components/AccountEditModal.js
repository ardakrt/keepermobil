import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { useToast } from '../lib/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Popüler hizmetler için önceden tanımlı ikonlar
const SERVICE_PRESETS = [
  // Sosyal Medya
  { name: 'Instagram', keywords: ['instagram', 'insta', 'ig'], icon: 'instagram', color: '#E4405F' },
  { name: 'Facebook', keywords: ['facebook', 'fb'], icon: 'facebook', color: '#1877F2' },
  { name: 'Twitter', keywords: ['twitter', 'x'], icon: 'twitter', color: '#1DA1F2' },
  { name: 'LinkedIn', keywords: ['linkedin', 'linked'], icon: 'linkedin', color: '#0A66C2' },
  { name: 'TikTok', keywords: ['tiktok', 'tik'], icon: 'music-note', color: '#000000' },
  { name: 'Snapchat', keywords: ['snapchat', 'snap'], icon: 'snapchat', color: '#FFFC00' },
  { name: 'WhatsApp', keywords: ['whatsapp', 'whats', 'wa'], icon: 'whatsapp', color: '#25D366' },
  { name: 'Telegram', keywords: ['telegram', 'tg'], icon: 'send', color: '#0088cc' },
  { name: 'Discord', keywords: ['discord'], icon: 'message-text', color: '#5865F2' },
  { name: 'Reddit', keywords: ['reddit'], icon: 'reddit', color: '#FF4500' },
  { name: 'Pinterest', keywords: ['pinterest', 'pin'], icon: 'pinterest', color: '#E60023' },
  { name: 'YouTube', keywords: ['youtube', 'yt'], icon: 'youtube', color: '#FF0000' },

  // E-ticaret
  { name: 'Amazon', keywords: ['amazon'], icon: 'cart', color: '#FF9900' },
  { name: 'Trendyol', keywords: ['trendyol', 'trend'], icon: 'shopping', color: '#F27A1A' },
  { name: 'Hepsiburada', keywords: ['hepsiburada', 'hepsi'], icon: 'cart-outline', color: '#FF6000' },
  { name: 'eBay', keywords: ['ebay'], icon: 'tag', color: '#E53238' },
  { name: 'AliExpress', keywords: ['aliexpress', 'ali'], icon: 'shopping-outline', color: '#FF4747' },
  { name: 'Getir', keywords: ['getir'], icon: 'moped', color: '#5D3EBC' },
  { name: 'Yemeksepeti', keywords: ['yemeksepeti', 'yemek'], icon: 'food', color: '#FF0000' },

  // Bankacılık & Finans
  { name: 'Garanti BBVA', keywords: ['garanti', 'bbva'], icon: 'bank', color: '#00A650' },
  { name: 'İş Bankası', keywords: ['isbank', 'isbankasi', 'is'], icon: 'bank-outline', color: '#005DAA' },
  { name: 'Yapı Kredi', keywords: ['yapikredi', 'yapi'], icon: 'credit-card', color: '#004F9F' },
  { name: 'Akbank', keywords: ['akbank'], icon: 'bank-transfer', color: '#EE2E24' },
  { name: 'Ziraat', keywords: ['ziraat'], icon: 'bank', color: '#00843D' },
  { name: 'PayPal', keywords: ['paypal', 'pay'], icon: 'currency-usd', color: '#00457C' },
  { name: 'Papara', keywords: ['papara'], icon: 'wallet', color: '#FF6B00' },

  // Streaming
  { name: 'Netflix', keywords: ['netflix', 'netf'], icon: 'netflix', color: '#E50914' },
  { name: 'Spotify', keywords: ['spotify', 'spot'], icon: 'spotify', color: '#1DB954' },
  { name: 'Disney+', keywords: ['disney', 'disneyplus'], icon: 'television', color: '#113CCF' },
  { name: 'Apple Music', keywords: ['apple music', 'apple'], icon: 'apple', color: '#FA243C' },
  { name: 'Amazon Prime', keywords: ['prime', 'amazon prime'], icon: 'video', color: '#00A8E1' },
  { name: 'BluTV', keywords: ['blutv', 'blu'], icon: 'television-play', color: '#0072C6' },
  { name: 'Exxen', keywords: ['exxen'], icon: 'television-box', color: '#FF6B00' },
  { name: 'Gain', keywords: ['gain'], icon: 'play-circle', color: '#FF0080' },

  // Email
  { name: 'Gmail', keywords: ['gmail', 'google mail'], icon: 'gmail', color: '#EA4335' },
  { name: 'Outlook', keywords: ['outlook', 'hotmail'], icon: 'microsoft-outlook', color: '#0078D4' },
  { name: 'Yahoo Mail', keywords: ['yahoo', 'ymail'], icon: 'yahoo', color: '#6001D2' },
  { name: 'ProtonMail', keywords: ['proton', 'protonmail'], icon: 'email-lock', color: '#6D4AFF' },

  // Diğer
  { name: 'Google', keywords: ['google'], icon: 'google', color: '#4285F4' },
  { name: 'Microsoft', keywords: ['microsoft'], icon: 'microsoft', color: '#00A4EF' },
  { name: 'Apple', keywords: ['apple', 'icloud'], icon: 'apple', color: '#000000' },
  { name: 'GitHub', keywords: ['github', 'git'], icon: 'github', color: '#181717' },
  { name: 'Dropbox', keywords: ['dropbox', 'drop'], icon: 'dropbox', color: '#0061FF' },
  { name: 'Steam', keywords: ['steam'], icon: 'steam', color: '#000000' },
  { name: 'Epic Games', keywords: ['epic', 'epicgames'], icon: 'gamepad-variant', color: '#313131' },
];

// Parola gücü hesaplama
const calculatePasswordStrength = (password) => {
  if (!password) return { strength: 0, label: '', color: '#9ca3af' };

  let strength = 0;

  // Uzunluk kontrolü
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 15;
  if (password.length >= 16) strength += 10;

  // Karakter çeşitliliği
  if (/[a-z]/.test(password)) strength += 10;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 20;

  if (strength <= 30) return { strength, label: 'Zayıf', color: '#ef4444' };
  if (strength <= 60) return { strength, label: 'Orta', color: '#f59e0b' };
  if (strength <= 85) return { strength, label: 'İyi', color: '#3b82f6' };
  return { strength: 100, label: 'Mükemmel', color: '#22c55e' };
};

const AccountEditModal = ({ visible, account, onClose, onSave, mode = 'add' }) => {
  const { theme, mode: themeMode } = useAppTheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && theme.colors.background === '#0b0b12');
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

  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password]);

  // Hizmet adına göre önerileri filtrele
  const filteredPresets = useMemo(() => {
    if (!service.trim() || mode === 'edit') return [];

    const searchTerm = service.toLowerCase().trim();

    return SERVICE_PRESETS.filter(preset =>
      preset.keywords.some(keyword => keyword.includes(searchTerm)) ||
      preset.name.toLowerCase().includes(searchTerm)
    ).slice(0, 6); // Maksimum 6 öneri göster
  }, [service, mode]);

  useEffect(() => {
    if (visible && account && mode === 'edit') {
      setService(account.service || '');
      setUsername(account.username_enc || '');
      // Basis Theory entegrasyonu nedeniyle şifreyi gösteremiyoruz
      setPassword('');
      setNote(account.note || '');
      setSelectedPreset(null);
      setShowPresets(false);
    } else if (visible && mode === 'add') {
      resetForm();
    }
  }, [visible, account, mode]);

  useEffect(() => {
    // Filtrelenmiş presetler varsa göster
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

    // Şifre zorunluluğunu kaldırdık çünkü mobilde şifre kaydedemiyoruz (Basis Theory)
    // if (!password.trim()) {
    //   setError('Parola zorunludur.');
    //   return false;
    // }

    return true;
  };

  const handleSave = async () => {
    if (!validateAccount()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const accountData = {
        service: service.trim(),
        username_enc: username.trim(),
        // password_enc: password.trim(), // ARTIK GÖNDERİLMİYOR
        // bt_token_id_password: ... // Token oluşturulamadığı için bunu da gönderemiyoruz
        note: note.trim(),
      };

      if (password.trim()) {
        showToast('Uyarı', 'Mobil uygulamada şifre kaydedilemez. Lütfen web sürümünü kullanın.');
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
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailRegex.test(text.trim())) {
          setUsername(text.trim());
          showToast('Başarılı', 'E-posta yapıştırıldı');

          if (hapticsEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          setUsername(text.trim());
          showToast('Uyarı', 'Panodaki metin yapıştırıldı');
        }
      } else {
        showToast('Hata', 'Panoda metin bulunamadı');
      }
    } catch (error) {
      console.log('Clipboard error:', error);
      showToast('Hata', 'Yapıştırma hatası');
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

  const handleCopyPassword = useCallback(async () => {
    if (password) {
      await Clipboard.setStringAsync(password);
      showToast('Kopyalandı', 'Parola panoya kopyalandı');

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [password, hapticsEnabled, showToast]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={[styles.modalContent, { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' }]}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#3c3c3e' : '#d1d1d6' }]} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Hizmet / Platform
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
                      borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
                      color: theme.colors.text,
                    },
                  ]}
                  value={service}
                  onChangeText={setService}
                  placeholder="örn. Netflix, Instagram, Gmail"
                  placeholderTextColor={theme.colors.muted}
                  autoComplete="off"
                  autoFocus={mode === 'add'}
                />

                {/* Akıllı Hizmet Önerileri */}
                {showPresets && (
                  <Animated.View entering={FadeIn} exiting={FadeOut}>
                    <View style={styles.presetsContainer}>
                      <Text style={[styles.presetsTitle, { color: theme.colors.textSecondary }]}>
                        Önerilen Hizmetler
                      </Text>
                      <View style={styles.presetsGrid}>
                        {filteredPresets.map((preset) => (
                          <TouchableOpacity
                            key={preset.name}
                            style={[
                              styles.presetChip,
                              {
                                backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
                                borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
                              },
                            ]}
                            onPress={() => handleSelectPreset(preset)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.presetIconSmall, { backgroundColor: preset.color + '15' }]}>
                              <MaterialCommunityIcons
                                name={preset.icon}
                                size={18}
                                color={preset.color}
                              />
                            </View>
                            <Text
                              style={[styles.presetChipText, { color: theme.colors.text }]}
                              numberOfLines={1}
                            >
                              {preset.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </Animated.View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Kullanıcı Adı / E-posta
                </Text>
                <View style={styles.inputWithButton}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.inputFlex,
                      {
                        backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
                        borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
                        color: theme.colors.text,
                      },
                    ]}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="kullanici@ornek.com"
                    placeholderTextColor={theme.colors.muted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="username"
                    textContentType="username"
                  />
                  <TouchableOpacity
                    style={[
                      styles.iconButton,
                      {
                        backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
                        borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
                      }
                    ]}
                    onPress={handlePasteEmail}
                    onPressIn={() => {
                      if (hapticsEnabled) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                  >
                    <MaterialCommunityIcons name="content-paste" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Parola (Sadece Web'de Düzenlenebilir)
                </Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
                        borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
                        color: theme.colors.textSecondary, // Disabled look
                      },
                    ]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mobil uygulamada şifre düzenlenemez"
                    placeholderTextColor={theme.colors.muted}
                    secureTextEntry={!showPassword}
                    editable={false} // Disable editing
                  />
                  {/* ... existing password actions ... */}
                </View>

                {/* ... existing strength indicator ... */}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                  Notlar (İsteğe Bağlı)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.multilineInput,
                    {
                      backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
                      borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
                      color: theme.colors.text,
                    },
                  ]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Bu hesap hakkında notlarınız..."
                  placeholderTextColor={theme.colors.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Info Box */}
            <View style={[styles.infoBox, { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' }]}>
              <MaterialCommunityIcons name="shield-lock" size={20} color={theme.colors.primary} />
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                Hesap bilgileriniz şifrelenerek güvenli bir şekilde saklanır. Sadece siz erişebilirsiniz.
              </Text>
            </View>

            {/* Error Message */}
            {error ? (
              <Animated.View
                entering={SlideInDown}
                exiting={SlideOutDown}
                style={[styles.errorContainer, { backgroundColor: isDark ? '#2c1c1e' : '#fee2e2' }]}
              >
                <MaterialCommunityIcons name="alert-circle" size={20} color="#ef4444" />
                <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
              </Animated.View>
            ) : null}
          </ScrollView>

          {/* Save Button */}
          <View style={[styles.footer, { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' }]}>
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
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={mode === 'add' ? 'check-circle' : 'content-save'}
                    size={24}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveButtonText}>
                    {mode === 'add' ? 'Hesap Ekle' : 'Değişiklikleri Kaydet'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '95%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2.5,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 24,
    paddingBottom: 40,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  inputFlex: {
    flex: 1,
  },
  inputWithButton: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsContainer: {
    gap: 12,
    marginTop: 8,
  },
  presetsTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  presetIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 90,
  },
  passwordActions: {
    position: 'absolute',
    right: 12,
    top: 16,
    flexDirection: 'row',
    gap: 8,
  },
  passwordActionButton: {
    padding: 4,
  },
  strengthContainer: {
    gap: 8,
  },
  strengthBar: {
    height: 6,
    backgroundColor: 'rgba(128,128,128,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  strengthLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  multilineInput: {
    height: 100,
    paddingTop: 16,
    paddingBottom: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
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
    letterSpacing: 0.3,
  },
});

export default AccountEditModal;
