import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  StatusBar,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { useConfirm } from '../lib/confirm';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabaseClient';
import Avatar from '../components/Avatar';
import SwipeableNoteCard from '../components/SwipeableNoteCard';

const PINNED_STORAGE_KEY = '@pinned_notes';

const NotesScreen = () => {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);

  // Animation
  useFocusEffect(
    useCallback(() => {
      opacity.value = withTiming(1, { duration: 500 });
      return () => {
        opacity.value = withTiming(0, { duration: 250 });
      };
    }, [])
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // State
  const [userId, setUserId] = useState(null);
  const [session, setSession] = useState(null);
  const [notes, setNotes] = useState([]);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'pinned', 'recent'
  const [sortBy, setSortBy] = useState('modified'); // 'modified', 'created', 'title'
  
  // Multi-select
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const currentUser = userData?.user;
      if (!currentUser) {
        throw new Error('Kullanıcı oturumu bulunamadı');
      }

      setUserId(currentUser.id);

      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData?.session);

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setNotes(data || []);
    } catch (err) {
      console.error('Fetch notes error:', err);
      showToast('Hata', err.message || 'Notlar yüklenemedi', 2000);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotes();
  }, [fetchNotes]);

  // Load pinned notes from storage
  const loadPinnedNotes = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(PINNED_STORAGE_KEY);
      if (stored) {
        setPinnedIds(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Load pinned notes error:', err);
    }
  }, []);

  const savePinnedNotes = useCallback(async (ids) => {
    try {
      await AsyncStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
      setPinnedIds(ids);
    } catch (err) {
      console.error('Save pinned notes error:', err);
    }
  }, []);

  // Initial load
  useFocusEffect(
    useCallback(() => {
      fetchNotes();
      loadPinnedNotes();
    }, [fetchNotes, loadPinnedNotes])
  );

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('notes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotes((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setNotes((prev) =>
              prev.map((note) => (note.id === payload.new.id ? payload.new : note))
            );
          } else if (payload.eventType === 'DELETE') {
            setNotes((prev) => prev.filter((note) => note.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Create note
  const handleCreateNote = useCallback(async () => {
    if (!userId) {
      Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
      return;
    }

    if (!newTitle.trim() && !newContent.trim()) {
      Alert.alert('Uyarı', 'Lütfen başlık veya içerik girin');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([{
          user_id: userId,
          title: newTitle.trim(),
          content: newContent.trim(),
        }])
        .select()
        .single();

      if (error) throw error;

      setNotes((prev) => [data, ...prev]);
      setShowAddModal(false);
      setNewTitle('');
      setNewContent('');
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Başarılı', 'Not oluşturuldu', 1500);
    } catch (err) {
      console.error('Create note error:', err);
      showToast('Hata', err.message || 'Not oluşturulamadı', 2000);
    } finally {
      setSaving(false);
    }
  }, [userId, newTitle, newContent, hapticsEnabled, showToast]);

  // Delete note
  const handleDeleteNote = useCallback(async (noteId) => {
    const ok = await confirm({
      title: 'Notu sil',
      message: 'Bu notu kalıcı olarak silmek istediğinize emin misiniz?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
    });

    if (!ok) return;

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      
      // Remove from pinned if exists
      if (pinnedIds.includes(noteId)) {
        const newPinned = pinnedIds.filter((id) => id !== noteId);
        savePinnedNotes(newPinned);
      }

      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Başarılı', 'Not silindi', 1500);
    } catch (err) {
      console.error('Delete note error:', err);
      showToast('Hata', err.message || 'Not silinemedi', 2000);
    }
  }, [confirm, pinnedIds, savePinnedNotes, hapticsEnabled, showToast]);

  // Pin/Unpin note
  const handleTogglePin = useCallback(async (noteId, shouldPin) => {
    let newPinned;
    if (shouldPin) {
      newPinned = [noteId, ...pinnedIds];
    } else {
      newPinned = pinnedIds.filter((id) => id !== noteId);
    }
    
    await savePinnedNotes(newPinned);
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast('Başarılı', shouldPin ? 'Not sabitlendi' : 'Sabitleme kaldırıldı', 1000);
  }, [pinnedIds, savePinnedNotes, hapticsEnabled, showToast]);

  // Multi-select
  const toggleSelect = useCallback((noteId) => {
    setSelectedIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;

    const ok = await confirm({
      title: 'Notları sil',
      message: `${selectedIds.length} notu silmek istediğinize emin misiniz?`,
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
    });

    if (!ok) return;

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      setNotes((prev) => prev.filter((note) => !selectedIds.includes(note.id)));
      
      // Remove from pinned
      const newPinned = pinnedIds.filter((id) => !selectedIds.includes(id));
      if (newPinned.length !== pinnedIds.length) {
        savePinnedNotes(newPinned);
      }

      setMultiSelect(false);
      setSelectedIds([]);
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Başarılı', `${selectedIds.length} not silindi`, 1500);
    } catch (err) {
      console.error('Bulk delete error:', err);
      showToast('Hata', err.message || 'Notlar silinemedi', 2000);
    }
  }, [selectedIds, confirm, pinnedIds, savePinnedNotes, hapticsEnabled, showToast]);

  // Filter and sort notes
  const filteredAndSortedNotes = useMemo(() => {
    let result = [...notes];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          (note.title || '').toLowerCase().includes(query) ||
          (note.content || '').toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filter === 'pinned') {
      result = result.filter((note) => pinnedIds.includes(note.id));
    } else if (filter === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = result.filter((note) => new Date(note.created_at) > sevenDaysAgo);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'modified') {
        return new Date(b.updated_at) - new Date(a.updated_at);
      } else if (sortBy === 'created') {
        return new Date(b.created_at) - new Date(a.created_at);
      } else if (sortBy === 'title') {
        return (a.title || 'Başlıksız').localeCompare(b.title || 'Başlıksız', 'tr');
      }
      return 0;
    });

    return result;
  }, [notes, searchQuery, filter, sortBy, pinnedIds]);

  // Categorize notes
  const categorizedNotes = useMemo(() => {
    const pinned = filteredAndSortedNotes.filter((note) => pinnedIds.includes(note.id));
    const unpinned = filteredAndSortedNotes.filter((note) => !pinnedIds.includes(note.id));
    return { pinned, unpinned };
  }, [filteredAndSortedNotes, pinnedIds]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: accent && theme.colors.backgroundTinted
            ? theme.colors.backgroundTinted
            : theme.colors.background,
        },
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
          backgroundColor: 'transparent',
        },
        toolbar: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12,
        },
        searchRow: {
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
          paddingHorizontal: 16,
          fontSize: 16,
          color: theme.colors.text,
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
        filterContainer: {
          flexDirection: 'row',
          gap: 8,
        },
        filterChip: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          borderWidth: 1.5,
        },
        filterChipActive: {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        filterChipInactive: {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        filterChipText: {
          fontSize: 15,
          fontWeight: '600',
        },
        filterChipTextActive: {
          color: theme.dark ? theme.colors.background : '#ffffff',
        },
        filterChipTextInactive: {
          color: theme.colors.textSecondary,
        },
        content: {
          flex: 1,
        },
        categorySection: {
          paddingHorizontal: 16,
          marginBottom: 16,
        },
        categoryHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        },
        categoryTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: theme.colors.text,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        categoryBadge: {
          backgroundColor: theme.colors.primary + '20',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 8,
          minWidth: 22,
          alignItems: 'center',
        },
        categoryBadgeText: {
          fontSize: 12,
          fontWeight: '700',
          color: theme.colors.primary,
        },
        emptyContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 60,
          paddingHorizontal: 32,
        },
        emptyIcon: {
          marginBottom: 16,
        },
        emptyTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 8,
          textAlign: 'center',
        },
        emptyText: {
          fontSize: 15,
          color: theme.colors.textSecondary,
          textAlign: 'center',
        },
        fab: {
          position: 'absolute',
          right: 20,
          bottom: 90 + insets.bottom,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
        multiSelectBar: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingHorizontal: 16,
          paddingVertical: 12,
          paddingBottom: insets.bottom + 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
        multiSelectText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
        },
        multiSelectActions: {
          flexDirection: 'row',
          gap: 12,
        },
        multiSelectButton: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: theme.colors.danger,
        },
        multiSelectButtonText: {
          fontSize: 15,
          fontWeight: '600',
          color: '#ffffff',
        },
        cancelButton: {
          backgroundColor: theme.colors.surfaceElevated,
        },
        cancelButtonText: {
          color: theme.colors.text,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        },
        modalContent: {
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 20,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 20,
          maxHeight: '90%',
        },
        modalHandle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.border,
          alignSelf: 'center',
          marginBottom: 20,
        },
        modalTitle: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 16,
        },
        input: {
          height: 52,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceElevated,
          paddingHorizontal: 16,
          fontSize: 16,
          color: theme.colors.text,
          marginBottom: 12,
        },
        textarea: {
          height: 150,
          textAlignVertical: 'top',
          paddingTop: 16,
        },
        modalActions: {
          flexDirection: 'row',
          gap: 12,
          marginTop: 8,
        },
        primaryButton: {
          flex: 1,
          height: 52,
          borderRadius: 12,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        primaryButtonText: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.dark ? theme.colors.background : '#ffffff',
        },
        secondaryButton: {
          flex: 1,
          height: 52,
          borderRadius: 12,
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        secondaryButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
        },
        sortOption: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        sortOptionText: {
          fontSize: 16,
          color: theme.colors.text,
        },
      }),
    [theme, accent, insets]
  );

  const renderCategory = (title, items, icon) => {
    if (items.length === 0) return null;

    return (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <MaterialCommunityIcons name={icon} size={14} color={theme.colors.primary} />
          <Text style={styles.categoryTitle}>{title}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{items.length}</Text>
          </View>
        </View>
        {items.map((note) => (
          <SwipeableNoteCard
            key={note.id}
            note={note}
            onPress={(n) => {
              if (multiSelect) {
                toggleSelect(n.id);
              } else {
                navigation.navigate('NoteDetail', { noteId: n.id });
              }
            }}
            onLongPress={(n) => {
              if (!multiSelect) {
                setMultiSelect(true);
                setSelectedIds([n.id]);
              }
            }}
            onEdit={(n) => {
              navigation.navigate('NoteDetail', { noteId: n.id });
            }}
            onDelete={handleDeleteNote}
            onPin={handleTogglePin}
            isSelected={selectedIds.includes(note.id)}
            multiSelect={multiSelect}
          />
        ))}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View style={styles.customHeader}>
          <View style={styles.keeperTitle}>
            <View style={styles.keeperIcon}>
              <MaterialCommunityIcons name="note-text" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.keeperText}>Keeper</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileButton}
            activeOpacity={0.7}
          >
            <Avatar
              name={session?.user?.user_metadata?.full_name || session?.user?.email}
              imageUrl={session?.user?.user_metadata?.avatar_url}
              size={40}
            />
          </TouchableOpacity>
        </View>

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Notlarda ara..."
              placeholderTextColor={theme.colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowSortModal(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="sort" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.filterContainer}>
            {['all', 'pinned', 'recent'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  filter === f ? styles.filterChipActive : styles.filterChipInactive,
                ]}
                onPress={() => {
                  setFilter(f);
                  if (hapticsEnabled) Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === f ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  {f === 'all' ? 'Tümü' : f === 'pinned' ? 'Sabitlendi' : 'Son 7 Gün'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        >
          {loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Yükleniyor...</Text>
            </View>
          ) : filteredAndSortedNotes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="note-outline"
                size={64}
                color={theme.colors.muted}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>Henüz not yok</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Arama sonucu bulunamadı' : 'Yeni bir not eklemek için + butonuna tıklayın'}
              </Text>
            </View>
          ) : (
            <>
              {categorizedNotes.pinned.length > 0 &&
                renderCategory('Sabitlenmiş', categorizedNotes.pinned, 'pin')}
              {categorizedNotes.unpinned.length > 0 &&
                renderCategory('Notlar', categorizedNotes.unpinned, 'note-text')}
            </>
          )}
        </ScrollView>

        {/* FAB */}
        {!multiSelect && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              setShowAddModal(true);
              if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={28} color="#ffffff" />
          </TouchableOpacity>
        )}

        {/* Multi-select bar */}
        {multiSelect && (
          <View style={styles.multiSelectBar}>
            <Text style={styles.multiSelectText}>{selectedIds.length} seçildi</Text>
            <View style={styles.multiSelectActions}>
              <TouchableOpacity
                style={[styles.multiSelectButton, styles.cancelButton]}
                onPress={() => {
                  setMultiSelect(false);
                  setSelectedIds([]);
                }}
              >
                <Text style={[styles.multiSelectButtonText, styles.cancelButtonText]}>İptal</Text>
              </TouchableOpacity>
              {selectedIds.length > 0 && (
                <TouchableOpacity style={styles.multiSelectButton} onPress={handleBulkDelete}>
                  <Text style={styles.multiSelectButtonText}>Sil</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Add Note Modal */}
        <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowAddModal(false)}
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Yeni Not</Text>
              <TextInput
                style={styles.input}
                placeholder="Başlık"
                placeholderTextColor={theme.colors.muted}
                value={newTitle}
                onChangeText={setNewTitle}
              />
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="İçerik"
                placeholderTextColor={theme.colors.muted}
                value={newContent}
                onChangeText={setNewContent}
                multiline
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setNewTitle('');
                    setNewContent('');
                  }}
                >
                  <Text style={styles.secondaryButtonText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleCreateNote}
                  disabled={saving}
                >
                  <Text style={styles.primaryButtonText}>
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Sort Modal */}
        <Modal
          visible={showSortModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSortModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSortModal(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Sıralama</Text>
              {[
                { key: 'modified', label: 'Değiştirilme Tarihi' },
                { key: 'created', label: 'Oluşturulma Tarihi' },
                { key: 'title', label: 'Başlık (A-Z)' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.sortOption}
                  onPress={() => {
                    setSortBy(option.key);
                    setShowSortModal(false);
                    if (hapticsEnabled) Haptics.selectionAsync();
                  }}
                >
                  <Text style={styles.sortOptionText}>{option.label}</Text>
                  {sortBy === option.key && (
                    <Ionicons name="checkmark" size={22} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </Animated.View>
    </GestureHandlerRootView>
  );
};

export default NotesScreen;
