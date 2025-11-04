import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';

import App from './App';

// Register Firebase Messaging background handler at the entry file level (required on Android).
// This ensures messages are handled when the app is in the background or quit state.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
	// Keep lightweight work here; heavy work should be deferred to in-app logic when opened
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
