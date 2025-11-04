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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { useToast } from '../lib/toast';

const AccountEditModal = ({ visible, account, onClose, onSave, mode = 'add' }) => {
  const { theme } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const { showToast } = useToast();

  const [service, setService] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && account && mode === 'edit') {
      setService(account.service || '');
      setUsername(account.username_enc || '');
      setPassword(account.password_enc || '');
      setNote(account.note || '');
    } else if (visible && mode === 'add') {
      resetForm();
    }
  }, [visible, account, mode]);

  const resetForm = () => {
    setService('');
    setUsername('');
    setPassword('');
    setNote('');
    setShowPassword(false);
    setError('');
  };

  const validateAccount = () => {
    if (!service.trim() || !username.trim() || !password.trim()) {
      setError('Etiket, kullanıcı adı ve parola zorunludur.');
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
      const accountData = {
        service: service.trim(),
        username_enc: username.trim(),
        password_enc: password.trim(),
        note: note.trim(),
      };

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
        // Email formatında mı kontrol et
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (emailRegex.test(text.trim())) {
          setUsername(text.trim());
          showToast('E-posta yapıştırıldı');
          
          if (hapticsEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          // Email değilse yine de yapıştır ama uyar
          setUsername(text.trim());
          showToast('Panodaki metin yapıştırıldı');
        }
      } else {
        showToast('Panoda metin bulunamadı');
      }
    } catch (error) {
      console.log('Clipboard error:', error);
      showToast('Yapıştırma hatası');
    }
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
        <LinearGradient
          colors={
            theme.dark
              ? [theme.colors.surface, theme.colors.background]
              : [theme.colors.surface, theme.colors.background]
          }
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.colors.surfaceElevated }]}
              onPress={handleClose}
              onPressIn={() => {
                if (hapticsEnabled) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={32} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                {mode === 'add' ? 'Yeni Hesap Ekle' : 'Hesabı Düzenle'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
                {mode === 'add'
                  ? 'Hesap bilgileriniz güvenle saklanacak'
                  : 'Hesap bilgilerini güncelleyin'}
              </Text>
            </View>

            <View style={styles.headerIcon}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons
                  name={mode === 'add' ? 'add-circle' : 'create'}
                  size={28}
                  color={theme.colors.primary}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Form */}
          <View style={styles.form} accessibilityRole="form">
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                Hizmet / Platform
              </Text>
              <TextInput
                nativeID="service-input"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={service}
                onChangeText={setService}
                placeholder="örn. Google, Netflix, Trendyol"
                placeholderTextColor={theme.colors.muted}
                autoComplete="off"
                importantForAutofill="yes"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                Kullanıcı Adı / E-posta
              </Text>
              <View style={styles.inputWithButton}>
                <TextInput
                  id="username"
                  name="username"
                  style={[
                    styles.input,
                    styles.inputWithGoogleButton,
                    {
                      backgroundColor: theme.colors.surfaceElevated,
                      borderColor: theme.colors.border,
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
                  dataDetectorTypes="none"
                  importantForAutofill="yes"
                  autoFocus={false}
                  editable={true}
                  selectTextOnFocus={true}
                />
                <TouchableOpacity 
                  style={[styles.pasteButton, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}
                  onPress={handlePasteEmail}
                  onPressIn={() => {
                    if (hapticsEnabled) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <Ionicons name="clipboard-outline" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>
                Parola
              </Text>
              <View style={styles.passwordContainer} importantForAutofill="yes">
                <TextInput
                  id="password"
                  name="password"
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: theme.colors.surfaceElevated,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                  importantForAutofill="yes"
                  passwordRules="minlength: 8;"
                  editable={true}
                  {...Platform.select({
                    android: {
                      importantForAutofill: 'yes',
                      autoComplete: 'password',
                    },
                    ios: {
                      textContentType: mode === 'add' ? 'newPassword' : 'password',
                    }
                  })}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  onPressIn={() => {
                    if (hapticsEnabled) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
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
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.border,
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
          <View style={[styles.infoBox, { backgroundColor: theme.colors.surfaceElevated }]}>
            <Ionicons name="shield-checkmark" size={20} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Hesap bilgileriniz güvenli bir şekilde saklanır. Sadece siz erişebilirsiniz.
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
                  {mode === 'add' ? 'Hesap Ekle' : 'Değişiklikleri Kaydet'}
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
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 28,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  headerIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 15,
    padding: 4,
  },
  inputWithButton: {
    flexDirection: 'row',
    gap: 8,
  },
  inputWithGoogleButton: {
    flex: 1,
  },
  pasteButton: {
    width: 50,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multilineInput: {
    height: 100,
    paddingTop: 16,
    paddingBottom: 16,
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

export default AccountEditModal;
