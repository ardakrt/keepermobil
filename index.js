import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';

import App from './App';

// Register Firebase Messaging background handler at the entry file level (required on Android).
// This ensures messages are handled when the app is in the background or quit state.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
	// Process high-priority data messages for reminders
	if (remoteMessage.data?.type === 'reminder') {
		// Force notification even in battery optimization
		const { title, body, reminderId } = remoteMessage.data;

		// Native Android notification will be shown automatically
		// if message includes notification payload with high priority
		console.log('Background reminder received:', reminderId);
	}
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
