import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

// Configure high-priority notification channel for Android
export const setupNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    // Main reminder channel with maximum priority
    await Notifications.setNotificationChannelAsync('reminders-high', {
      name: 'Önemli Hatırlatıcılar',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      description: 'Yüksek öncelikli hatırlatıcı bildirimleri',
    });

    // Fallback channel
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Hatırlatıcılar',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });
  }
};

// Schedule notification with maximum priority settings
export const scheduleReminderNotification = async (reminder) => {
  try {
    const dueDate = new Date(reminder.due_at);
    if (dueDate.getTime() <= Date.now()) {
      return null;
    }

    const notificationRequest = {
      content: {
        title: 'Hatırlatıcı ⏰',
        body: `${reminder.title ?? 'Hatırlatma'} zamanı geldi.`,
        data: { 
          screen: 'Reminders', 
          reminderId: reminder.id,
          type: 'reminder'
        },
        sound: true,
        priority: Platform.OS === 'android' 
          ? Notifications.AndroidNotificationPriority.MAX 
          : 'high',
        vibrate: [0, 250, 250, 250],
        categoryIdentifier: 'reminder',
        badge: 1,
        sticky: false,
        autoDismiss: false,
      },
      trigger: {
        type: 'date',
        date: dueDate,
        channelId: Platform.OS === 'android' ? 'reminders-high' : undefined,
      },
    };

    // For Android 12+ (API 31+), use exact alarms
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      notificationRequest.trigger.repeats = false;
      notificationRequest.trigger.exactTime = true;
    }

    const notificationId = await Notifications.scheduleNotificationAsync(notificationRequest);
    
    // Also prepare for Firebase push as backup
    if (Platform.OS === 'android') {
      // This will be triggered by a server-side cron job or cloud function
      await scheduleFirebasePush(reminder);
    }

    return notificationId;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    throw error;
  }
};

// Prepare Firebase push notification (to be triggered server-side)
const scheduleFirebasePush = async (reminder) => {
  try {
    // In production, this would call your backend API to schedule
    // a Firebase push notification at the reminder time
    
    // For now, we'll just ensure Firebase is ready
    const authStatus = await messaging().hasPermission();
    if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED) {
      await messaging().requestPermission();
    }

    // Get current FCM token
    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      // Store this token in your backend for the scheduled push
      console.log('FCM token ready for reminder:', reminder.id);
    }
  } catch (error) {
    console.error('Firebase push preparation failed:', error);
  }
};

// Cancel all notifications for a reminder
export const cancelReminderNotification = async (notificationId) => {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
};

// Request notification permissions with fallback
export const requestNotificationPermissions = async () => {
  try {
    // Request Expo notifications permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return false;
    }

    // Also request Firebase permissions for Android
    if (Platform.OS === 'android') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      if (!enabled) {
        console.warn('Firebase notification permission not granted');
      }
    }

    return true;
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
};

// Check if app can schedule exact alarms (Android 12+)
export const checkExactAlarmPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 31) {
    try {
      // In production, you would check AlarmManager.canScheduleExactAlarms()
      // via a native module
      return true; // Assume granted for now
    } catch (error) {
      console.error('Exact alarm check failed:', error);
      return false;
    }
  }
  return true;
};
