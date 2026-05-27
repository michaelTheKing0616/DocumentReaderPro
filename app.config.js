/** @type {import('@expo/config').ExpoConfig} */
const appJson = require('./app.json');

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  name: appJson.expo.name,
  slug: appJson.expo.slug,
  version: appJson.expo.version,
  orientation: appJson.expo.orientation,
  icon: appJson.expo.icon,
  userInterfaceStyle: appJson.expo.userInterfaceStyle,
  splash: appJson.expo.splash,
  assetBundlePatterns: appJson.expo.assetBundlePatterns,
  ios: appJson.expo.ios,
  android: appJson.expo.android,
  web: appJson.expo.web,
  plugins: appJson.expo.plugins,
  owner:
    process.env.EAS_PROJECT_OWNER ??
    appJson.expo.owner,
  extra: {
    ...(appJson.expo.extra ?? {}),
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID ??
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
        appJson.expo.extra?.eas?.projectId,
    },
  },
});
