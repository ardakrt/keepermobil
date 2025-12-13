const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to ensure google-services.json is copied to android/app
 * This is a workaround for EAS Build issues
 */
module.exports = function withGoogleServicesJson(config) {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const srcPath = path.join(projectRoot, 'google-services.json');
            const destPath = path.join(projectRoot, 'android', 'app', 'google-services.json');

            console.log('[withGoogleServicesJson] Checking google-services.json...');
            console.log('[withGoogleServicesJson] Source:', srcPath);
            console.log('[withGoogleServicesJson] Destination:', destPath);

            if (fs.existsSync(srcPath)) {
                const content = fs.readFileSync(srcPath, 'utf8');
                console.log('[withGoogleServicesJson] Source file exists, size:', content.length, 'bytes');

                // Parse to verify it's valid JSON
                try {
                    const json = JSON.parse(content);
                    const packageNames = json.client?.map(c => c.client_info?.android_client_info?.package_name) || [];
                    console.log('[withGoogleServicesJson] Package names in file:', packageNames);
                } catch (e) {
                    console.error('[withGoogleServicesJson] Invalid JSON:', e.message);
                }

                // Ensure destination directory exists
                const destDir = path.dirname(destPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }

                // Copy the file
                fs.copyFileSync(srcPath, destPath);
                console.log('[withGoogleServicesJson] File copied successfully!');

                // Verify the copy
                if (fs.existsSync(destPath)) {
                    const destContent = fs.readFileSync(destPath, 'utf8');
                    console.log('[withGoogleServicesJson] Destination file size:', destContent.length, 'bytes');
                }
            } else {
                console.error('[withGoogleServicesJson] Source file NOT FOUND:', srcPath);

                // Check if GOOGLE_SERVICES_JSON env var is set (EAS Secret)
                if (process.env.GOOGLE_SERVICES_JSON) {
                    console.log('[withGoogleServicesJson] Using GOOGLE_SERVICES_JSON env var');
                    const envPath = process.env.GOOGLE_SERVICES_JSON;
                    if (fs.existsSync(envPath)) {
                        fs.copyFileSync(envPath, destPath);
                        console.log('[withGoogleServicesJson] Copied from env var path');
                    }
                }
            }

            return config;
        },
    ]);
};
