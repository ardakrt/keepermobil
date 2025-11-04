import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Share, StyleSheet, Text, TextInput, View, TouchableOpacity, Animated } from 'react-native';
import { useAppTheme } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useConfirm } from '../lib/confirm';

const deriveTitle = (text) => {
  const firstLine = (text || '').split(/\r?\n/)[0].trim();
  return firstLine.length ? firstLine.slice(0, 120) : 'Başlıksız';
};

const NoteDetailScreen = ({ route, navigation }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        header: {
          paddingTop: Platform.OS === 'android' ? 8 : 12,
          paddingHorizontal: 8,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'transparent',
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        },
        backButton: { padding: 8, borderRadius: 10 },
        titleInput: {
          flex: 1,
          height: 40,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceElevated,
          color: theme.colors.text,
          paddingHorizontal: 12,
          fontSize: 16,
        },
        rightActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        iconBtn: {
          padding: 8,
          borderRadius: 10,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        saveInfo: { color: theme.colors.muted, fontSize: 12, marginRight: 6 },
        dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.muted },
        editor: {
          flex: 1,
          color: theme.colors.text,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderColor: theme.colors.border,
          textAlignVertical: 'top',
          fontSize: 16,
        },
      }),
    [theme],
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
      try { Haptics.selectionAsync(); } catch {}
    } catch {}
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
      setPinned(next.includes(noteId));
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
      <BlurView
        intensity={40}
        tint={theme.colors.surface === '#ffffff' ? 'light' : 'dark'}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={onChangeTitle}
          placeholder="Başlıksız"
          placeholderTextColor={theme.colors.muted}
          returnKeyType="next"
        />
        <View style={styles.rightActions}>
          {saving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
              <Text style={styles.saveInfo}>Kaydediliyor…</Text>
            </View>
          ) : showSaved && lastSavedAt ? (
            <Text style={styles.saveInfo}>
              Kaydedildi {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.iconBtn} onPress={togglePin}>
            <MaterialCommunityIcons name={pinned ? 'star' : 'star-outline'} size={18} color={pinned ? theme.colors.warning : theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleCopyAll}>
            <MaterialCommunityIcons name="content-copy" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
            <MaterialCommunityIcons name="share-variant" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleDelete}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      </BlurView>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TextInput
          style={styles.editor}
          value={content}
          onChangeText={onChangeContent}
          placeholder="Notunuzu yazın..."
          placeholderTextColor={theme.colors.muted}
          multiline
          autoFocus
        />
      </KeyboardAvoidingView>
    </View>
  );
};

export default NoteDetailScreen;
