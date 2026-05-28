/** Exclude optional/unused native modules from Android autolinking to reduce Gradle failures on EAS. */
module.exports = {
  dependencies: {
    // Not referenced in src; duplicates blob-util file APIs on Android.
    'react-native-fs': {
      platforms: { android: null, ios: null },
    },
    // Pupil Labs hardware only — dynamically imported; no Android implementation needed for APK.
    'react-native-zeroconf': {
      platforms: { android: null, ios: null },
    },
  },
};
