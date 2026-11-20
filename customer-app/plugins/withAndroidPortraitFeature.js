const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to ensure android.hardware.screen.portrait is marked as required="false".
 * This prevents Google Play Console from filtering out tablets, Chromebooks, and foldable devices.
 */
module.exports = function withAndroidPortraitFeature(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    if (!androidManifest['uses-feature']) {
      androidManifest['uses-feature'] = [];
    }

    const existing = androidManifest['uses-feature'].find(
      (f) => f.$ && f.$['android:name'] === 'android.hardware.screen.portrait'
    );

    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      androidManifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.screen.portrait',
          'android:required': 'false',
        },
      });
    }

    return config;
  });
};
