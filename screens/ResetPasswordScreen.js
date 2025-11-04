import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAppTheme } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../lib/toast';

const ResetPasswordScreen = ({ route, navigation }) => {
  const { token, email } = route?.params || {};
  const { theme } = useAppTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 16 },
    card: { gap: 12 },
    title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
    info: { color: theme.colors.textSecondary },
    error: { color: theme.colors.danger },
  }), [theme]);

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleReset = async () => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      if (!password || password.length < 6) { setError('Yeni şifre en az 6 hane olmalı.'); return; }
      const { data, error: e } = await supabase.auth.updateUser({ password });
      if (e) { setError(e.message); return; }
      setInfo('Şifren güncellendi.');
      showToast('Şifre güncellendi', 'Artık yeni şifrenle devam edebilirsin.', 3000);

      // Güvenli geri dönüş: stack yoksa köke yönlendir
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const hasSession = !!sessionData?.session;

        if (navigation.canGoBack()) {
          navigation.goBack();
        } else if (hasSession) {
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        }
      } catch (_) {
        // Her ihtimale karşı Auth'a gönder
        navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
      }
    } catch (err) {
      setError(err.message ?? 'Şifre güncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Yeni Şifre Belirle</Text>
        <Text style={styles.info}>E-posta: {email || '-'} • Token: {token ? 'Var' : 'Yok'}</Text>
        <Input
          label="Yeni şifre"
          secureTextEntry
          placeholder="••••••"
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <Button title="Şifreyi Güncelle" onPress={handleReset} loading={loading} />
      </View>
    </View>
  );
};

export default ResetPasswordScreen;
