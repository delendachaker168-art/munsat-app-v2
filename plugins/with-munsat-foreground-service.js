const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  'android.permission.WAKE_LOCK'
];

module.exports = function withMunsatForegroundService(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];

    for (const permission of PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (item) => item.$?.['android:name'] === permission
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } });
      }
    }

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.service = application.service || [];
    const serviceName = 'expo.modules.munsatforegroundservice.MunsatMicForegroundService';
    const exists = application.service.some(
      (service) => service.$?.['android:name'] === serviceName
    );

    if (!exists) {
      application.service.push({
        $: {
          'android:name': serviceName,
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone'
        }
      });
    }

    return config;
  });
};
