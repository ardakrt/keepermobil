import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
  BackHandler,
  Dimensions,
  PanResponder,
  StatusBar,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppTheme } from '../lib/theme';
import { useConfirm } from '../lib/confirm';
import { useToast } from '../lib/toast';
import { useBadges } from '../lib/badges';
import { usePrefs } from '../lib/prefs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import SwipeableReminderCard from '../components/SwipeableReminderCard';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabaseClient';
import {
  deleteReminderNotificationEntry,
  loadReminderNotificationMap,
  saveReminderNotificationMap,
} from '../lib/reminderNotificationStore';
import {
  setupNotificationChannels,
  scheduleReminderNotification,
  cancelReminderNotification,
  requestNotificationPermissions,
} from '../lib/notificationService';

const formatDateTime = (value) => {
  if (!value) return 'Tarih ayarlanmadı';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih ayarlanmadı';
  return date.toLocaleString('tr-TR');
};

const ITEM_HEIGHT = 34;
const VISIBLE_COUNT = 5;

const WheelItem = React.memo(({ item, index, selectedIndex, formatItem, theme }) => (
  <View style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: index === selectedIndex ? theme.colors.text : theme.colors.textSecondary, fontWeight: index === selectedIndex ? '700' : '400' }}>
      {formatItem ? formatItem(item, index) : item}
    </Text>
  </View>
));

const WheelColumn = React.memo(({ data, selectedIndex, onSelect, width, formatItem, theme }) => {
  const listRef = useRef(null);
  const topBottomPad = ((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT;

  useEffect(() => {
    if (listRef.current && typeof selectedIndex === 'number' && selectedIndex >= 0) {
      listRef.current.scrollToOffset({ offset: selectedIndex * ITEM_HEIGHT, animated: false });
    }
  }, [selectedIndex]);

  const onEnd = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    let idx = Math.round(y / ITEM_HEIGHT);
    if (idx < 0) idx = 0;
    if (idx > data.length - 1) idx = data.length - 1;
    if (listRef.current) {
      listRef.current.scrollToOffset({ offset: idx * ITEM_HEIGHT, animated: true });
    }
    if (idx !== selectedIndex) onSelect?.(idx);
  }, [data.length, onSelect, selectedIndex]);

  const renderItem = useCallback(({ item, index }) => (
    <WheelItem item={item} index={index} selectedIndex={selectedIndex} formatItem={formatItem} theme={theme} />
  ), [selectedIndex, formatItem, theme]);

  const keyExtractor = useCallback((item, idx) => `${item}-${idx}`, []);

  return (
    <View style={[{ height: ITEM_HEIGHT * VISIBLE_COUNT, overflow: 'hidden' }, width ? { width } : { flex: 1 }]}>
      <View style={{ position: 'absolute', top: (ITEM_HEIGHT * VISIBLE_COUNT) / 2 - ITEM_HEIGHT / 2, left: 0, right: 0, height: ITEM_HEIGHT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border, zIndex: 1 }} />
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        ListHeaderComponent={<View style={{ height: topBottomPad }} />}
        ListFooterComponent={<View style={{ height: topBottomPad }} />}
        renderItem={renderItem}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={11}
      />
    </View>
  );
});

const RemindersScreen = () => {
  const { theme, accent } = useAppTheme();
  const { reduceMotion, hapticsEnabled } = usePrefs();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const [session, setSession] = useState(null);

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

  const [userId, setUserId] = useState(null);
  const { setCount } = useBadges();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  // Filter state
  const [filter, setFilter] = useState('active'); // 'all', 'active', 'completed'

  // Quick actions FAB menu
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const quickMenuScale = useSharedValue(1);
  const quickMenuOpacity = useSharedValue(0);
  const quickMenuBackdropOpacity = useSharedValue(0);

  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState(() => {
    const base = new Date();
    base.setMinutes(base.getMinutes() + 5);
    base.setSeconds(0);
    base.setMilliseconds(0);
    return base;
  });

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDueDate, setEditingDueDate] = useState(new Date());

  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [sheetMode, setSheetMode] = useState('add'); // 'add' | 'edit' | 'quick'
  const [quickTemplate, setQuickTemplate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerStep, setPickerStep] = useState('date'); // 'date' | 'time'

  const sheetScale = useSharedValue(1);
  const sheetOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const quickMenuStyle = useAnimatedStyle(() => ({
    transform: [{ scale: quickMenuScale.value }],
    opacity: quickMenuOpacity.value,
  }));

  const quickMenuBackdropStyle = useAnimatedStyle(() => ({
    opacity: quickMenuBackdropOpacity.value,
  }));

  const animateSheetOpen = () => {
    backdropOpacity.value = withTiming(1, { duration: 150 });
    sheetOpacity.value = withTiming(1, { duration: 150 });
    sheetScale.value = withTiming(1, { duration: 150 });
  };

  const animateSheetClose = (cb) => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    sheetOpacity.value = withTiming(0, { duration: 150 });
    sheetScale.value = withTiming(1, { duration: 150 }, () => {
      if (cb) runOnJS(cb)();
    });
  };

  const animateQuickMenuOpen = () => {
    quickMenuBackdropOpacity.value = withTiming(1, { duration: 150 });
    quickMenuOpacity.value = withTiming(1, { duration: 150 });
    quickMenuScale.value = withTiming(1, { duration: 150 });
  };

  const animateQuickMenuClose = (cb) => {
    quickMenuBackdropOpacity.value = withTiming(0, { duration: 150 });
    quickMenuOpacity.value = withTiming(0, { duration: 150 });
    quickMenuScale.value = withTiming(1, { duration: 150 }, () => {
      if (cb) runOnJS(cb)();
    });
  };

  useEffect(() => {
    if (showQuickMenu) {
      quickMenuBackdropOpacity.value = 0;
      quickMenuOpacity.value = 0;
      quickMenuScale.value = 1;
      animateQuickMenuOpen();
    } else {
      quickMenuBackdropOpacity.value = 0;
      quickMenuOpacity.value = 0;
      quickMenuScale.value = 1;
    }
  }, [showQuickMenu]);

  const [notificationMap, setNotificationMap] = useState({});
  const notificationMapRef = useRef({});
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const now = () => new Date();
  const clampFuture = (d) => {
    const n = now();
    if (d <= n) {
      const bump = new Date(n);
      bump.setMinutes(bump.getMinutes() + 5, 0, 0);
      return bump;
    }
    return d;
  };

  const persistNotificationMap = useCallback(async (nextMap) => {
    notificationMapRef.current = nextMap;
    setNotificationMap(nextMap);
    await saveReminderNotificationMap(nextMap);
  }, []);

  useEffect(() => {
    try {
      const upcomingCount = reminders.filter(
        (r) => !r?.is_completed && r?.due_at && new Date(r.due_at) > new Date()
      ).length;
      setCount('reminders', upcomingCount);
    } catch {
      setCount('reminders', 0);
    }
  }, [reminders, setCount]);

  const cancelNotificationForReminder = useCallback(
    async (reminderId) => {
      const existingId = notificationMapRef.current[reminderId];
      if (!existingId) return;

      try {
        await cancelReminderNotification(existingId);
      } catch (err) {
        console.warn('Reminder notification cancel failed', err);
      } finally {
        const updated = { ...notificationMapRef.current };
        delete updated[reminderId];
        await persistNotificationMap(updated);
        await deleteReminderNotificationEntry(reminderId);
      }
    },
    [persistNotificationMap]
  );

  const scheduleNotificationForReminder = useCallback(
    async (reminder) => {
      if (!reminder?.id || !reminder?.due_at || reminder?.is_completed) {
        await cancelNotificationForReminder(reminder?.id);
        return;
      }

      const dueDate = new Date(reminder.due_at);
      if (Number.isNaN(dueDate.getTime()) || dueDate <= new Date()) {
        await cancelNotificationForReminder(reminder.id);
        return;
      }

      const existingId = notificationMapRef.current[reminder.id];
      if (existingId) {
        try {
          await cancelReminderNotification(existingId);
        } catch (err) {
          console.warn('Existing reminder notification cancel failed', err);
        }
      }

      try {
        await setupNotificationChannels();
        const hasPermission = await requestNotificationPermissions();
        if (!hasPermission) {
          showToast('Uyarı', 'Bildirim izni verilmedi', 2000);
          return;
        }

        const notificationId = await scheduleReminderNotification(reminder);

        const updated = {
          ...notificationMapRef.current,
          [reminder.id]: notificationId,
        };
        await persistNotificationMap(updated);
      } catch (err) {
        console.warn('Reminder notification schedule failed', err);
        showToast('Hata', 'Hatırlatma bildirimi ayarlanamadı', 2000);
      }
    },
    [cancelNotificationForReminder, persistNotificationMap, showToast]
  );

  const syncNotificationsForReminders = useCallback(
    async (items) => {
      await Promise.all(items.map((reminder) => scheduleNotificationForReminder(reminder)));
    },
    [scheduleNotificationForReminder]
  );

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [{ data: userData, error: userError }, storedMap] = await Promise.all([
        supabase.auth.getUser(),
        loadReminderNotificationMap(),
      ]);

      if (userError) throw userError;

      const currentUser = userData?.user;
      if (!currentUser) {
        setError('Oturum bilgisi alınamadı.');
        setReminders([]);
        return;
      }

      setUserId(currentUser.id);

      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData?.session);

      notificationMapRef.current = storedMap;
      setNotificationMap(storedMap);

      const { data, error: remindersError } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('due_at', { ascending: true });

      if (remindersError) throw remindersError;

      setReminders(data ?? []);
      await syncNotificationsForReminders(data ?? []);
    } catch (err) {
      console.warn('Fetch reminders failed', err);
      setError(err.message ?? 'Hatırlatmalar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [syncNotificationsForReminders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReminders();
    setRefreshing(false);
    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [fetchReminders, hapticsEnabled]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel('reminders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          setReminders((prev) => {
            if (payload.eventType === 'INSERT') {
              return [...prev.filter((item) => item.id !== payload.new.id), payload.new].sort(
                (a, b) => new Date(a.due_at) - new Date(b.due_at)
              );
            }
            if (payload.eventType === 'UPDATE') {
              return prev
                .map((item) => (item.id === payload.new.id ? payload.new : item))
                .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((item) => item.id !== payload.old.id);
            }
            return prev;
          });

          if (payload.eventType === 'DELETE') {
            await cancelNotificationForReminder(payload.old.id);
          } else {
            await scheduleNotificationForReminder(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cancelNotificationForReminder, scheduleNotificationForReminder, userId]);

  const resetForm = () => {
    setNewTitle('');
    const base = new Date();
    base.setMinutes(base.getMinutes() + 5);
    base.setSeconds(0);
    base.setMilliseconds(0);
    setNewDueDate(base);
  };

  const resetEditing = () => {
    setEditingId(null);
    setEditingTitle('');
    setEditingDueDate(new Date());
  };

  const handleAddReminder = async () => {
    if (!newTitle.trim()) {
      setError('Hatırlatma başlığı zorunlu.');
      return;
    }
    if (!userId) {
      setError('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        title: newTitle.trim(),
        user_id: userId,
        is_completed: false,
      };

      if (newDueDate) {
        const d = newDueDate instanceof Date ? newDueDate : new Date(newDueDate);
        if (!Number.isNaN(d.getTime())) {
          payload.due_at = d.toISOString();
        }
      }

      const { data, error: insertError } = await supabase
        .from('reminders')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      setReminders((prev) => {
        const toTime = (val) => {
          if (!val) return Number.POSITIVE_INFINITY;
          const d = new Date(val);
          const t = d.getTime();
          return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
        };
        return [...prev, data].sort((a, b) => toTime(a?.due_at) - toTime(b?.due_at));
      });

      resetForm();
      setShowBottomSheet(false);
      showToast('Başarılı', 'Hatırlatma eklendi');
      await scheduleNotificationForReminder(data);
    } catch (err) {
      console.warn('Insert reminder failed', err);
      setError(err.message ?? 'Hatırlatma kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditing = (reminder) => {
    setEditingId(reminder.id);
    setEditingTitle(reminder.title);
    setEditingDueDate(reminder.due_at ? new Date(reminder.due_at) : new Date());
    setSheetMode('edit');
    setShowBottomSheet(true);
  };

  const handleUpdateReminder = async () => {
    if (!editingId) return;
    if (!editingTitle.trim()) {
      setError('Güncelleme için başlık gerekli.');
      return;
    }

    setUpdating(true);
    setError('');

    try {
      const updates = {
        title: editingTitle.trim(),
      };
      if (editingDueDate) {
        const d = editingDueDate instanceof Date ? editingDueDate : new Date(editingDueDate);
        updates.due_at = Number.isNaN(d.getTime()) ? null : d.toISOString();
      } else {
        updates.due_at = null;
      }

      const { data, error: updateError } = await supabase
        .from('reminders')
        .update(updates)
        .eq('id', editingId)
        .select()
        .single();

      if (updateError) throw updateError;

      setReminders((prev) =>
        prev.map((item) => (item.id === data.id ? data : item)).sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      );
      await scheduleNotificationForReminder(data);
      resetEditing();
      setShowBottomSheet(false);
      showToast('Başarılı', 'Hatırlatma güncellendi');
    } catch (err) {
      console.warn('Update reminder failed', err);
      setError(err.message ?? 'Hatırlatma güncellenemedi.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteReminder = async (reminderId) => {
    const ok = await confirm({
      title: 'Hatırlatmayı sil',
      message: 'Bu hatırlatmayı kalıcı olarak silmek istiyor musunuz?',
      confirmText: 'Sil',
      cancelText: 'Vazgeç',
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(reminderId);
    setError('');

    try {
      const { error: deleteError } = await supabase.from('reminders').delete().eq('id', reminderId);
      if (deleteError) throw deleteError;

      setReminders((prev) => prev.filter((item) => item.id !== reminderId));
      await cancelNotificationForReminder(reminderId);
      if (editingId === reminderId) {
        resetEditing();
      }
      showToast('Silindi', 'Hatırlatma silindi');
    } catch (err) {
      console.warn('Delete reminder failed', err);
      setError(err.message ?? 'Hatırlatma silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleComplete = async (reminderId, newStatus) => {
    try {
      const { data, error: updateError } = await supabase
        .from('reminders')
        .update({
          is_completed: newStatus,
          completed_at: newStatus ? new Date().toISOString() : null,
        })
        .eq('id', reminderId)
        .select()
        .single();

      if (updateError) throw updateError;

      setReminders((prev) => prev.map((item) => (item.id === data.id ? data : item)));

      if (newStatus) {
        await cancelNotificationForReminder(reminderId);
        showToast('Tamamlandı', 'Hatırlatma tamamlandı olarak işaretlendi');
      } else {
        await scheduleNotificationForReminder(data);
        showToast('Geri alındı', 'Hatırlatma aktif olarak işaretlendi');
      }
    } catch (err) {
      console.warn('Toggle complete failed', err);
      showToast('Hata', 'İşlem başarısız oldu');
    }
  };

  const openQuickTemplate = (template) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const now = new Date();
    let dueDate = new Date();

    switch (template) {
      case '1hour':
        dueDate.setHours(dueDate.getHours() + 1);
        dueDate.setSeconds(0, 0);
        break;
      case 'tonight':
        dueDate.setHours(21, 0, 0, 0);
        if (dueDate <= now) dueDate.setDate(dueDate.getDate() + 1);
        break;
      case 'tomorrow':
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(9, 0, 0, 0);
        break;
      case 'custom':
        dueDate.setMinutes(dueDate.getMinutes() + 5);
        dueDate.setSeconds(0, 0);
        break;
      default:
        break;
    }

    resetForm();
    setNewDueDate(clampFuture(dueDate));
    setQuickTemplate(template);
    setSheetMode(template === 'custom' ? 'add' : 'quick');
    setShowQuickMenu(false);
    setShowBottomSheet(true);
  };

  const pad2 = (n) => String(n).padStart(2, '0');

  const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const setYMD = (base, year, month, day) => {
    const nd = new Date(base);
    nd.setSeconds(0, 0);
    nd.setHours(nd.getHours(), nd.getMinutes());
    nd.setFullYear(year, month - 1, 1);
    const dim = daysInMonth(year, month);
    const safeDay = Math.min(day, dim);
    nd.setDate(safeDay);
    return nd;
  };

  const handleOpenDatePicker = () => {
    setPickerDate(newDueDate);
    setPickerStep('date');
    setShowDatePicker(true);
  };

  const handleDatePickerConfirm = () => {
    const finalDate = clampFuture(pickerDate);
    setNewDueDate(finalDate);
    setShowDatePicker(false);
    setPickerStep('date');
    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Başarılı', 'Tarih ayarlandı');
  };

  const handleDatePickerCancel = () => {
    setShowDatePicker(false);
    setPickerStep('date');
  };

  // Filtered reminders
  const filteredReminders = useMemo(() => {
    if (filter === 'all') return reminders;
    if (filter === 'completed') return reminders.filter((r) => r.is_completed);
    return reminders.filter((r) => !r.is_completed);
  }, [reminders, filter]);

  // Categorize active reminders
  const categorizedReminders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const overdue = [];
    const today = [];
    const upcoming = [];

    filteredReminders.forEach((reminder) => {
      if (reminder.is_completed) return;

      const dueDate = reminder.due_at ? new Date(reminder.due_at) : null;
      if (!dueDate) {
        upcoming.push(reminder);
      } else if (dueDate < startOfToday) {
        overdue.push(reminder);
      } else if (dueDate >= startOfToday && dueDate < startOfTomorrow) {
        today.push(reminder);
      } else {
        upcoming.push(reminder);
      }
    });

    return { overdue, today, upcoming };
  }, [filteredReminders]);

  const completedReminders = useMemo(() => {
    return reminders.filter((r) => r.is_completed);
  }, [reminders]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor:
            accent && theme.colors.backgroundTinted ? theme.colors.backgroundTinted : theme.colors.background,
        },
        customHeader: {
          paddingTop: insets.top + 6,
          paddingHorizontal: 14,
          paddingBottom: 10,
          backgroundColor:
            accent && theme.colors.backgroundTinted ? theme.colors.backgroundTinted : theme.colors.background,
        },
        headerTop: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
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
          fontSize: 16,
          fontWeight: '600',
        },
        filterChipTextActive: {
          color: theme.dark ? theme.colors.background : '#ffffff',
        },
        filterChipTextInactive: {
          color: theme.colors.textSecondary,
        },
        scrollContent: {
          padding: 12,
          paddingBottom: 100,
        },
        categorySection: {
          marginBottom: 16,
        },
        categoryHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
          gap: 6,
          paddingHorizontal: 2,
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
        quickMenuContainer: {
          position: 'absolute',
          right: 20,
          bottom: 160 + insets.bottom,
          alignItems: 'flex-end',
          gap: 12,
        },
        quickMenuItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: theme.colors.surface,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        quickMenuText: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.colors.text,
        },
        quickMenuIcon: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
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
          fontSize: 14,
          color: theme.colors.textSecondary,
          textAlign: 'center',
        },
        modalRoot: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 40,
          zIndex: 9999,
        },
        modalBackdropFill: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 9998,
        },
        bottomSheetContainer: {
          backgroundColor:
            accent && theme.colors.surfaceTinted ? theme.colors.surfaceTinted : theme.colors.surface,
          borderRadius: 20,
          padding: 16,
          paddingBottom: 16,
          gap: 16,
          width: '100%',
          maxWidth: 400,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 24,
          zIndex: 10000,
        },
        bottomSheetHandle: {
          alignItems: 'center',
          paddingTop: 4,
          marginBottom: 8,
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.border,
        },
        sheetHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        sheetTitle: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.text,
        },
        closeButton: {
          padding: 8,
        },
        input: {
          height: 52,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor:
            accent && theme.colors.surfaceElevatedTinted
              ? theme.colors.surfaceElevatedTinted
              : theme.colors.surfaceElevated,
          color: theme.colors.text,
          paddingHorizontal: 16,
          fontSize: 16,
        },
        dateButton: {
          height: 52,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary,
          flexDirection: 'row',
          gap: 8,
        },
        dateButtonText: {
          color: theme.dark ? theme.colors.background : '#ffffff',
          fontWeight: '600',
          fontSize: 16,
        },
        datePreview: {
          color: theme.colors.textSecondary,
          fontSize: 14,
          textAlign: 'center',
        },
        primaryButton: {
          height: 52,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary,
        },
        primaryButtonText: {
          color: theme.dark ? theme.colors.background : '#ffffff',
          fontWeight: '700',
          fontSize: 16,
        },
        errorText: {
          color: theme.colors.danger,
          fontSize: 14,
          textAlign: 'center',
        },
        customPickerContainer: {
          backgroundColor:
            accent && theme.colors.surfaceTinted ? theme.colors.surfaceTinted : theme.colors.surface,
          borderRadius: 20,
          padding: 20,
          gap: 16,
          width: '100%',
          maxWidth: 400,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 24,
        },
        pickerHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        },
        pickerTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.colors.text,
        },
        pickerStepButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        pickerStepButtonActive: {
          backgroundColor: theme.colors.primary + '20',
          borderColor: theme.colors.primary,
        },
        pickerContent: {
          paddingVertical: 8,
        },
        wheelContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        wheelSeparator: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginHorizontal: 4,
        },
        pickerPreview: {
          backgroundColor: theme.colors.surfaceElevated,
          padding: 12,
          borderRadius: 12,
          alignItems: 'center',
        },
        pickerPreviewLabel: {
          fontSize: 12,
          color: theme.colors.textSecondary,
          marginBottom: 4,
        },
        pickerPreviewText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
        },
        pickerActions: {
          flexDirection: 'row',
          gap: 12,
        },
        pickerButton: {
          flex: 1,
          height: 48,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pickerCancelButton: {
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        pickerConfirmButton: {
          backgroundColor: theme.colors.primary,
        },
        pickerCancelButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
        },
        pickerConfirmButtonText: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.dark ? theme.colors.background : '#ffffff',
        },
      }),
    [theme, accent, insets]
  );

  const renderCategory = (title, items, icon, iconColor) => {
    if (items.length === 0) return null;

    return (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <MaterialCommunityIcons name={icon} size={14} color={iconColor} />
          <Text style={styles.categoryTitle}>{title}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{items.length}</Text>
          </View>
        </View>
        {items.map((reminder) => (
          <SwipeableReminderCard
            key={reminder.id}
            reminder={reminder}
            onEdit={handleStartEditing}
            onDelete={handleDeleteReminder}
            onToggleComplete={handleToggleComplete}
            isDeleting={deletingId === reminder.id}
          />
        ))}
      </View>
    );
  };

  const quickActions = [
    { id: '1hour', label: '1 saat sonra', icon: 'clock-fast' },
    { id: 'tonight', label: 'Bu akşam', icon: 'weather-night' },
    { id: 'tomorrow', label: 'Yarın sabah', icon: 'weather-sunny' },
    { id: 'custom', label: 'Özel tarih', icon: 'calendar-edit' },
  ];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

        {/* Custom Header */}
        <View style={styles.customHeader}>
          <View style={styles.headerTop}>
            <View style={styles.keeperTitle}>
              <View style={styles.keeperIcon}>
                <MaterialCommunityIcons name="bell-ring" size={22} color={theme.colors.primary} />
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

          {/* Filter Chips */}
          <View style={styles.filterContainer}>
            {['active', 'completed', 'all'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, filter === f ? styles.filterChipActive : styles.filterChipInactive]}
                onPress={() => {
                  setFilter(f);
                  if (hapticsEnabled) Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.filterChipText, filter === f ? styles.filterChipTextActive : styles.filterChipTextInactive]}>
                  {f === 'active' ? 'Aktif' : f === 'completed' ? 'Tamamlandı' : 'Tümü'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.emptyText, { marginTop: 16 }]}>Hatırlatmalar yükleniyor...</Text>
          </View>
        ) : filteredReminders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="bell-off-outline"
              size={64}
              color={theme.colors.muted}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {filter === 'completed' ? 'Tamamlanmış hatırlatma yok' : 'Henüz hatırlatma yok'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'completed'
                ? 'Tamamladığın hatırlatmalar burada görünecek'
                : 'Sağ alttaki + butonuna tıklayarak\nilk hatırlatmanı ekle'}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
          >
            {filter === 'all' || filter === 'active' ? (
              <>
                {renderCategory('Geçmiş', categorizedReminders.overdue, 'clock-alert-outline', theme.colors.danger)}
                {renderCategory('Bugün', categorizedReminders.today, 'calendar-today', theme.colors.warning)}
                {renderCategory('Yaklaşan', categorizedReminders.upcoming, 'calendar-clock', theme.colors.primary)}
              </>
            ) : null}
            {filter === 'all' || filter === 'completed' ? renderCategory('Tamamlananlar', completedReminders, 'check-circle-outline', theme.colors.success || '#10b981') : null}
          </ScrollView>
        )}

        {/* Quick Menu */}
        {showQuickMenu && (
          <Modal transparent statusBarTranslucent animationType="none" visible={showQuickMenu} onRequestClose={() => setShowQuickMenu(false)}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => animateQuickMenuClose(() => setShowQuickMenu(false))}
            >
              <Animated.View style={[{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' }, quickMenuBackdropStyle]} />
              <View style={{ flex: 1 }} pointerEvents="box-none">
                <Animated.View style={[styles.quickMenuContainer, quickMenuStyle]}>
                  {quickActions.map((action) => (
                    <View key={action.id}>
                      <TouchableOpacity style={styles.quickMenuItem} onPress={() => openQuickTemplate(action.id)} activeOpacity={0.7}>
                        <Text style={styles.quickMenuText}>{action.label}</Text>
                        <View style={styles.quickMenuIcon}>
                          <MaterialCommunityIcons name={action.icon} size={18} color={theme.colors.primary} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  ))}
                </Animated.View>
              </View>
            </Pressable>
          </Modal>
        )}

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowQuickMenu(!showQuickMenu);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color={theme.dark ? theme.colors.background : '#ffffff'} />
        </TouchableOpacity>

        {/* Bottom Sheet Modal for Add/Edit */}
        {showBottomSheet && (
          <Modal transparent statusBarTranslucent animationType="none" visible={showBottomSheet} onRequestClose={() => setShowBottomSheet(false)}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <View style={styles.modalRoot}>
                <Animated.View style={[styles.modalBackdropFill, backdropStyle]}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      animateSheetClose(() => {
                        setShowBottomSheet(false);
                        resetEditing();
                      });
                    }}
                  />
                </Animated.View>
                <Animated.View style={[styles.bottomSheetContainer, sheetStyle]} onLayout={() => animateSheetOpen()}>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>{sheetMode === 'add' || sheetMode === 'quick' ? 'Yeni Hatırlatma' : 'Hatırlatmayı Düzenle'}</Text>
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => {
                        animateSheetClose(() => {
                          setShowBottomSheet(false);
                          resetEditing();
                        });
                      }}
                    >
                      <Ionicons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.input}
                    value={sheetMode === 'add' || sheetMode === 'quick' ? newTitle : editingTitle}
                    onChangeText={sheetMode === 'add' || sheetMode === 'quick' ? setNewTitle : setEditingTitle}
                    placeholder="Hatırlatma başlığı"
                    placeholderTextColor={theme.colors.muted}
                    autoFocus={sheetMode === 'quick'}
                  />

                  {sheetMode === 'add' && (
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={handleOpenDatePicker}
                      onPressIn={() => hapticsEnabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                    >
                      <Ionicons name="calendar-outline" size={20} color={theme.dark ? theme.colors.background : '#ffffff'} />
                      <Text style={styles.dateButtonText}>Tarih & Saat Seç</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={styles.datePreview}>{formatDateTime(sheetMode === 'add' || sheetMode === 'quick' ? newDueDate : editingDueDate)}</Text>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={sheetMode === 'add' || sheetMode === 'quick' ? handleAddReminder : handleUpdateReminder}
                    onPressIn={() => hapticsEnabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                    disabled={sheetMode === 'add' || sheetMode === 'quick' ? saving : updating}
                  >
                    <Text style={styles.primaryButtonText}>
                      {sheetMode === 'add' || sheetMode === 'quick' ? (saving ? 'Kaydediliyor...' : 'Kaydet') : updating ? 'Güncelleniyor...' : 'Güncelle'}
                    </Text>
                  </TouchableOpacity>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </Animated.View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* Custom Date Time Picker */}
        {showDatePicker && (
          <Modal transparent statusBarTranslucent animationType="none" visible={showDatePicker} onRequestClose={handleDatePickerCancel}>
            <Pressable style={styles.modalRoot} onPress={handleDatePickerCancel}>
              <Animated.View style={[{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' }]} />
              <Pressable onPress={(e) => e.stopPropagation()}>
                <Animated.View
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(150)}
                  style={styles.customPickerContainer}
                >
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>
                    {pickerStep === 'date' ? 'Tarih Seç' : 'Saat Seç'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.pickerStepButton, pickerStep === 'date' && styles.pickerStepButtonActive]}
                      onPress={() => setPickerStep('date')}
                    >
                      <Ionicons name="calendar" size={18} color={pickerStep === 'date' ? theme.colors.primary : theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerStepButton, pickerStep === 'time' && styles.pickerStepButtonActive]}
                      onPress={() => setPickerStep('time')}
                    >
                      <Ionicons name="time" size={18} color={pickerStep === 'time' ? theme.colors.primary : theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {pickerStep === 'date' ? (
                  <View style={styles.pickerContent}>
                    {(() => {
                      const y = pickerDate.getFullYear();
                      const m = pickerDate.getMonth() + 1;
                      const d = pickerDate.getDate();

                      const years = Array.from({ length: 11 }, (_, i) => y - 5 + i);
                      const months = Array.from({ length: 12 }, (_, i) => i + 1);
                      const dim = daysInMonth(y, m);
                      const days = Array.from({ length: dim }, (_, i) => i + 1);

                      const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

                      const onDay = (idx) => {
                        const day = days[idx];
                        setPickerDate((prev) => setYMD(prev, y, m, day));
                      };
                      const onMonth = (idx) => {
                        const month = months[idx];
                        setPickerDate((prev) => setYMD(prev, y, month, d));
                      };
                      const onYear = (idx) => {
                        const year = years[idx];
                        setPickerDate((prev) => setYMD(prev, year, m, d));
                      };

                      return (
                        <View style={styles.wheelContainer}>
                          <WheelColumn
                            data={days}
                            selectedIndex={Math.max(0, d - 1)}
                            onSelect={onDay}
                            theme={theme}
                          />
                          <WheelColumn
                            data={months}
                            selectedIndex={Math.max(0, m - 1)}
                            onSelect={onMonth}
                            formatItem={(item) => monthNames[item - 1]}
                            theme={theme}
                          />
                          <WheelColumn
                            data={years}
                            selectedIndex={Math.max(0, years.indexOf(y))}
                            onSelect={onYear}
                            theme={theme}
                          />
                        </View>
                      );
                    })()}
                  </View>
                ) : (
                  <View style={styles.pickerContent}>
                    {(() => {
                      const hh = pickerDate.getHours();
                      const mm = pickerDate.getMinutes();

                      const hours = Array.from({ length: 24 }, (_, i) => i);
                      const minutes = Array.from({ length: 60 }, (_, i) => i);

                      const onHour = (idx) => {
                        const hour = hours[idx];
                        setPickerDate((prev) => {
                          const nd = new Date(prev);
                          nd.setHours(hour);
                          return nd;
                        });
                      };

                      const onMinute = (idx) => {
                        const minute = minutes[idx];
                        setPickerDate((prev) => {
                          const nd = new Date(prev);
                          nd.setMinutes(minute);
                          return nd;
                        });
                      };

                      return (
                        <View style={styles.wheelContainer}>
                          <WheelColumn
                            data={hours}
                            selectedIndex={Math.max(0, hours.indexOf(hh))}
                            onSelect={onHour}
                            formatItem={(v) => pad2(v)}
                            theme={theme}
                          />
                          <Text style={styles.wheelSeparator}>:</Text>
                          <WheelColumn
                            data={minutes}
                            selectedIndex={Math.max(0, minutes.indexOf(mm))}
                            onSelect={onMinute}
                            formatItem={(v) => pad2(v)}
                            theme={theme}
                          />
                        </View>
                      );
                    })()}
                  </View>
                )}

                <View style={styles.pickerPreview}>
                  <Text style={styles.pickerPreviewLabel}>Seçilen Tarih</Text>
                  <Text style={styles.pickerPreviewText}>{formatDateTime(pickerDate)}</Text>
                </View>

                <View style={styles.pickerActions}>
                  <TouchableOpacity
                    style={[styles.pickerButton, styles.pickerCancelButton]}
                    onPress={handleDatePickerCancel}
                  >
                    <Text style={styles.pickerCancelButtonText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pickerButton, styles.pickerConfirmButton]}
                    onPress={handleDatePickerConfirm}
                    onPressIn={() => hapticsEnabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  >
                    <Text style={styles.pickerConfirmButtonText}>Tamam</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </Animated.View>
    </GestureHandlerRootView>
  );
};

export default RemindersScreen;
