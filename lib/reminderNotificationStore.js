import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'kis_not_kasasi_reminder_notifications';

export const loadReminderNotificationMap = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Reminder notification map could not be loaded', err);
    return {};
  }
};

export const saveReminderNotificationMap = async (map) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Reminder notification map could not be persisted', err);
  }
};

export const deleteReminderNotificationEntry = async (reminderId) => {
  const map = await loadReminderNotificationMap();
  if (!map[reminderId]) {
    return;
  }
  delete map[reminderId];
  await saveReminderNotificationMap(map);
};

