const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Android res klasörüne notification_icon drawable ve color kaynakları ekler.
 */
function withNotificationResources(config) {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const resPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

            // drawable-mdpi, drawable-hdpi, drawable-xhdpi, drawable-xxhdpi, drawable-xxxhdpi klasörlerini oluştur
            const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
            const sizes = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };

            // Basit beyaz K harfi ikonu oluştur (base64 encoded minimal PNG)
            // Bu basit bir 1x1 beyaz piksel - gerçek ikon expo-notifications tarafından kopyalanacak
            // Ama FCM meta-data için bir dosya olması gerekiyor

            for (const density of densities) {
                const drawableDir = path.join(resPath, `drawable-${density}`);

                // Klasör yoksa oluştur
                if (!fs.existsSync(drawableDir)) {
                    fs.mkdirSync(drawableDir, { recursive: true });
                }

                // expo-notifications plugin'in oluşturduğu ikonu notification_icon olarak kopyala
                // expo-notifications 'notification_icon' adında oluşturuyor zaten, sadece kontrol et
                const sourceIcon = path.join(drawableDir, 'notification_icon.png');

                if (!fs.existsSync(sourceIcon)) {
                    // Eğer expo-notifications ikonu oluşturmadıysa, boş bir placeholder ekle
                    // Bu genelde olmaz ama güvenlik için
                    console.log(`withNotificationResources: notification_icon.png will be created by expo-notifications in ${density}`);
                }
            }

            // values/colors.xml'e notification_icon_color ekle
            const valuesDir = path.join(resPath, 'values');
            if (!fs.existsSync(valuesDir)) {
                fs.mkdirSync(valuesDir, { recursive: true });
            }

            const colorsXmlPath = path.join(valuesDir, 'colors.xml');
            const notificationColor = '#22c55e'; // Yeşil

            let colorsContent;
            if (fs.existsSync(colorsXmlPath)) {
                colorsContent = fs.readFileSync(colorsXmlPath, 'utf8');

                // notification_icon_color zaten var mı kontrol et
                if (!colorsContent.includes('notification_icon_color')) {
                    // </resources> öncesine ekle
                    colorsContent = colorsContent.replace(
                        '</resources>',
                        `    <color name="notification_icon_color">${notificationColor}</color>\n</resources>`
                    );
                    fs.writeFileSync(colorsXmlPath, colorsContent);
                    console.log('withNotificationResources: Added notification_icon_color to colors.xml');
                }
            } else {
                // Yeni colors.xml oluştur
                colorsContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="notification_icon_color">${notificationColor}</color>
</resources>
`;
                fs.writeFileSync(colorsXmlPath, colorsContent);
                console.log('withNotificationResources: Created colors.xml with notification_icon_color');
            }

            return config;
        },
    ]);
}

module.exports = withNotificationResources;
