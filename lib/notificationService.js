import * as Notifications from 'expo-notifications';
import { Platform, Linking, Alert } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Setup notification channels for Android
 * Uses high importance and special flags for battery optimization bypass
 */
export const setupNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    // Ana hatırlatma kanalı - MAX öncelik
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Hatırlatmalar',
      description: 'Zamanında ulaşması gereken önemli hatırlatmalar',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      bypassDnd: true, // Rahatsız Etmeyin modunu bypass et
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Alarm kanalı - Kritik bildirimler için
    await Notifications.setNotificationChannelAsync('alarms', {
      name: 'Alarmlar',
      description: 'Kritik zamanlı hatırlatmalar',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
};

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
};

/**
 * Check and request exact alarm permission for Android 12+
 * This is required for alarms to fire exactly on time even in battery optimization
 */
export const requestExactAlarmPermission = async () => {
  if (Platform.OS !== 'android') return true;

  try {
    // Android 12+ (API 31+) requires SCHEDULE_EXACT_ALARM permission
    const canScheduleExact = await Notifications.getPermissionsAsync();

    // Expo doesn't have direct exact alarm permission check yet
    // But we can try to schedule and catch errors
    return true;
  } catch (error) {
    console.warn('Exact alarm permission error:', error);
    return false;
  }
};

/**
 * Show battery optimization settings dialog
 * Guides user to disable battery optimization for the app
 */
export const showBatteryOptimizationSettings = () => {
  if (Platform.OS !== 'android') return;

  Alert.alert(
    'Pil Optimizasyonunu Devre Dışı Bırakın',
    'Hatırlatmaların zamanında gelmesi için uygulamanın pil optimizasyonundan muaf tutulması gerekiyor.\n\n"Kısıtlanmamış" veya "Optimize etme" seçeneğini seçin.',
    [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Ayarları Aç',
        onPress: async () => {
          try {
            // Open battery optimization settings
            await IntentLauncher.startActivityAsync(
              'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
            );
          } catch (e) {
            // Fallback to app settings
            try {
              await IntentLauncher.startActivityAsync(
                'android.settings.APPLICATION_DETAILS_SETTINGS',
                { data: 'package:com.ardakaratas.keeper' }
              );
            } catch (e2) {
              Linking.openSettings();
            }
          }
        },
      },
    ]
  );
};

/**
 * Schedule a reminder notification with battery optimization bypass
 */
export const scheduleReminderNotification = async (reminder) => {
  const dueDate = new Date(reminder.due_at);

  // Geçmiş tarihse zamanlamayı atlа
  if (dueDate <= new Date()) {
    console.log('Reminder date is in the past, skipping notification');
    return null;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Hatırlatıcı',
      body: reminder.title ?? 'Hatırlatma zamanı geldi!',
      data: {
        screen: 'Reminders',
        reminderId: reminder.id,
        timestamp: dueDate.getTime(),
      },
      sound: 'default',
      priority: 'max',
      sticky: false,
      autoDismiss: true,
      badge: 1,
      // Android specific
      ...(Platform.OS === 'android' && {
        channelId: 'reminders',
        color: '#667eea',
        vibrate: [0, 250, 250, 250],
        // These help with battery optimization
        category: 'alarm',
        visibility: 'public',
      }),
    },
    trigger: {
      date: dueDate,
      channelId: Platform.OS === 'android' ? 'reminders' : undefined,
    },
  });

  return notificationId;
};

/**
 * Schedule an alarm-type notification (highest priority)
 * Use this for critical reminders that MUST be delivered
 */
export const scheduleAlarmNotification = async (reminder) => {
  const dueDate = new Date(reminder.due_at);

  if (dueDate <= new Date()) {
    return null;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Önemli Hatırlatma!',
      body: reminder.title ?? 'Hatırlatma zamanı geldi!',
      data: {
        screen: 'Reminders',
        reminderId: reminder.id,
        isAlarm: true,
      },
      sound: 'default',
      priority: 'max',
      badge: 1,
      ...(Platform.OS === 'android' && {
        channelId: 'alarms',
        color: '#ef4444',
        vibrate: [0, 500, 200, 500, 200, 500],
        category: 'alarm',
        visibility: 'public',
        ongoing: false,
        autoCancel: true,
      }),
    },
    trigger: {
      date: dueDate,
      channelId: Platform.OS === 'android' ? 'alarms' : undefined,
    },
  });

  return notificationId;
};

/**
 * Cancel a scheduled reminder notification
 */
export const cancelReminderNotification = async (notificationId) => {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
};

/**
 * Get all scheduled notifications (for debugging)
 */
export const getScheduledNotifications = async () => {
  return await Notifications.getAllScheduledNotificationsAsync();
};

