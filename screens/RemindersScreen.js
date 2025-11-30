import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
  Pressable,
  BackHandler,
  Dimensions,
  PanResponder,
  StatusBar,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Animated, {
  FadeInDown,
  FadeOutUp,
  FadeIn,
  FadeOut,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/theme';
import { useConfirm } from '../lib/confirm';
import { useToast } from '../lib/toast';
import { useBadges } from '../lib/badges';
import { usePrefs } from '../lib/prefs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabaseClient';
import {
  deleteReminderNotificationEntry,
  loadReminderNotificationMap,
  saveReminderNotificationMap,
} from '../lib/reminderNotificationStore';

// Relative time formatter
const getRelativeTime = (date) => {
  if (!date) return 'Tarih ayarlanmadı';
  const now = new Date();
  const target = new Date(date);
  const diffMs = target - now;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) {
    const absMins = Math.abs(diffMins);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);

    if (absMins < 60) return `${absMins} dakika önce`;
    if (absHours < 24) return `${absHours} saat önce`;
    return `${absDays} gün önce`;
  }

  if (diffMins < 60) return `${diffMins} dakika sonra`;
  if (diffHours < 24) return `${diffHours} saat sonra`;
  if (diffDays < 7) return `${diffDays} gün sonra`;

  return target.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDateTime = (value) => {
  if (!value) return 'Tarih ayarlanmadı';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih ayarlanmadı';
  return date.toLocaleString('tr-TR');
};

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
  const [sheetMode, setSheetMode] = useState('add'); // 'add' | 'edit'
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState('new');
  const [iosPickerDate, setIosPickerDate] = useState(new Date());
  const [androidPickerStep, setAndroidPickerStep] = useState('date');

  const screenH = Dimensions.get('window').height;
  const SHEET_HEIGHT = Math.min(560, Math.max(420, Math.floor(screenH * 0.75)));
  const translateY = useSharedValue(SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const sheetOpacity = useSharedValue(0);
  const sheetScale = useSharedValue(0.96);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: sheetScale.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetOpacityStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
  }));

  const animateOpen = () => {
    const dur = reduceMotion ? 120 : 280;
    const ease = reduceMotion ? Easing.linear : Easing.bezier(0.0, 0.0, 0.2, 1);
    backdropOpacity.value = withTiming(1, { duration: dur, easing: ease });
    sheetOpacity.value = withTiming(1, { duration: dur, easing: ease });
    sheetScale.value = withTiming(1, { duration: dur, easing: ease });
    translateY.value = withTiming(0, { duration: dur, easing: ease });
  };

  const animateClose = (cb) => {
    const dur = reduceMotion ? 100 : 220;
    const ease = reduceMotion ? Easing.linear : Easing.bezier(0.4, 0.0, 1, 1);
    backdropOpacity.value = withTiming(0, { duration: dur, easing: ease });
    sheetOpacity.value = withTiming(0, { duration: dur, easing: ease });
    sheetScale.value = withTiming(0.96, { duration: dur, easing: ease });
    translateY.value = withTiming(SHEET_HEIGHT, { duration: dur, easing: ease }, () => {
      if (cb) runOnJS(cb)();
    });
  };

  useEffect(() => {
    if (showIOSPicker) {
      translateY.value = SHEET_HEIGHT;
      sheetOpacity.value = 0;
      sheetScale.value = 0.96;
      requestAnimationFrame(() => animateOpen());
    }
  }, [SHEET_HEIGHT, showIOSPicker, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gs) => Math.abs(gs.dy) > 6,
      onPanResponderMove: (_evt, gs) => {
        if (gs.dy > 0) translateY.value = gs.dy;
      },
      onPanResponderRelease: (_evt, gs) => {
        const shouldClose = gs.dy > SHEET_HEIGHT * 0.2 || gs.vy > 1.0;
        if (shouldClose) {
          animateClose(() => setShowIOSPicker(false));
        } else {
          animateOpen();
        }
      },
      onPanResponderTerminate: () => animateOpen(),
    })
  ).current;

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

  const nextAt = (hour, minute) => {
    const n = now();
    const d = new Date(n);
    d.setHours(hour, minute, 0, 0);
    if (d <= n) d.setDate(d.getDate() + 1);
    return d;
  };

  const addHours = (h) => {
    const d = now();
    d.setHours(d.getHours() + h);
    d.setSeconds(0, 0);
    return d;
  };

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

  const ITEM_HEIGHT = 34;
  const VISIBLE_COUNT = 5;

  const WheelColumn = ({ data, selectedIndex, onSelect, width, formatItem }) => {
    const listRef = useRef(null);
    const topBottomPad = ((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT;

    useEffect(() => {
      if (listRef.current && typeof selectedIndex === 'number' && selectedIndex >= 0) {
        listRef.current.scrollToOffset({ offset: selectedIndex * ITEM_HEIGHT, animated: false });
      }
    }, [selectedIndex]);

    const onEnd = (e) => {
      const y = e.nativeEvent.contentOffset.y;
      let idx = Math.round(y / ITEM_HEIGHT);
      if (idx < 0) idx = 0;
      if (idx > data.length - 1) idx = data.length - 1;
      if (listRef.current) {
        listRef.current.scrollToOffset({ offset: idx * ITEM_HEIGHT, animated: true });
      }
      if (idx !== selectedIndex) onSelect?.(idx);
    };

    return (
      <View style={[{ height: ITEM_HEIGHT * VISIBLE_COUNT, overflow: 'hidden' }, width ? { width } : { flex: 1 }]}>
        <View style={{ position: 'absolute', top: (ITEM_HEIGHT * VISIBLE_COUNT) / 2 - ITEM_HEIGHT / 2, left: 0, right: 0, height: ITEM_HEIGHT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border, zIndex: 1 }} />
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(item, idx) => String(item) + '-' + idx}
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={onEnd}
          onScrollEndDrag={onEnd}
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
          ListHeaderComponent={<View style={{ height: topBottomPad }} />}
          ListFooterComponent={<View style={{ height: topBottomPad }} />}
          renderItem={({ item, index }) => (
            <View style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: index === selectedIndex ? theme.colors.text : theme.colors.textSecondary, fontWeight: index === selectedIndex ? '700' : '400' }}>
                {formatItem ? formatItem(item, index) : item}
              </Text>
            </View>
          )}
        />
      </View>
    );
  };

  const nextWeekdayAt = (weekday, hour, minute) => {
    const n = now();
    const d = new Date(n);
    const diff = (weekday + 7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const setDatePart = (fn) => {
    setIosPickerDate((prev) => {
      const d = new Date(prev);
      fn(d);
      return d;
    });
  };

  useEffect(() => {
    if (!showIOSPicker) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowIOSPicker(false);
      return true;
    });
    return () => sub.remove();
  }, [showIOSPicker]);

  const persistNotificationMap = useCallback(async (nextMap) => {
    notificationMapRef.current = nextMap;
    setNotificationMap(nextMap);
    await saveReminderNotificationMap(nextMap);
  }, []);

  useEffect(() => {
    try {
      const upcomingCount = reminders.filter((r) => r?.due_at && new Date(r.due_at) > new Date()).length;
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
        await Notifications.cancelScheduledNotificationAsync(existingId);
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
      if (!reminder?.id || !reminder?.due_at) {
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
          await Notifications.cancelScheduledNotificationAsync(existingId);
        } catch (err) {
          console.warn('Existing reminder notification cancel failed', err);
        }
      }

      try {
        // Android için bildirim izinlerini kontrol et
        if (Platform.OS === 'android') {
          const { status } = await Notifications.getPermissionsAsync();
          if (status !== 'granted') {
            const { status: newStatus } = await Notifications.requestPermissionsAsync();
            if (newStatus !== 'granted') {
              showToast('Uyarı', 'Bildirim izni verilmedi', 2000);
              return;
            }
          }
        }

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Hatırlatıcı ⏰',
            body: `${reminder.title ?? 'Hatırlatma'} zamanı geldi.`,
            data: { screen: 'Reminders', reminderId: reminder.id },
            sound: true,
            priority: 'high',
            vibrate: [0, 250, 250, 250],
          },
          trigger: {
            type: 'date',
            date: dueDate,
            channelId: 'default',
          },
        });

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

  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');

  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtDateISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const fmtTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const openDateTimePicker = (target) => {
    const currentValue = target === 'new' ? newDueDate : editingDueDate;
    setPickerTarget(target);
    setIosPickerDate(currentValue);
    setDateText(fmtDateISO(currentValue));
    setTimeText(fmtTime(currentValue));
    if (Platform.OS === 'android') setAndroidPickerStep('date');
    setShowIOSPicker(true);
  };

  // Categorize reminders
  const categorizedReminders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const overdue = [];
    const today = [];
    const upcoming = [];

    reminders.forEach((reminder) => {
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
  }, [reminders]);

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
          backgroundColor: theme.colors.surface,
        },
        scrollContent: {
          padding: 16,
          paddingBottom: 100,
        },
        categorySection: {
          marginBottom: 24,
        },
        categoryHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
        },
        categoryTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors.text,
        },
        categoryBadge: {
          backgroundColor: theme.colors.primary + '20',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 10,
        },
        categoryBadgeText: {
          fontSize: 12,
          fontWeight: '700',
          color: theme.colors.primary,
        },
        reminderCard: {
          backgroundColor: accent && theme.colors.surfaceTinted
            ? theme.colors.surfaceTinted
            : theme.colors.surface,
          borderRadius: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden',
        },
        cardColorStrip: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
        },
        cardContent: {
          padding: 16,
          paddingLeft: 20,
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 8,
        },
        cardTitleRow: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        cardIcon: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: theme.colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
        },
        cardTextContainer: {
          flex: 1,
        },
        cardTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: 4,
        },
        cardTime: {
          fontSize: 13,
          color: theme.colors.textSecondary,
        },
        cardActions: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 8,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        actionButton: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          gap: 6,
        },
        editButton: {
          backgroundColor: theme.colors.primary + '15',
        },
        deleteButton: {
          backgroundColor: theme.colors.danger + '15',
        },
        actionButtonText: {
          fontSize: 14,
          fontWeight: '600',
        },
        editButtonText: {
          color: theme.colors.primary,
        },
        deleteButtonText: {
          color: theme.colors.danger,
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
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          padding: 24,
        },
        modalBackdropFill: {
          ...StyleSheet.absoluteFillObject,
        },
        bottomSheetContainer: {
          backgroundColor: accent && theme.colors.surfaceTinted
            ? theme.colors.surfaceTinted
            : theme.colors.surface,
          borderRadius: 20,
          padding: 16,
          gap: 16,
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
          backgroundColor: accent && theme.colors.surfaceElevatedTinted
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
        iosPickerContainer: {
          backgroundColor: accent && theme.colors.surfaceTinted
            ? theme.colors.surfaceTinted
            : theme.colors.surface,
          borderRadius: 16,
          padding: 12,
          gap: 10,
        },
        iosPicker: { height: 200 },
        iosPickerActions: { flexDirection: 'row', gap: 12 },
        cancelButton: {
          backgroundColor: accent && theme.colors.surfaceElevatedTinted
            ? theme.colors.surfaceElevatedTinted
            : theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        saveButton: { backgroundColor: theme.colors.primary },
        actionButtonTextOnSurface: { color: theme.colors.text, fontWeight: '600' },
      }),
    [theme, accent, insets]
  );

  const renderReminderCard = (reminder) => {
    const dueDate = reminder.due_at ? new Date(reminder.due_at) : null;
    const isOverdue = dueDate ? dueDate < new Date() : false;
    const relativeTime = getRelativeTime(reminder.due_at);

    const colorStrip = isOverdue
      ? theme.colors.danger
      : dueDate && (dueDate - new Date()) < 3600000 // < 1 hour
        ? theme.colors.warning
        : theme.colors.primary;

    return (
      <Animated.View
        key={reminder.id}
        entering={FadeInDown.duration(300)}
        exiting={FadeOutUp.duration(200)}
        layout={Layout.springify()}
        style={styles.reminderCard}
      >
        <View style={[styles.cardColorStrip, { backgroundColor: colorStrip }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardIcon}>
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle}>{reminder.title}</Text>
                <Text style={[styles.cardTime, isOverdue && { color: theme.colors.danger }]}>
                  {relativeTime}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => handleStartEditing(reminder)}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={16} color={theme.colors.primary} />
              <Text style={[styles.actionButtonText, styles.editButtonText]}>Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteReminder(reminder.id)}
              activeOpacity={0.7}
              disabled={deletingId === reminder.id}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                {deletingId === reminder.id ? 'Siliniyor...' : 'Sil'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderCategory = (title, items, icon, iconColor) => {
    if (items.length === 0) return null;

    return (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
          <Text style={styles.categoryTitle}>{title}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{items.length}</Text>
          </View>
        </View>
        {items.map((reminder) => renderReminderCard(reminder))}
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      {/* Custom Header */}
      <View style={styles.customHeader}>
        <View style={styles.keeperTitle}>
          <View style={styles.keeperIcon}>
            <MaterialCommunityIcons name="shield-lock" size={22} color={theme.colors.primary} />
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

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.emptyText, { marginTop: 16 }]}>Hatırlatmalar yükleniyor...</Text>
        </View>
      ) : reminders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="bell-off-outline"
            size={64}
            color={theme.colors.muted}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>Henüz hatırlatma yok</Text>
          <Text style={styles.emptyText}>
            Sağ alttaki + butonuna tıklayarak{'\n'}ilk hatırlatmanı ekle
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderCategory('Geçmiş', categorizedReminders.overdue, 'clock-alert-outline', theme.colors.danger)}
          {renderCategory('Bugün', categorizedReminders.today, 'calendar-today', theme.colors.warning)}
          {renderCategory('Yaklaşan', categorizedReminders.upcoming, 'calendar-clock', theme.colors.primary)}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          resetForm();
          setSheetMode('add');
          setShowBottomSheet(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={theme.dark ? theme.colors.background : '#ffffff'} />
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
          <View style={styles.modalRoot}>
            <Animated.View style={[styles.modalBackdropFill, backdropStyle]}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => {
                  setShowBottomSheet(false);
                  resetEditing();
                }}
              />
            </Animated.View>
            <Animated.View
              style={[styles.bottomSheetContainer, { maxHeight: SHEET_HEIGHT }]}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
            >
              <View style={styles.bottomSheetHandle}>
                <View style={styles.handle} />
              </View>

              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {sheetMode === 'add' ? 'Yeni Hatırlatma' : 'Hatırlatmayı Düzenle'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowBottomSheet(false);
                    resetEditing();
                  }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={sheetMode === 'add' ? newTitle : editingTitle}
                onChangeText={sheetMode === 'add' ? setNewTitle : setEditingTitle}
                placeholder="Hatırlatma başlığı"
                placeholderTextColor={theme.colors.muted}
              />

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => openDateTimePicker(sheetMode === 'add' ? 'new' : 'edit')}
                onPressIn={() => hapticsEnabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.dark ? theme.colors.background : '#ffffff'} />
                <Text style={styles.dateButtonText}>Tarih & Saat Seç</Text>
              </TouchableOpacity>

              <Text style={styles.datePreview}>
                {formatDateTime(sheetMode === 'add' ? newDueDate : editingDueDate)}
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={sheetMode === 'add' ? handleAddReminder : handleUpdateReminder}
                onPressIn={() => hapticsEnabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                disabled={sheetMode === 'add' ? saving : updating}
              >
                <Text style={styles.primaryButtonText}>
                  {sheetMode === 'add'
                    ? (saving ? 'Kaydediliyor...' : 'Kaydet')
                    : (updating ? 'Güncelleniyor...' : 'Güncelle')
                  }
                </Text>
              </TouchableOpacity>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Date/Time Picker Modal */}
      {showIOSPicker && (
        <Modal
          transparent
          statusBarTranslucent
          animationType="none"
          visible={showIOSPicker}
          onRequestClose={() => setShowIOSPicker(false)}
        >
          <View style={styles.modalRoot}>
            <Animated.View style={[styles.modalBackdropFill, backdropStyle]}>
              <Pressable style={{ flex: 1 }} onPress={() => { animateClose(() => setShowIOSPicker(false)); }} />
            </Animated.View>
            <Animated.View style={[styles.iosPickerContainer, { maxHeight: SHEET_HEIGHT }, sheetStyle, sheetOpacityStyle]} {...panResponder.panHandlers}>
              <View style={{ alignItems: 'center', paddingTop: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 6 }} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.sheetTitle, { fontSize: 18 }]}>Tarih & Saat</Text>
                <TouchableOpacity onPress={() => animateClose(() => setShowIOSPicker(false))} style={{ padding: 8 }}>
                  <Text style={{ color: theme.colors.text }}>Kapat</Text>
                </TouchableOpacity>
              </View>

              {(() => {
                const y = iosPickerDate.getFullYear();
                const m = iosPickerDate.getMonth() + 1;
                const d = iosPickerDate.getDate();
                const hh = iosPickerDate.getHours();
                const mm = iosPickerDate.getMinutes();

                const years = Array.from({ length: 11 }, (_, i) => y - 5 + i);
                const months = Array.from({ length: 12 }, (_, i) => i + 1);
                const dim = daysInMonth(y, m);
                const days = Array.from({ length: dim }, (_, i) => i + 1);
                const hours = Array.from({ length: 24 }, (_, i) => i);
                const minutes = Array.from({ length: 60 }, (_, i) => i);

                const onYear = (idx) => {
                  const year = years[idx];
                  setIosPickerDate((prev) => setYMD(prev, year, m, d));
                };
                const onMonth = (idx) => {
                  const month = months[idx];
                  setIosPickerDate((prev) => setYMD(prev, y, month, d));
                };
                const onDay = (idx) => {
                  const day = days[idx];
                  setIosPickerDate((prev) => setYMD(prev, y, m, day));
                };
                const onHour = (idx) => {
                  const hour = hours[idx];
                  setIosPickerDate((prev) => {
                    const nd = new Date(prev);
                    nd.setHours(hour);
                    return nd;
                  });
                };
                const onMinute = (idx) => {
                  const minute = minutes[idx];
                  setIosPickerDate((prev) => {
                    const nd = new Date(prev);
                    nd.setMinutes(minute);
                    return nd;
                  });
                };

                return (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: theme.colors.textSecondary }}>
                      {androidPickerStep === 'date' ? 'Tarih seç' : 'Saat seç'}: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{iosPickerDate.toLocaleString()}</Text>
                    </Text>
                    {androidPickerStep === 'date' ? (
                      <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => { const d = new Date(); d.setHours(iosPickerDate.getHours(), iosPickerDate.getMinutes(), 0, 0); setIosPickerDate(clampFuture(d)); }}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
                          >
                            <Text style={{ color: theme.colors.text }}>Bugün</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(iosPickerDate.getHours(), iosPickerDate.getMinutes(), 0, 0); setIosPickerDate(clampFuture(d)); }}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
                          >
                            <Text style={{ color: theme.colors.text }}>Yarın</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => { const d = new Date(); d.setDate(d.getDate()+3); d.setHours(iosPickerDate.getHours(), iosPickerDate.getMinutes(), 0, 0); setIosPickerDate(clampFuture(d)); }}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
                          >
                            <Text style={{ color: theme.colors.text }}>3 gün sonra</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => { const d = new Date(); d.setDate(d.getDate()+7); d.setHours(iosPickerDate.getHours(), iosPickerDate.getMinutes(), 0, 0); setIosPickerDate(clampFuture(d)); }}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
                          >
                            <Text style={{ color: theme.colors.text }}>1 hafta sonra</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <WheelColumn data={days} selectedIndex={Math.max(0, d - 1)} onSelect={onDay} />
                          <WheelColumn data={months} selectedIndex={Math.max(0, m - 1)} onSelect={onMonth} />
                          <WheelColumn data={years} selectedIndex={Math.max(0, years.indexOf(y))} onSelect={onYear} />
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <WheelColumn data={hours} selectedIndex={Math.max(0, hours.indexOf(hh))} onSelect={onHour} formatItem={(v) => pad2(v)} />
                        <WheelColumn data={minutes} selectedIndex={Math.max(0, minutes.indexOf(mm))} onSelect={onMinute} formatItem={(v) => pad2(v)} />
                      </View>
                    )}
                  </View>
                );
              })()}

              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.textSecondary }}>Seçilen</Text>
                  <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{iosPickerDate.toLocaleString()}</Text>
                </View>
              </View>

              {androidPickerStep !== 'time' ? null : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      hapticsEnabled && Haptics.selectionAsync();
                      const nd = addHours(1);
                      setIosPickerDate(nd);
                      if (Platform.OS === 'android') { setDateText(fmtDateISO(nd)); setTimeText(fmtTime(nd)); }
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated }}
                  >
                    <Text style={{ color: theme.colors.text }}>1 saat sonra</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      hapticsEnabled && Haptics.selectionAsync();
                      const nd = addHours(3);
                      setIosPickerDate(nd);
                      if (Platform.OS === 'android') { setDateText(fmtDateISO(nd)); setTimeText(fmtTime(nd)); }
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated }}
                  >
                    <Text style={{ color: theme.colors.text }}>3 saat sonra</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      hapticsEnabled && Haptics.selectionAsync();
                      const nd = nextAt(21, 0);
                      setIosPickerDate(nd);
                      if (Platform.OS === 'android') { setDateText(fmtDateISO(nd)); setTimeText(fmtTime(nd)); }
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated }}
                  >
                    <Text style={{ color: theme.colors.text }}>Bu akşam 21:00</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      hapticsEnabled && Haptics.selectionAsync();
                      const d = now(); d.setDate(d.getDate()+1); d.setHours(9,0,0,0);
                      setIosPickerDate(d);
                      if (Platform.OS === 'android') { setDateText(fmtDateISO(d)); setTimeText(fmtTime(d)); }
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated }}
                  >
                    <Text style={{ color: theme.colors.text }}>Yarın 09:00</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      hapticsEnabled && Haptics.selectionAsync();
                      const nd = nextWeekdayAt(6, 10, 0);
                      setIosPickerDate(nd);
                      if (Platform.OS === 'android') { setDateText(fmtDateISO(nd)); setTimeText(fmtTime(nd)); }
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated }}
                  >
                    <Text style={{ color: theme.colors.text }}>Hafta sonu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      hapticsEnabled && Haptics.selectionAsync();
                      const nd = nextWeekdayAt(1, 9, 0);
                      setIosPickerDate(nd);
                      if (Platform.OS === 'android') { setDateText(fmtDateISO(nd)); setTimeText(fmtTime(nd)); }
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceElevated }}
                  >
                    <Text style={{ color: theme.colors.text }}>Pazartesi 09:00</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.iosPickerActions, { paddingBottom: 8 }]}>
                <TouchableOpacity
                  onPress={() => setShowIOSPicker(false)}
                  style={[styles.actionButton, styles.cancelButton, { flex: 1 }]}
                >
                  <Text style={styles.actionButtonTextOnSurface}>İptal</Text>
                </TouchableOpacity>
                {androidPickerStep === 'date' ? (
                  <TouchableOpacity
                    onPress={() => setAndroidPickerStep('time')}
                    style={[styles.actionButton, styles.saveButton, { flex: 1 }]}
                  >
                    <Text style={[styles.actionButtonText, { color: theme.dark ? theme.colors.background : '#ffffff' }]}>Tarihi Onayla</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      const finalDate = clampFuture(iosPickerDate);
                      if (pickerTarget === 'new') {
                        setNewDueDate(finalDate);
                      } else {
                        setEditingDueDate(finalDate);
                      }
                      showToast('Tarih ayarlandı', finalDate.toLocaleString(), 1800);
                      animateClose(() => setShowIOSPicker(false));
                    }}
                    style={[styles.actionButton, styles.saveButton, { flex: 1 }]}
                  >
                    <Text style={[styles.actionButtonText, { color: theme.dark ? theme.colors.background : '#ffffff' }]}>Saati Onayla</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </Animated.View>
  );
};

export default RemindersScreen;
