const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    
    // Find the application element
    const application = manifest.manifest.application[0];
    
    // Ensure meta-data array exists
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }
    
    // Remove existing notification color meta-data if exists
    application['meta-data'] = application['meta-data'].filter(
      (metaData) => metaData.$['android:name'] !== 'com.google.firebase.messaging.default_notification_color'
    );
    
    // Add our notification color meta-data with tools:replace
    application['meta-data'].push({
      $: {
        'android:name': 'com.google.firebase.messaging.default_notification_color',
        'android:resource': '@color/white',
        'tools:replace': 'android:resource'
      }
    });
    
    // Ensure tools namespace is declared
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    
    return config;
  });
};
