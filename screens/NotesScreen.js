import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Alert,
  StatusBar,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppTheme } from '../lib/theme';
import { useConfirm } from '../lib/confirm';
import { supabase } from '../lib/supabaseClient';
import Avatar from '../components/Avatar';

// Extracted and memoized NoteItem component
const NoteItem = React.memo(({ item, index, editingId, editingTitle, editingContent, selectedIds, multiSelect, grid, theme, accent, onStartEditing, onToggleSelect, onLongPress, onSave, onCancel, onChangeTitle, onChangeContent, navigation, noteCardSelectedStyle }) => {
  const isEditing = editingId === item.id;
  const isSelected = selectedIds.includes(item.id);

  return (
    <Animated.View
      entering={FadeInDown.duration(250).delay(index * 50)}
      exiting={FadeOutUp.duration(150)}
      layout={Layout.duration(300)}
      style={{ flex: 1 }}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        style={[
          styles(theme, accent).noteCard,
          multiSelect && isSelected ? noteCardSelectedStyle : null,
        ]}
        delayLongPress={300}
        onLongPress={() => onLongPress(item)}
        onPress={() => {
          if (isEditing) return;
          if (multiSelect) {
            onToggleSelect(item.id);
            return;
          }
          navigation.navigate('NoteDetail', { noteId: item.id });
        }}
      >
      {multiSelect ? (
        <View style={styles(theme, accent).selectBadge}>
          {isSelected ? (
            <View style={[styles(theme, accent).selectBadgeInner, { backgroundColor: theme.colors.primary }]}>
              <MaterialCommunityIcons name="check" size={14} color={theme.colors.background} />
            </View>
          ) : (
            <View style={[styles(theme, accent).selectBadgeInner, { backgroundColor: 'transparent' }]} />
          )}
        </View>
      ) : null}
      {isEditing ? (
        <>
          <TextInput
            style={styles(theme, accent).noteTitleInput}
            value={editingTitle}
            onChangeText={onChangeTitle}
            placeholder="Baslik"
            placeholderTextColor={theme.colors.muted}
          />
          <TextInput
            style={[styles(theme, accent).noteContentInput, styles(theme, accent).noteContentInputMultiline]}
            value={editingContent}
            onChangeText={onChangeContent}
            placeholder="Icerik"
            placeholderTextColor={theme.colors.muted}
            multiline
            textAlignVertical="top"
          />
          <View style={styles(theme, accent).noteActions}>
            <TouchableOpacity style={[styles(theme, accent).actionButton, styles(theme, accent).saveButton]} onPress={onSave}>
              <Text style={styles(theme, accent).actionText}>Kaydet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles(theme, accent).actionButton, styles(theme, accent).cancelButton]} onPress={onCancel}>
              <Text style={styles(theme, accent).actionText}>Vazgec</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles(theme, accent).noteHeaderRow}>
            <Text style={styles(theme, accent).noteTitle} numberOfLines={1} ellipsizeMode="tail">{(item.title || '').trim() || 'Başlıksız'}</Text>
            {!multiSelect ? (
              <TouchableOpacity
                style={styles(theme, accent).overflowBtn}
                onPress={() => onStartEditing(item)}
              >
                <MaterialCommunityIcons name="dots-vertical" size={16} color={theme.colors.text} />
              </TouchableOpacity>
            ) : null}
          </View>
          {(item.content || '').trim() ? (
            <Text
              style={styles(theme, accent).noteContent}
              numberOfLines={grid ? 2 : undefined}
              ellipsizeMode="tail"
            >
              {(item.content || '').trim()}
            </Text>
          ) : null}
          <Text style={styles(theme, accent).noteDate}>{new Date(item.created_at).toLocaleString()}</Text>
        </>
      )}
      </TouchableOpacity>
    </Animated.View>
  );
});

// Helper for dynamic styles in extracted component
const styles = (theme, accent) => StyleSheet.create({
  noteCard: {
    backgroundColor: accent && theme.colors.surfaceTinted
      ? theme.colors.surfaceTinted
      : theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: accent && theme.colors.borderTinted
      ? theme.colors.borderTinted
      : theme.colors.border,
    padding: 16,
    gap: 10,
    minHeight: 120,
    flex: 1,
  },
  selectBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  selectBadgeInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: accent && theme.colors.borderTinted
      ? theme.colors.borderTinted
      : theme.colors.border,
  },
  noteTitleInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: accent && theme.colors.borderTinted
      ? theme.colors.borderTinted
      : theme.colors.border,
    backgroundColor: accent && theme.colors.surfaceElevatedTinted
      ? theme.colors.surfaceElevatedTinted
      : theme.colors.surfaceElevated,
    color: theme.colors.text,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  noteContentInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: accent && theme.colors.borderTinted
      ? theme.colors.borderTinted
      : theme.colors.border,
    backgroundColor: accent && theme.colors.surfaceElevatedTinted
      ? theme.colors.surfaceElevatedTinted
      : theme.colors.surfaceElevated,
    color: theme.colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  noteContentInputMultiline: {
    height: 120,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  noteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButton: {
    backgroundColor: accent && theme.colors.surfaceElevatedTinted
      ? theme.colors.surfaceElevatedTinted
      : theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: accent && theme.colors.borderTinted
      ? theme.colors.borderTinted
      : theme.colors.border,
  },
  actionText: {
    color: theme.colors.background,
    fontWeight: '600',
  },
  noteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  noteTitle: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  overflowBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: accent && theme.colors.surfaceElevatedTinted
      ? theme.colors.surfaceElevatedTinted
      : theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: accent && theme.colors.borderTinted
      ? theme.colors.borderTinted
      : theme.colors.border,
  },
  noteContent: {
    color: theme.colors.textSecondary,
  },
  noteDate: {
    color: theme.colors.muted,
    fontSize: 12,
  },
});

const NotesScreen = ({ navigation, route, embedded = false }) => {
  const { theme, accent } = useAppTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight ? useBottomTabBarHeight() : 0;

  const screenStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: accent && theme.colors.backgroundTinted
            ? theme.colors.backgroundTinted
            : theme.colors.background,
        },
        contentPad: { paddingHorizontal: 16 },
        customHeader: {
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: accent && theme.colors.backgroundTinted
            ? theme.colors.backgroundTinted
            : theme.colors.background,
        },
        keeperTitle: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        keeperIcon: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: theme.colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: theme.colors.primary + '30',
        },
        keeperText: {
          color: theme.colors.text,
          fontWeight: '800',
          fontSize: 26,
          letterSpacing: 0.8,
        },
        profileButton: {
          padding: 3,
          borderRadius: 999,
          borderWidth: 2.5,
          borderColor: theme.colors.primary + '40',
          backgroundColor: theme.colors.surface,
        },
        header: {
          paddingTop: 8,
          paddingBottom: 12,
          gap: 12,
        },
        searchRow: {
          flexDirection: 'row',
          gap: 8,
        },
        iconButton: {
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        multiSelectToolbar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        multiSelectText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
        },
        multiSelectActions: {
          flexDirection: 'row',
          gap: 8,
        },
        searchInput: {
          flex: 1,
          height: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceElevated,
          color: theme.colors.text,
          paddingHorizontal: 16,
          fontSize: 16,
        },
        pillButton: {
          height: 40,
          paddingHorizontal: 12,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: accent && theme.colors.surfaceTinted
            ? theme.colors.surfaceTinted
            : theme.colors.surface,
          borderWidth: 1,
          borderColor: accent && theme.colors.borderTinted
            ? theme.colors.borderTinted
            : theme.colors.border,
        },
        pillText: { color: theme.colors.text },
        input: {
          height: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: accent && theme.colors.borderTinted
            ? theme.colors.borderTinted
            : theme.colors.border,
          backgroundColor: accent && theme.colors.surfaceElevatedTinted
            ? theme.colors.surfaceElevatedTinted
            : theme.colors.surfaceElevated,
          color: theme.colors.text,
          paddingHorizontal: 16,
          fontSize: 16,
        },
        textarea: {
          height: 110,
          paddingTop: 12,
          textAlignVertical: 'top',
        },
        primaryButton: {
          height: 48,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary,
        },
        primaryButtonText: {
          color: theme.colors.background,
          fontSize: 16,
          fontWeight: '700',
        },
        statusText: {
          color: theme.colors.info,
        },
        errorText: {
          color: theme.colors.danger,
        },
        listContent: {
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 96,
          gap: 12,
        },
        emptyState: {
          alignItems: 'center',
          gap: 8,
          paddingVertical: 20,
        },
        emptyText: {
          color: theme.colors.textSecondary,
        },
        retryButton: {
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 10,
          backgroundColor: accent && theme.colors.surfaceTinted
            ? theme.colors.surfaceTinted
            : theme.colors.surface,
          borderWidth: 1,
          borderColor: accent && theme.colors.borderTinted
            ? theme.colors.borderTinted
            : theme.colors.border,
        },
        retryText: {
          color: theme.colors.text,
          fontWeight: '600',
        },
        addTile: {
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 120,
          borderStyle: 'dashed',
          backgroundColor: accent && theme.colors.surfaceTinted
            ? theme.colors.surfaceTinted
            : theme.colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: accent && theme.colors.borderTinted
            ? theme.colors.borderTinted
            : theme.colors.border,
          padding: 16,
          gap: 10,
          flex: 1,
        },
        addTileText: {
          color: theme.colors.muted,
          marginTop: 8,
          fontWeight: '700',
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        },
        modalSheet: {
          backgroundColor: accent && theme.colors.surfaceTinted
            ? theme.colors.surfaceTinted
            : theme.colors.surface,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 16,
          gap: 12,
          borderWidth: 1,
          borderColor: accent && theme.colors.borderTinted
            ? theme.colors.borderTinted
            : theme.colors.border,
        },
        modalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
        row: { flexDirection: 'row', gap: 8 },
      }),
    [theme, accent, insets],
  );
  const [userId, setUserId] = useState(null);
  const [session, setSession] = useState(null);
  const { confirm } = useConfirm();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  const [grid, setGrid] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [showSort, setShowSort] = useState(false);
  const [sortBy, setSortBy] = useState('modified-desc'); // 'modified-asc' | 'title-asc' | 'title-desc'

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [pinnedIds, setPinnedIds] = useState([]);
  // Multi-select state
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const resetEditing = () => {
    setEditingId(null);
    setEditingTitle('');
    setEditingContent('');
  };

  const fetchNotes = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError('');

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        throw userError;
      }

      const currentUser = userData?.user;
      if (!currentUser) {
        setError('Oturum bilgisi alinamadi.');
        setNotes([]);
        return;
      }

      setUserId(currentUser.id);

      // Session bilgisini al
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData?.session);

      const { data, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (notesError) {
        throw notesError;
      }

      setNotes(data ?? []);
    } catch (err) {
      console.warn('Fetch notes failed', err);
      setError(err.message ?? 'Notlar yuklenirken hata olustu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Eğer notlar zaten yüklüyse, arka planda yenile (loading gösterme)
      const shouldLoadBackground = notes.length > 0;
      fetchNotes(shouldLoadBackground);
    }, [fetchNotes, notes.length])
  );

  // ... (rest of the logic: Load pinned notes, supabase channel, handlers) ...
  // Keeping the previous logic hooks...
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('PINNED_NOTE_IDS');
        if (raw) setPinnedIds(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const channel = supabase
      .channel('notes-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotes((prev) => {
            if (payload.eventType === 'INSERT') {
              const existing = prev.find((note) => note.id === payload.new.id);
              if (existing) {
                return prev.map((note) => (note.id === payload.new.id ? payload.new : note));
              }
              return [payload.new, ...prev];
            }

            if (payload.eventType === 'UPDATE') {
              return prev.map((note) => (note.id === payload.new.id ? payload.new : note));
            }

            if (payload.eventType === 'DELETE') {
              return prev.filter((note) => note.id !== payload.old.id);
            }

            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleAddNote = async () => {
    if (!title.trim()) {
      setError('Baslik alani zorunlu.');
      return;
    }

    if (!userId) {
      setError('Oturum bulunamadi, lutfen tekrar deneyin.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        user_id: userId,
      };

      const { data, error: insertError } = await supabase.from('notes').insert(payload).select().single();
      if (insertError) {
        throw insertError;
      }

      setNotes((prev) => {
        const existing = prev.find((note) => note.id === data.id);
        if (existing) {
          return prev.map((note) => (note.id === data.id ? data : note));
        }
        return [data, ...prev];
      });

      setTitle('');
      setContent('');
    } catch (err) {
      console.warn('Insert note failed', err);
      setError(err.message ?? 'Not kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditing = (note) => {
    setEditingId(note.id);
    setEditingTitle(note.title);
    setEditingContent(note.content ?? '');
  };

  const handleUpdateNote = async () => {
    if (!editingId) {
      return;
    }

    if (!editingTitle.trim()) {
      setError('Duzenleme icin baslik girilmesi gerekiyor.');
      return;
    }

    setUpdating(true);
    setError('');

    try {
      const updates = {
        title: editingTitle.trim(),
        content: editingContent.trim(),
      };

      const { data, error: updateError } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', editingId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setNotes((prev) => prev.map((note) => (note.id === data.id ? data : note)));
      resetEditing();
    } catch (err) {
      console.warn('Update note failed', err);
      setError(err.message ?? 'Not guncellenemedi.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    const ok = await confirm({
      title: 'Notu sil',
      message: 'Bu notu kalıcı olarak silmek istiyor musunuz?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      destructive: true,
    });
    if (!ok) return;
    setDeletingId(noteId);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('notes').delete().eq('id', noteId);
      if (deleteError) throw deleteError;
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      if (editingId === noteId) {
        resetEditing();
      }
    } catch (err) {
      console.warn('Delete note failed', err);
      setError(err.message ?? 'Not silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  const statusMessage = useMemo(() => {
    if (saving) return 'Kaydediliyor...';
    if (updating) return 'Guncelleniyor...';
    if (deletingId) return 'Siliniyor...';
    return '';
  }, [saving, updating, deletingId]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = notes;
    if (q) {
      arr = arr.filter(
        (n) => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q),
      );
    }
    const mod = (n) => new Date(n.updated_at || n.created_at || 0).getTime();
    const t = (n) => (n.title || '').toLowerCase();
    const sorted = [...arr].sort((a, b) => {
      const ap = pinnedIds.includes(a.id) ? 1 : 0;
      const bp = pinnedIds.includes(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      switch (sortBy) {
        case 'modified-asc': return mod(a) - mod(b);
        case 'title-asc': return t(a).localeCompare(t(b));
        case 'title-desc': return t(b).localeCompare(t(a));
        case 'modified-desc': default: return mod(b) - mod(a);
      }
    });
    return sorted;
  }, [notes, query, sortBy, pinnedIds]);

  const noteCardSelectedStyle = useMemo(() => ({
    borderColor: theme.colors.primary,
    backgroundColor: accent && theme.colors.surfaceElevatedTinted
      ? theme.colors.surfaceElevatedTinted
      : theme.colors.surfaceElevated
  }), [theme, accent]);

  const handleCreateEmptyNote = useCallback(async () => {
    if (!userId) {
      Alert.alert('Not', 'Oturum bulunamadı. Lütfen tekrar deneyin.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const payload = { user_id: userId, title: 'Başlıksız', content: '' };
      const { data, error } = await supabase.from('notes').insert(payload).select('*').single();
      if (error) throw error;
      setNotes((prev) => {
        const exists = prev.find((n) => n.id === data.id);
        return exists ? prev : [data, ...prev];
      });
      navigation.navigate('NoteDetail', { noteId: data.id });
    } catch (err) {
      console.warn('Create empty note failed', err);
      Alert.alert('Not', 'Yeni sayfa oluşturulamadı.');
    }
  }, [navigation, userId]);

  const effectiveListData = useMemo(
    () => (multiSelect ? filteredNotes : [{ __type: 'add' }, ...filteredNotes]),
    [filteredNotes, multiSelect],
  );

  const toggleSelect = useCallback(
    (id) => {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));
    },
    [setSelectedIds],
  );

  const handleSelectAllOrClear = useCallback(() => {
    const visibleIds = filteredNotes.map((n) => n.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id)) && visibleIds.length > 0;
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  }, [filteredNotes, selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedIds.length) return;
    const ok = await confirm({
      title: 'Seçili notları sil',
      message: `${selectedIds.length} notu kalıcı olarak silmek istiyor musunuz?`,
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      destructive: true,
    });
    if (!ok) return;
    setBulkDeleting(true);
    try {
      const { error: deleteError } = await supabase.from('notes').delete().in('id', selectedIds);
      if (deleteError) throw deleteError;
      setNotes((prev) => prev.filter((n) => !selectedIds.includes(n.id)));
      setPinnedIds((prev) => prev.filter((id) => !selectedIds.includes(id)));
      setSelectedIds([]);
      setMultiSelect(false);
    } catch (err) {
      console.warn('Bulk delete notes failed', err);
      setError(err.message ?? 'Notlar silinemedi.');
    } finally {
      setBulkDeleting(false);
    }
  }, [confirm, selectedIds]);

  const selectAllLabel = useMemo(() => {
    const visibleIds = filteredNotes.map((n) => n.id);
    if (!visibleIds.length) return 'Tümünü Seç';
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    return allSelected ? 'Seçimi Temizle' : 'Tümünü Seç';
  }, [filteredNotes, selectedIds]);

  const renderEmptyList = () => {
    if (loading) {
      return (
        <View style={screenStyles.emptyState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={screenStyles.emptyText}>Notlar yukleniyor...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={screenStyles.emptyState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={26} color={theme.colors.primary} accessibilityLabel="Hata simgesi" />
          <Text style={screenStyles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchNotes(false)} style={screenStyles.retryButton}>
            <Text style={screenStyles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!notes.length) {
      return (
        <View style={screenStyles.emptyState}>
          <MaterialCommunityIcons name="note-outline" size={28} color={theme.colors.primary} accessibilityLabel="Boş notlar simgesi" />
          <Text style={screenStyles.emptyText}>Henuz not eklenmemis.</Text>
        </View>
      );
    }

    return null;
  };

  const handleLongPressNote = useCallback((item) => {
    if (editingId === item.id) return;
    if (!multiSelect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMultiSelect(true);
      setSelectedIds((prev) => (prev.includes(item.id) ? prev : [item.id, ...prev]));
    } else {
      toggleSelect(item.id);
    }
  }, [editingId, multiSelect, toggleSelect]);

  const handlePressNote = useCallback((item) => {
    if (editingId === item.id) return;
    if (multiSelect) {
      toggleSelect(item.id);
      return;
    }
    navigation.navigate('NoteDetail', { noteId: item.id });
  }, [editingId, multiSelect, toggleSelect, navigation]);

  const handleStartEditingNote = useCallback((item) => {
    Haptics.selectionAsync();
    setSelectedNote(item);
    setShowQuick(true);
  }, []);

  const renderNoteItem = useCallback(({ item, index }) => {
    if (item.__type === 'add') {
      return (
        <Animated.View
          entering={FadeInDown.duration(250).delay(100)}
          exiting={FadeOutUp.duration(150)}
          layout={Layout.duration(300)}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            style={screenStyles.addTile}
            onPress={handleCreateEmptyNote}
          >
            <MaterialCommunityIcons name="plus" size={22} color={theme.colors.muted} />
            <Text style={screenStyles.addTileText}>Yeni sayfa</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }
    return (
      <NoteItem
        item={item}
        index={index}
        editingId={editingId}
        editingTitle={editingTitle}
        editingContent={editingContent}
        selectedIds={selectedIds}
        multiSelect={multiSelect}
        grid={grid}
        theme={theme}
        accent={accent}
        onStartEditing={handleStartEditingNote}
        onToggleSelect={toggleSelect}
        onLongPress={handleLongPressNote}
        onSave={handleUpdateNote}
        onCancel={resetEditing}
        onChangeTitle={setEditingTitle}
        onChangeContent={setEditingContent}
        navigation={navigation}
        noteCardSelectedStyle={noteCardSelectedStyle}
      />
    );
  }, [editingId, editingTitle, editingContent, selectedIds, multiSelect, grid, theme, accent, handleStartEditingNote, toggleSelect, handleLongPressNote, handleUpdateNote, resetEditing, setEditingTitle, setEditingContent, navigation, noteCardSelectedStyle, screenStyles, handleCreateEmptyNote]);

  return (
    <View style={screenStyles.container}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      {/* Custom Header - sadece embedded değilse göster */}
      {!embedded && (
        <View style={screenStyles.customHeader}>
          <View style={screenStyles.keeperTitle}>
            <View style={screenStyles.keeperIcon}>
              <MaterialCommunityIcons name="note-text" size={22} color={theme.colors.primary} />
            </View>
            <Text style={screenStyles.keeperText}>Keeper</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={screenStyles.profileButton}
            activeOpacity={0.7}
          >
            <Avatar
              name={session?.user?.user_metadata?.full_name || session?.user?.email}
              imageUrl={session?.user?.user_metadata?.avatar_url}
              size={40}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Modern Toolbar */}
      <View style={[screenStyles.header, screenStyles.contentPad]}>
        {!multiSelect ? (
          <>
            <View style={screenStyles.searchRow}>
              <TextInput
                style={screenStyles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Notlarda ara..."
                placeholderTextColor={theme.colors.muted}
              />
              <TouchableOpacity style={screenStyles.iconButton} onPress={() => setGrid((g) => !g)}>
                <MaterialCommunityIcons 
                  name={grid ? 'view-list' : 'view-grid'} 
                  size={22} 
                  color={theme.colors.text} 
                />
              </TouchableOpacity>
              <TouchableOpacity style={screenStyles.iconButton} onPress={() => setShowSort(true)}>
                <MaterialCommunityIcons name="sort" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={screenStyles.multiSelectToolbar}>            
            <Text style={screenStyles.multiSelectText}>{selectedIds.length} seçili</Text>
            <View style={screenStyles.multiSelectActions}>
              <TouchableOpacity style={screenStyles.pillButton} onPress={handleSelectAllOrClear}>
                <Text style={screenStyles.pillText}>{selectAllLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[screenStyles.pillButton, { borderColor: theme.colors.danger }]}
                onPress={handleBulkDelete}
                disabled={bulkDeleting || selectedIds.length === 0}
              >
                <Text style={[screenStyles.pillText, { color: theme.colors.danger }]}>
                  {bulkDeleting ? 'Siliniyor...' : 'Sil'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={screenStyles.pillButton}
                onPress={() => {
                  setMultiSelect(false);
                  setSelectedIds([]);
                }}
              >
                <Text style={screenStyles.pillText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={effectiveListData}
        key={grid ? 'grid' : 'list'}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={grid ? { gap: 12 } : undefined}
        keyExtractor={(item) => (item.__type === 'add' ? 'add-tile' : item.id)}
        renderItem={renderNoteItem}
        contentContainerStyle={[
          screenStyles.listContent,
          { paddingBottom: Math.max(96, (tabBarHeight || 0) + (insets.bottom || 0) + 72) },
        ]}
        ListEmptyComponent={renderEmptyList}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true} // Optimized
        initialNumToRender={10} // Optimized
        maxToRenderPerBatch={10} // Optimized
        windowSize={10} // Optimized
      />

      {/* FAB kaldırıldı; not detayı ekranı ile tek alan düzenine geçildi */}

  <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <TouchableOpacity style={screenStyles.modalOverlay} activeOpacity={1} onPress={() => setShowAdd(false)}>
          <View style={screenStyles.modalSheet}>
            <Text style={screenStyles.modalTitle}>Yeni Not</Text>
            <TextInput
              style={screenStyles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Not başlığı"
              placeholderTextColor={theme.colors.muted}
            />
            <TextInput
              style={[screenStyles.input, screenStyles.textarea]}
              value={content}
              onChangeText={setContent}
              placeholder="Not içeriği"
              placeholderTextColor={theme.colors.muted}
              multiline
              textAlignVertical="top"
            />
            <View style={screenStyles.row}>
              <TouchableOpacity
                style={[screenStyles.primaryButton, { flex: 1 }]}
                onPress={async () => {
                  await handleAddNote();
                  if (!saving && !error) setShowAdd(false);
                }}
              >
                <Text style={screenStyles.primaryButtonText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[screenStyles.pillButton, { flex: 1 }]}
                onPress={() => setShowAdd(false)}
              >
                <Text style={screenStyles.pillText}>Vazgeç</Text>
              </TouchableOpacity>
            </View>
            {statusMessage ? <Text style={screenStyles.statusText}>{statusMessage}</Text> : null}
            {error && !loading ? <Text style={screenStyles.errorText}>{error}</Text> : null}
          </View>
        </TouchableOpacity>
      </Modal>

  {/* Quick actions modal */}
      <Modal visible={showQuick} transparent animationType="fade" onRequestClose={() => setShowQuick(false)}>
        <TouchableOpacity style={screenStyles.modalOverlay} activeOpacity={1} onPress={() => setShowQuick(false)}>
          <View style={screenStyles.modalSheet}>
            <Text style={screenStyles.modalTitle}>Hızlı işlemler</Text>
            <TouchableOpacity
              style={[screenStyles.pillButton, { alignItems: 'flex-start' }]}
              onPress={() => {
                setShowQuick(false);
                if (selectedNote) handleStartEditing(selectedNote);
              }}
            >
              <Text style={screenStyles.pillText}>Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[screenStyles.pillButton, { alignItems: 'flex-start' }]}
              onPress={async () => {
                if (!selectedNote) return;
                try {
                  const raw = await AsyncStorage.getItem('PINNED_NOTE_IDS');
                  const arr = raw ? JSON.parse(raw) : [];
                  const next = arr.includes(selectedNote.id)
                    ? arr.filter((x) => x !== selectedNote.id)
                    : [selectedNote.id, ...arr];
                  await AsyncStorage.setItem('PINNED_NOTE_IDS', JSON.stringify(next));
                  setPinnedIds(next);
                } catch {}
                setShowQuick(false);
              }}
            >
              <Text style={screenStyles.pillText}>
                {selectedNote && pinnedIds.includes(selectedNote.id) ? 'Sabitlemeyi kaldır' : 'Sabitle'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[screenStyles.pillButton, { alignItems: 'flex-start', borderColor: theme.colors.danger }]}
              onPress={() => {
                setShowQuick(false);
                if (selectedNote) handleDeleteNote(selectedNote.id);
              }}
            >
              <Text style={[screenStyles.pillText, { color: theme.colors.danger }]}>Sil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[screenStyles.pillButton]} onPress={() => setShowQuick(false)}>
              <Text style={screenStyles.pillText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort modal */}
      <Modal visible={showSort} transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
        <TouchableOpacity style={screenStyles.modalOverlay} activeOpacity={1} onPress={() => setShowSort(false)}>
          <View style={screenStyles.modalSheet}>
            <Text style={screenStyles.modalTitle}>Sırala</Text>
            {[
              { key: 'modified-desc', label: 'Değiştirildiği tarih (↓)' },
              { key: 'modified-asc', label: 'Değiştirildiği tarih (↑)' },
              { key: 'title-asc', label: 'Başlık (A→Z)' },
              { key: 'title-desc', label: 'Başlık (Z→A)' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[screenStyles.pillButton, { alignItems: 'flex-start' }]}
                onPress={() => {
                  setSortBy(opt.key);
                  setShowSort(false);
                }}
              >
                <Text style={screenStyles.pillText}>
                  {opt.label} {sortBy === opt.key ? '•' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default NotesScreen;
 
