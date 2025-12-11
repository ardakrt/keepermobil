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
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatDateTime = (value) => {
  if (!value) return 'Tarih ayarlanmadı';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih ayarlanmadı';
  return date.toLocaleString('tr-TR');
};

const ITEM_HEIGHT = 34;
const VISIBLE_COUNT = 5;

const wheelItemContainerStyle = { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' };

const WheelItem = React.memo(({ item, index, selectedIndex, formatItem, theme }) => {
  const isSelected = index === selectedIndex;

  const textStyle = {
    color: isSelected ? theme.colors.text : theme.colors.textSecondary,
    fontWeight: isSelected ? '700' : '400',
    fontSize: isSelected ? 20 : 16,
  };

  return (
    <View style={wheelItemContainerStyle}>
      <Text style={textStyle}>
        {formatItem ? formatItem(item, index) : item}
      </Text>
    </View>
  );
});

const WheelColumn = React.memo(({ data, selectedIndex, onSelect, width, formatItem, theme }) => {
  const listRef = useRef(null);
  const topBottomPad = ((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT;
  const isScrolling = useRef(false);

  useEffect(() => {
    if (listRef.current && typeof selectedIndex === 'number' && selectedIndex >= 0 && !isScrolling.current) {
      listRef.current.scrollToOffset({ offset: selectedIndex * ITEM_HEIGHT, animated: false });
    }
  }, [selectedIndex]);

  const onScrollBegin = useCallback(() => {
    isScrolling.current = true;
  }, []);

  const onEnd = useCallback(
    (e) => {
      if (!e?.nativeEvent?.contentOffset) return;

      const y = e.nativeEvent.contentOffset.y;
      let idx = Math.round(y / ITEM_HEIGHT);

      // Bounds check
      if (idx < 0) idx = 0;
      if (idx >= data.length) idx = data.length - 1;

      // Snap to exact position
      if (listRef.current) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToOffset({
            offset: idx * ITEM_HEIGHT,
            animated: true
          });
        });
      }

      // Update selection
      if (idx !== selectedIndex && onSelect) {
        onSelect(idx);
      }

      // Reset scrolling flag
      setTimeout(() => {
        isScrolling.current = false;
      }, 150);
    },
    [data.length, onSelect, selectedIndex]
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <WheelItem item={item} index={index} selectedIndex={selectedIndex} formatItem={formatItem} theme={theme} />
    ),
    [selectedIndex, formatItem, theme]
  );

  const keyExtractor = useCallback((item, idx) => `${item}-${idx}`, []);

  return (
    <View style={[{ height: ITEM_HEIGHT * VISIBLE_COUNT, overflow: 'hidden' }, width ? { width } : { flex: 1 }]}>
      <View
        style={{
          position: 'absolute',
          top: (ITEM_HEIGHT * VISIBLE_COUNT) / 2 - ITEM_HEIGHT / 2,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
          zIndex: 1,
        }}
      />
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={onScrollBegin}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        ListHeaderComponent={<View style={{ height: topBottomPad }} />}
        ListFooterComponent={<View style={{ height: topBottomPad }} />}
        renderItem={renderItem}
        initialNumToRender={15}
        removeClippedSubviews={false}
        maxToRenderPerBatch={20}
        updateCellsBatchingPeriod={100}
        windowSize={21}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
});

const RemindersScreen = ({ embedded = false }) => {
  const { theme, accent, mode } = useAppTheme();
  const { reduceMotion, hapticsEnabled } = usePrefs();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isDark = mode === 'dark' || (mode === 'system' && theme.colors.background === '#0b0b12');
  const [session, setSession] = useState(null);

  const [userId, setUserId] = useState(null);
  const { setCount } = useBadges();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

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
  const [sheetMode, setSheetMode] = useState('add');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerMode, setPickerMode] = useState('date'); // 'date' | 'time'
  const [allDayEnabled, setAllDayEnabled] = useState(false);
  const [timeMode, setTimeMode] = useState('interval'); // 'exact' | 'interval'

  const sheetOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animateSheetOpen = useCallback(() => {
    backdropOpacity.value = withTiming(1, { duration: 200 });
    sheetOpacity.value = withTiming(1, { duration: 200 });
  }, [backdropOpacity, sheetOpacity]);

  const animateSheetClose = useCallback((cb) => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    sheetOpacity.value = withTiming(0, { duration: 200 }, () => {
      if (cb) runOnJS(cb)();
    });
  }, [backdropOpacity, sheetOpacity]);

  const [notificationMap, setNotificationMap] = useState({});
  const notificationMapRef = useRef({});
  const { confirm, alert } = useConfirm();
  const { showToast } = useToast();

  const now = useCallback(() => new Date(), []);
  const clampFuture = useCallback((d) => {
    const n = new Date();
    if (d <= n) {
      const bump = new Date(n);
      bump.setMinutes(bump.getMinutes() + 5, 0, 0);
      return bump;
    }
    return d;
  }, []);

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

  const fetchReminders = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
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
      // await syncNotificationsForReminders(data ?? []); // REMOVED: Prevent duplicate scheduling
    } catch (err) {
      console.warn('Fetch reminders failed', err);
      setError(err.message ?? 'Hatırlatmalar yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [syncNotificationsForReminders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReminders(false);
    setRefreshing(false);
    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [fetchReminders, hapticsEnabled]);

  useFocusEffect(
    useCallback(() => {
      // Eğer hatırlatmalar zaten yüklüyse, arka planda yenile
      const shouldLoadBackground = reminders.length > 0;
      fetchReminders(shouldLoadBackground);
    }, [fetchReminders, reminders.length])
  );

  useEffect(() => {
    // Initial load
    fetchReminders();
  }, []); // Empty dependency array to run only once on mount

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel('reminders-channel')
      .on(
        'postgres_changes',
        {
          event: '*', // '*' means all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'reminders',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          setReminders((prev) => {
            if (payload.eventType === 'INSERT') {
              // Add new reminder and sort
              return [...prev.filter((item) => item.id !== payload.new.id), payload.new].sort(
                (a, b) => new Date(a.due_at) - new Date(b.due_at)
              );
            }
            if (payload.eventType === 'UPDATE') {
              // Update existing reminder and sort
              return prev
                .map((item) => (item.id === payload.new.id ? payload.new : item))
                .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
            }
            if (payload.eventType === 'DELETE') {
              // Remove deleted reminder
              return prev.filter((item) => item.id !== payload.old.id);
            }
            return prev; // Should not happen for the events we care about
          });

          // Update notifications based on event type
          if (payload.eventType === 'DELETE') {
            await cancelNotificationForReminder(payload.old.id);
          } else {
            // For INSERT and UPDATE, schedule/reschedule the notification
            await scheduleNotificationForReminder(payload.new);
          }
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
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
      await alert({
        type: 'warning',
        title: 'Başlık Gerekli',
        message: 'Hatırlatma oluşturmak için bir başlık girmelisin.',
        buttonText: 'Anladım',
      });
      return;
    }
    if (!userId) {
      await alert({
        type: 'error',
        title: 'Oturum Hatası',
        message: 'Oturum bilgisi bulunamadı. Lütfen uygulamayı yeniden başlatın.',
        buttonText: 'Tamam',
      });
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
          // Saniyeleri ve milisaniyeleri tam olarak sıfırla
          d.setSeconds(0);
          d.setMilliseconds(0);
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
    } catch (err) {
      console.warn('Insert reminder failed', err);
      await alert({
        type: 'error',
        title: 'Kayıt Hatası',
        message: err.message ?? 'Hatırlatma kaydedilemedi. Lütfen tekrar deneyin.',
        buttonText: 'Tamam',
      });
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
      await alert({
        type: 'warning',
        title: 'Başlık Gerekli',
        message: 'Hatırlatmayı güncellemek için bir başlık girmelisin.',
        buttonText: 'Anladım',
      });
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
        if (!Number.isNaN(d.getTime())) {
          // Saniyeleri ve milisaniyeleri tam olarak sıfırla
          d.setSeconds(0);
          d.setMilliseconds(0);
          updates.due_at = d.toISOString();
        } else {
          updates.due_at = null;
        }
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
      resetEditing();
      setShowBottomSheet(false);
      showToast('Başarılı', 'Hatırlatma güncellendi');
    } catch (err) {
      console.warn('Update reminder failed', err);
      await alert({
        type: 'error',
        title: 'Güncelleme Hatası',
        message: err.message ?? 'Hatırlatma güncellenemedi. Lütfen tekrar deneyin.',
        buttonText: 'Tamam',
      });
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
      if (editingId === reminderId) {
        resetEditing();
      }
      showToast('Silindi', 'Hatırlatma silindi');
    } catch (err) {
      console.warn('Delete reminder failed', err);
      await alert({
        type: 'error',
        title: 'Silme Hatası',
        message: err.message ?? 'Hatırlatma silinemedi. Lütfen tekrar deneyin.',
        buttonText: 'Tamam',
      });
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
        showToast('Tamamlandı', 'Hatırlatma tamamlandı olarak işaretlendi');
      } else {
        showToast('Geri alındı', 'Hatırlatma aktif olarak işaretlendi');
      }
    } catch (err) {
      console.warn('Toggle complete failed', err);
      showToast('Hata', 'İşlem başarısız oldu');
    }
  };

  const pad2 = useCallback((n) => String(n).padStart(2, '0'), []);

  const daysInMonth = useCallback((year, month) => new Date(year, month, 0).getDate(), []);

  const setYMD = useCallback((base, year, month, day) => {
    const nd = new Date(base);
    nd.setSeconds(0, 0);
    nd.setHours(nd.getHours(), nd.getMinutes());
    nd.setFullYear(year, month - 1, 1);
    const dim = new Date(year, month, 0).getDate();
    const safeDay = Math.min(day, dim);
    nd.setDate(safeDay);
    return nd;
  }, []);

  const handleOpenDateTimePicker = (mode) => {
    // Eğer time picker açılıyorsa, mevcut gerçek zamanı göster
    // (newDueDate default olarak +5 dakika olduğu için)
    let dateToSet;
    if (mode === 'time') {
      dateToSet = new Date();
      dateToSet.setSeconds(0);
      dateToSet.setMilliseconds(0);
    } else {
      dateToSet = new Date(newDueDate);
      dateToSet.setSeconds(0);
      dateToSet.setMilliseconds(0);
    }
    setPickerDate(dateToSet);
    setPickerMode(mode);
    setTimeMode('interval');
    setShowDatePicker(true);
  };

  const handleDatePickerConfirm = () => {
    // Saniyeleri ve milisaniyeleri sıfırla
    const finalDate = new Date(pickerDate);
    finalDate.setSeconds(0);
    finalDate.setMilliseconds(0);

    const clampedDate = clampFuture(finalDate);
    setNewDueDate(clampedDate);
    setShowDatePicker(false);
    setPickerMode('date');

    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Başarılı', 'Tarih ayarlandı');
  };

  const handleDatePickerCancel = () => {
    setShowDatePicker(false);
    setPickerMode('date');
    setTimeMode('interval');
  };

  // Kategori kartları için sayıları hesapla
  const categoryCounts = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const activeReminders = reminders.filter((r) => !r.is_completed);

    const today = activeReminders.filter((r) => {
      if (!r.due_at) return false;
      const dueDate = new Date(r.due_at);
      return dueDate >= startOfToday && dueDate < startOfTomorrow;
    }).length;

    const scheduled = activeReminders.filter((r) => r.due_at).length;
    const important = 0; // Önemli özelliği henüz yok
    const location = 0; // Konum özelliği henüz yok
    const noAlert = activeReminders.filter((r) => !r.due_at).length;
    const completed = reminders.filter((r) => r.is_completed).length;

    return {
      today,
      scheduled,
      important,
      location,
      noAlert,
      completed,
    };
  }, [reminders]);

  // Aktif hatırlatıcıları kategorilere ayır
  const categorizedReminders = useMemo(() => {
    const activeReminders = reminders.filter((r) => !r.is_completed);
    return activeReminders;
  }, [reminders]);

  // FlatList için optimize edilmiş callback'ler
  const renderReminderItem = useCallback(({ item }) => (
    <SwipeableReminderCard
      reminder={item}
      onEdit={handleStartEditing}
      onDelete={handleDeleteReminder}
      onToggleComplete={handleToggleComplete}
      isDeleting={deletingId === item.id}
    />
  ), [handleStartEditing, handleDeleteReminder, handleToggleComplete, deletingId]);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback((data, index) => ({
    length: 100, // Tahmini item yüksekliği
    offset: 100 * index,
    index,
  }), []);

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
        categoriesContainer: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: accent && theme.colors.backgroundTinted
            ? theme.colors.backgroundTinted
            : theme.colors.background,
        },
        categoriesGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        },
        categoryCard: {
          width: (SCREEN_WIDTH - 32 - 20) / 3,
          backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
          borderRadius: 16,
          padding: 16,
          gap: 8,
          borderWidth: 1,
          borderColor: isDark ? '#2c2c2e' : '#e5e5ea',
        },
        categoryIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        categoryLabel: {
          fontSize: 13,
          fontWeight: '500',
          color: theme.colors.textSecondary,
        },
        categoryCount: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
        },
        listSection: {
          flex: 1,
          backgroundColor: accent && theme.colors.backgroundTinted
            ? theme.colors.backgroundTinted
            : theme.colors.background,
        },
        listHeader: {
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 12,
        },
        listHeaderTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.colors.textSecondary,
        },
        scrollContent: {
          paddingHorizontal: 16,
          paddingBottom: 100,
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
        modalRoot: {
          flex: 1,
          backgroundColor: 'transparent',
          justifyContent: 'flex-end',
        },
        modalBackdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.5)',
        },
        bottomSheetContainer: {
          backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          paddingBottom: insets.bottom,


        },
        sheetHandle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.border,
          alignSelf: 'center',
          marginTop: 12,
          marginBottom: 8,
        },
        inputContainer: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#2c2c2e' : '#e5e5ea',
        },
        input: {
          fontSize: 16,
          color: theme.colors.text,
          paddingVertical: 8,
        },
        toolbar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderTopWidth: 1,
          borderTopColor: isDark ? '#2c2c2e' : '#e5e5ea',
        },
        toolbarButton: {
          padding: 8,
        },
        datePickerContainer: {
          backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: insets.bottom,
        },
        datePickerHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#2c2c2e' : '#e5e5ea',
        },
        datePickerTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: theme.colors.text,
        },
        calendarContainer: {
          paddingHorizontal: 16,
          paddingVertical: 20,
        },
        weekDays: {
          flexDirection: 'row',
          marginBottom: 12,
        },
        weekDay: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: 8,
        },
        weekDayText: {
          fontSize: 12,
          fontWeight: '600',
          color: theme.colors.textSecondary,
        },
        daysGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
        },
        dayCell: {
          width: `${100 / 7}%`,
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
        },
        dayButton: {
          width: '80%',
          aspectRatio: 1,
          borderRadius: 100,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dayButtonSelected: {
          backgroundColor: theme.colors.primary,
        },
        dayButtonToday: {
          borderWidth: 1,
          borderColor: theme.colors.primary,
        },
        dayText: {
          fontSize: 14,
          color: theme.colors.text,
        },
        dayTextSelected: {
          color: '#ffffff',
          fontWeight: '600',
        },
        dayTextWeekend: {
          color: '#ff3b30',
        },
        timePickerContainer: {
          paddingHorizontal: 16,
          paddingVertical: 20,
        },
        allDayToggle: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginBottom: 16,
        },
        allDayLabel: {
          fontSize: 16,
          color: theme.colors.text,
        },
        timeModeToggle: {
          flexDirection: 'row',
          gap: 8,
          marginBottom: 20,
        },
        timeModeButton: {
          flex: 1,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5',
          alignItems: 'center',
        },
        timeModeButtonActive: {
          backgroundColor: theme.colors.primary,
        },
        timeModeButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.textSecondary,
        },
        timeModeButtonTextActive: {
          color: '#ffffff',
        },
        wheelContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        wheelSeparator: {
          fontSize: 32,
          fontWeight: '700',
          color: theme.colors.text,
          marginHorizontal: 4,
        },
        pickerActions: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12,
          borderTopWidth: 1,
          borderTopColor: isDark ? '#2c2c2e' : '#e5e5ea',
        },
        pickerButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pickerCancelButton: {
          backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5',
        },
        pickerConfirmButton: {
          backgroundColor: theme.colors.primary,
        },
        pickerButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
        },
        pickerConfirmButtonText: {
          color: '#ffffff',
        },
      }),
    [theme, insets, isDark, accent]
  );

  // Calendar günlerini memoize et - çok maliyetli hesaplama
  const calendarDays = useMemo(() => {
    const year = pickerDate.getFullYear();
    const month = pickerDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = daysInMonth(year, month + 1);
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const days = [];
    for (let i = 0; i < offset; i++) {
      days.push(
        <View key={`empty-${i}`} style={styles.dayCell}>
          <View style={styles.dayButton} />
        </View>
      );
    }

    const today = new Date();
    const isToday = (day) => {
      return (
        today.getDate() === day &&
        today.getMonth() === month &&
        today.getFullYear() === year
      );
    };

    const isSelected = (day) => {
      return (
        pickerDate.getDate() === day &&
        pickerDate.getMonth() === month &&
        pickerDate.getFullYear() === year
      );
    };

    for (let day = 1; day <= daysCount; day++) {
      const dayOfWeek = new Date(year, month, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      days.push(
        <View key={day} style={styles.dayCell}>
          <TouchableOpacity
            style={[ 
              styles.dayButton,
              isSelected(day) && styles.dayButtonSelected,
              isToday(day) && !isSelected(day) && styles.dayButtonToday,
            ]}
            onPress={() => {
              const newDate = new Date(pickerDate);
              newDate.setDate(day);
              setPickerDate(newDate);
            }}
          >
            <Text
              style={[ 
                styles.dayText,
                isSelected(day) && styles.dayTextSelected,
                isWeekend && !isSelected(day) && styles.dayTextWeekend,
              ]}
            >
              {day}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return days;
  }, [pickerDate, styles, daysInMonth]);

  // Kategori kartları - memoize et
  const categories = useMemo(() => [
    {
      id: 'today',
      label: 'Bugün',
      count: categoryCounts.today,
      icon: 'calendar-today',
      iconColor: '#ff3b30',
      iconBg: '#ff3b3020',
    },
    {
      id: 'scheduled',
      label: 'Planlandı',
      count: categoryCounts.scheduled,
      icon: 'clock-outline',
      iconColor: '#007aff',
      iconBg: '#007aff20',
    },
    {
      id: 'important',
      label: 'Önemli',
      count: categoryCounts.important,
      icon: 'star',
      iconColor: '#ffcc00',
      iconBg: '#ffcc0020',
    },
  ], [categoryCounts]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Custom Header - sadece embedded değilse göster */}
        {!embedded && (
          <View style={styles.customHeader}>
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
        )}

        {/* Kategori Kartları */}
        <View style={styles.categoriesContainer}>
          <View style={styles.categoriesGrid}>
            {categories.map((category) => (
              <TouchableOpacity key={category.id} style={styles.categoryCard} activeOpacity={0.7}>
                <View style={[styles.categoryIcon, { backgroundColor: category.iconBg }]}>
                  <MaterialCommunityIcons name={category.icon} size={20} color={category.iconColor} />
                </View>
                <Text style={styles.categoryLabel}>{category.label}</Text>
                <Text style={styles.categoryCount}>{category.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Hatırlatıcı Listesi */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>Hatırlatmalar</Text>
          </View>
          {loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.emptyText, { marginTop: 16 }]}>Hatırlatmalar yükleniyor...</Text>
            </View>
          ) : categorizedReminders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="bell-off-outline"
                size={64}
                color={theme.colors.muted}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>Henüz hatırlatma yok</Text>
              <Text style={styles.emptyText}>
                Sağ alttaki + butonuna tıklayarak{/*\n*/}{"\n"}ilk hatırlatmanı ekle
              </Text>
            </View>
          ) : (
            <FlatList
              data={categorizedReminders}
              renderItem={renderReminderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
              }
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={10}
              initialNumToRender={10}
            />
          )}
        </View>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSheetMode('add');
            resetForm();
            setShowBottomSheet(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>

        {/* Bottom Sheet Modal for Add/Edit */}
        {showBottomSheet && (
          <Modal
            transparent
            statusBarTranslucent
            animationType="none"
            visible={showBottomSheet}
            onRequestClose={() => setShowBottomSheet(false)}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
              <View style={styles.modalRoot}>
                <Animated.View style={[styles.modalBackdrop, backdropStyle]}>
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
                  <View style={styles.sheetHandle} />

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      value={sheetMode === 'add' ? newTitle : editingTitle}
                      onChangeText={sheetMode === 'add' ? setNewTitle : setEditingTitle}
                      placeholder="Hatırlatıcı ekle"
                      placeholderTextColor={theme.colors.muted}
                      autoFocus
                      multiline
                    />
                  </View>

                  <View style={styles.toolbar}>
                    <TouchableOpacity
                      style={styles.toolbarButton}
                      onPress={() => {
                        if (sheetMode === 'add') {
                          handleAddReminder();
                        } else {
                          handleUpdateReminder();
                        }
                      }}
                    >
                      <MaterialCommunityIcons
                        name="check-circle-outline"
                        size={28}
                        color={theme.colors.textSecondary}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.toolbarButton}
                      onPress={() => handleOpenDateTimePicker('date')}
                    >
                      <MaterialCommunityIcons name="calendar" size={28} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* Date/Time Picker Modal */}
        {showDatePicker && (
          <Modal
            transparent
            statusBarTranslucent
            animationType="none"
            visible={showDatePicker}
            onRequestClose={handleDatePickerCancel}
          >
            <View style={styles.modalRoot}>
              <Animated.View style={[styles.modalBackdrop, backdropStyle]}>
                <Pressable style={{ flex: 1 }} onPress={handleDatePickerCancel} />
              </Animated.View>

              <Animated.View
                style={[styles.datePickerContainer, sheetStyle]}
                onLayout={() => animateSheetOpen()}
              >
                {pickerMode === 'date' ? (
                  <>
                    <View style={styles.datePickerHeader}>
                      <TouchableOpacity
                        onPress={() => {
                          const newDate = new Date(pickerDate);
                          newDate.setMonth(newDate.getMonth() - 1);
                          setPickerDate(newDate);
                        }}
                      >
                        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                      </TouchableOpacity>

                      <Text style={styles.datePickerTitle}>
                        {pickerDate.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}
                      </Text>

                      <TouchableOpacity
                        onPress={() => {
                          const newDate = new Date(pickerDate);
                          newDate.setMonth(newDate.getMonth() + 1);
                          setPickerDate(newDate);
                        }}
                      >
                        <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.calendarContainer}>
                      <View style={styles.weekDays}>
                        {['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT', 'PAZ'].map((day) => (
                          <View key={day} style={styles.weekDay}>
                            <Text style={styles.weekDayText}>{day}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.daysGrid}>
                        {calendarDays}
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.datePickerHeader}>
                      <Text style={styles.datePickerTitle}>Saat seç</Text>
                    </View>

                    <View style={styles.timePickerContainer}>
                      <View style={styles.allDayToggle}>
                        <Text style={styles.allDayLabel}>Gün boyu</Text>
                        <TouchableOpacity
                          onPress={() => setAllDayEnabled(!allDayEnabled)}
                          style={{
                            width: 51,
                            height: 31,
                            borderRadius: 16,
                            backgroundColor: allDayEnabled ? theme.colors.primary : theme.colors.border,
                            padding: 2,
                            justifyContent: 'center',
                          }}
                        >
                          <View
                            style={{
                              width: 27,
                              height: 27,
                              borderRadius: 14,
                              backgroundColor: '#ffffff',
                              transform: [{ translateX: allDayEnabled ? 20 : 0 }],
                            }}
                          />
                        </TouchableOpacity>
                      </View>

                      {!allDayEnabled && (
                        <>
                          <View style={styles.timeModeToggle}>
                            <TouchableOpacity
                              style={[styles.timeModeButton, timeMode === 'exact' && styles.timeModeButtonActive]}
                              onPress={() => setTimeMode('exact')}
                            >
                              <Text style={[styles.timeModeButtonText, timeMode === 'exact' && styles.timeModeButtonTextActive]}>
                                Tam saat
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.timeModeButton, timeMode === 'interval' && styles.timeModeButtonActive]}
                              onPress={() => setTimeMode('interval')}
                            >
                              <Text style={[styles.timeModeButtonText, timeMode === 'interval' && styles.timeModeButtonTextActive]}>
                                Aralık
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.wheelContainer}>
                            <WheelColumn
                              data={Array.from({ length: 24 }, (_, i) => i)}
                              selectedIndex={pickerDate.getHours()}
                              onSelect={(idx) => {
                                const newDate = new Date(pickerDate);
                                newDate.setHours(idx);
                                newDate.setSeconds(0);
                                newDate.setMilliseconds(0);
                                setPickerDate(newDate);
                              }}
                              formatItem={(v) => pad2(v)}
                              theme={theme}
                            />
                            <Text style={styles.wheelSeparator}>:</Text>
                            <WheelColumn
                              data={Array.from({ length: 60 }, (_, i) => i)}
                              selectedIndex={pickerDate.getMinutes()}
                              onSelect={(idx) => {
                                const newDate = new Date(pickerDate);
                                newDate.setMinutes(idx);
                                newDate.setSeconds(0);
                                newDate.setMilliseconds(0);
                                setPickerDate(newDate);
                              }}
                              formatItem={(v) => pad2(v)}
                              theme={theme}
                            />
                          </View>
                        </>
                      )}
                    </View>
                  </>
                )}

                <View style={styles.pickerActions}>
                  <TouchableOpacity
                    style={[styles.pickerButton, styles.pickerCancelButton]}
                    onPress={handleDatePickerCancel}
                  >
                    <Text style={styles.pickerButtonText}>İptal et</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pickerButton, styles.pickerConfirmButton]}
                    onPress={() => {
                      if (pickerMode === 'date') {
                        // Tarihten saate geçerken, mevcut gerçek saati kullan
                        const now = new Date();
                        const updatedDate = new Date(pickerDate);
                        updatedDate.setHours(now.getHours());
                        updatedDate.setMinutes(now.getMinutes());
                        updatedDate.setSeconds(0);
                        updatedDate.setMilliseconds(0);
                        setPickerDate(updatedDate);
                        setPickerMode('time');
                      } else {
                        handleDatePickerConfirm();
                      }
                    }}
                  >
                    <Text style={styles.pickerConfirmButtonText}>Tamamlandı</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          </Modal>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

export default RemindersScreen;