import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Setup notification channels for Android
 */
export const setupNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Hatırlatmalar',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: true,
      enableVibrate: true,
      showBadge: true,
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
 * Schedule a reminder notification
 */
export const scheduleReminderNotification = async (reminder) => {
  const dueDate = new Date(reminder.due_at);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Hatırlatıcı ⏰',
      body: `${reminder.title ?? 'Hatırlatma'} zamanı geldi.`,
      data: { screen: 'Reminders', reminderId: reminder.id },
      sound: true,
      priority: Platform.OS === 'android' ? Notifications.AndroidNotificationPriority.MAX : 'high',
      vibrate: [0, 250, 250, 250],
      categoryIdentifier: 'reminder',
      badge: 1,
    },
    trigger: {
      type: 'date',
      date: dueDate,
      channelId: Platform.OS === 'android' ? 'reminders' : undefined,
    },
  });

  return notificationId;
};

/**
 * Cancel a scheduled reminder notification
 */
export const cancelReminderNotification = async (notificationId) => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};
