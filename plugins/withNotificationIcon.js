const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Firebase Cloud Messaging için varsayılan bildirim ikonunu ayarlar.
 * AndroidManifest.xml'e gerekli meta-data ekler.
 */
function withNotificationIcon(config) {
    return withAndroidManifest(config, async (config) => {
        const mainApplication = config.modResults.manifest.application?.[0];

        if (!mainApplication) {
            console.warn('withNotificationIcon: application element not found');
            return config;
        }

        // Meta-data array'ini oluştur veya mevcut olanı kullan
        if (!mainApplication['meta-data']) {
            mainApplication['meta-data'] = [];
        }

        // Firebase varsayılan bildirim ikonu
        const notificationIconMeta = {
            $: {
                'android:name': 'com.google.firebase.messaging.default_notification_icon',
                'android:resource': '@drawable/notification_icon',
            },
        };

        // Firebase varsayılan bildirim rengi
        const notificationColorMeta = {
            $: {
                'android:name': 'com.google.firebase.messaging.default_notification_color',
                'android:resource': '@color/notification_icon_color',
            },
        };

        // Mevcut meta-data'ları kontrol et ve güncelle/ekle
        const existingIconIndex = mainApplication['meta-data'].findIndex(
            (meta) => meta.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_icon'
        );

        if (existingIconIndex >= 0) {
            mainApplication['meta-data'][existingIconIndex] = notificationIconMeta;
        } else {
            mainApplication['meta-data'].push(notificationIconMeta);
        }

        const existingColorIndex = mainApplication['meta-data'].findIndex(
            (meta) => meta.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_color'
        );

        if (existingColorIndex >= 0) {
            mainApplication['meta-data'][existingColorIndex] = notificationColorMeta;
        } else {
            mainApplication['meta-data'].push(notificationColorMeta);
        }

        console.log('withNotificationIcon: Added FCM notification icon meta-data');
        return config;
    });
}

module.exports = withNotificationIcon;
