import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Share, StyleSheet, Text, TextInput, View, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useConfirm } from '../lib/confirm';
import { useToast } from '../lib/toast';

const deriveTitle = (text) => {
  const firstLine = (text || '').split(/\r?\n/)[0].trim();
  return firstLine.length ? firstLine.slice(0, 120) : 'Başlıksız';
};

const NoteDetailScreen = ({ route, navigation }) => {
  const { theme, accent } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { 
          flex: 1, 
          backgroundColor: accent && theme.colors.backgroundTinted 
            ? theme.colors.backgroundTinted 
            : theme.colors.background 
        },
        header: {
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: accent && theme.colors.backgroundTinted 
            ? theme.colors.backgroundTinted 
            : theme.colors.background,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        },
        headerTop: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        },
        backButton: { 
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerTitle: {
          flex: 1,
          fontSize: 18,
          fontWeight: '600',
          color: theme.colors.text,
        },
        actionButtons: {
          flexDirection: 'row',
          gap: 8,
        },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        titleInput: {
          height: 56,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceElevated,
          color: theme.colors.text,
          paddingHorizontal: 16,
          fontSize: 20,
          fontWeight: '700',
        },
        statusBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: accent && theme.colors.surfaceTinted 
            ? theme.colors.surfaceTinted 
            : theme.colors.surface,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        },
        statusText: { 
          fontSize: 13, 
          color: theme.colors.muted,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        savingDot: { 
          width: 6, 
          height: 6, 
          borderRadius: 3, 
          backgroundColor: theme.colors.primary 
        },
        editor: {
          flex: 1,
          color: theme.colors.text,
          paddingHorizontal: 20,
          paddingVertical: 20,
          backgroundColor: accent && theme.colors.surfaceTinted 
            ? theme.colors.surfaceTinted 
            : theme.colors.surface,
          textAlignVertical: 'top',
          fontSize: 17,
          lineHeight: 26,
        },
      }),
    [theme, accent, insets],
  );

  const noteIdParam = route?.params?.noteId ?? null;
  const [noteId, setNoteId] = useState(noteIdParam);
  const [userId, setUserId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const debounceRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const dotOpacity = useRef(new Animated.Value(0.3)).current;
  const [pinned, setPinned] = useState(false);
  const { confirm } = useConfirm();

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      setUserId(userData?.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!noteId) return;
      try {
        const raw = await AsyncStorage.getItem('PINNED_NOTE_IDS');
        const arr = raw ? JSON.parse(raw) : [];
        setPinned(arr.includes(noteId));
      } catch {}
    })();
  }, [noteId]);

  useEffect(() => {
    let anim;
    if (saving) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      );
      anim.start();
    } else {
      dotOpacity.stopAnimation();
      dotOpacity.setValue(0.3);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [dotOpacity, saving]);

  const loadNote = useCallback(async (id) => {
    try {
      const { data, error } = await supabase.from('notes').select('*').eq('id', id).single();
      if (error) {
        if (error.code === 'PGRST116') {
          Alert.alert('Not Bulunamadı', 'Bu not silinmiş veya taşınmış olabilir.');
          navigation.goBack();
        } else {
          throw error;
        }
      }
      setTitle(data?.title ?? '');
      setContent(data?.content ?? '');
      navigation.setOptions({ title: data?.title ?? deriveTitle(data?.content ?? '') });
    } catch (err) {
      console.warn('Load note failed', err);
      Alert.alert('Not', 'Not yüklenemedi.');
    }
  }, [navigation]);

  const createNote = useCallback(async () => {
    try {
      if (!userId) return null;
      const payload = { user_id: userId, title: '', content: '' };
      const { data, error } = await supabase.from('notes').insert(payload).select('*').single();
      if (error) throw error;
      setNoteId(data.id);
      return data.id;
    } catch (err) {
      console.warn('Create note failed', err);
      Alert.alert('Not', 'Yeni not oluşturulamadı.');
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (noteIdParam) {
      loadNote(noteIdParam);
    }
  }, [loadNote, noteIdParam]);

  const saveNote = useCallback(
    async (id, nextTitle, nextContent) => {
      try {
        setSaving(true);
        const safeTitle = (nextTitle ?? '').trim() || deriveTitle(nextContent ?? '');
        const updates = { title: safeTitle, content: nextContent ?? '', updated_at: new Date().toISOString() };
        const { error } = await supabase.from('notes').update(updates).eq('id', id);
        if (error) throw error;
        navigation.setOptions({ title: safeTitle });
        setLastSavedAt(new Date());
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 1600);
      } catch (err) {
        console.warn('Save note failed', err);
      }
      finally {
        setSaving(false);
      }
    },
    [navigation],
  );

  const scheduleSave = async (nextTitle, nextContent) => {
    const ensureId = noteId ?? (await createNote());
    if (!ensureId) return;
    if (!noteId) setNoteId(ensureId);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNote(ensureId, nextTitle, nextContent), 400);
  };

  const onChangeTitle = async (text) => {
    setTitle(text);
    await scheduleSave(text, content);
  };

  const onChangeContent = async (text) => {
    setContent(text);
    await scheduleSave(title, text);
  };

  const getShareText = () => {
    const t = (title || '').trim() || deriveTitle(content);
    const c = (content || '').trim();
    return c ? `${t}\n\n${c}` : t;
  };

  const handleCopyAll = async () => {
    try {
      await Clipboard.setStringAsync(getShareText());
      showToast('Başarılı', 'Not kopyalandı', 1500);
      try { Haptics.selectionAsync(); } catch {}
    } catch {
      showToast('Hata', 'Kopyalanamadı', 1500);
    }
  };

  const handleShare = async () => {
    try {
      const t = (title || '').trim() || 'Başlıksız';
      const md = `${t ? `# ${t}\n\n` : ''}${content?.trim() ?? ''}`.trim() || t;
      await Share.share({ message: md, title: t });
    } catch {}
  };

  const togglePin = async () => {
    if (!noteId) return;
    try {
      const raw = await AsyncStorage.getItem('PINNED_NOTE_IDS');
      const arr = raw ? JSON.parse(raw) : [];
      const next = arr.includes(noteId) ? arr.filter((x) => x !== noteId) : [noteId, ...arr];
      await AsyncStorage.setItem('PINNED_NOTE_IDS', JSON.stringify(next));
      const isPinned = next.includes(noteId);
      setPinned(isPinned);
      showToast('Başarılı', isPinned ? 'Not sabitlendi' : 'Sabitleme kaldırıldı', 1000);
      try { Haptics.selectionAsync(); } catch {}
    } catch {}
  };

  const handleDelete = async () => {
    if (!noteId) return;
    const ok = await confirm({
      title: 'Notu sil',
      message: 'Bu notu kalıcı olarak silmek istiyor musunuz?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      destructive: true,
    });
    if (!ok) return;
    try {
      await supabase.from('notes').delete().eq('id', noteId);
      navigation.goBack();
    } catch (err) {
      console.warn('Delete note (detail) failed', err);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      
      {/* Modern Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title || 'Yeni Not'}
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.iconBtn} onPress={togglePin}>
              <Ionicons 
                name={pinned ? 'star' : 'star-outline'} 
                size={20} 
                color={pinned ? theme.colors.warning : theme.colors.text} 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleCopyAll}>
              <Ionicons name="copy-outline" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Title Input */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={onChangeTitle}
          placeholder="Başlık"
          placeholderTextColor={theme.colors.muted}
          returnKeyType="next"
        />
      </View>

      {/* Status Bar */}
      {(saving || (showSaved && lastSavedAt)) && (
        <View style={styles.statusBar}>
          {saving ? (
            <View style={styles.statusText}>
              <Animated.View style={[styles.savingDot, { opacity: dotOpacity }]} />
              <Text style={{ fontSize: 13, color: theme.colors.muted }}>Kaydediliyor...</Text>
            </View>
          ) : showSaved && lastSavedAt ? (
            <Text style={styles.statusText}>
              ✓ Kaydedildi {lastSavedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          ) : null}
        </View>
      )}

      {/* Editor */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TextInput
          style={styles.editor}
          value={content}
          onChangeText={onChangeContent}
          placeholder="Notunuzu yazın..."
          placeholderTextColor={theme.colors.muted}
          multiline
          autoFocus={!noteIdParam}
        />
      </KeyboardAvoidingView>
    </View>
  );
};

export default NoteDetailScreen;
