const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

/** Remove Flipper from release builds — avoids FLIPPER_VERSION Gradle failures on EAS Linux. */
function withRemoveFlipper(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === 'groovy') {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /\s*implementation\("com\.facebook\.react:flipper-integration"\)\s*\n/g,
        '\n'
      );
    }
    return modConfig;
  });
}

/** Give Gradle more heap for Skia/PDF native compilation on EAS workers. */
function withGradleJvmArgs(config) {
  return withGradleProperties(config, (modConfig) => {
    const props = modConfig.modResults;
    const jvmArgs = '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError';
    const existing = props.find((entry) => entry.type === 'property' && entry.key === 'org.gradle.jvmargs');
    if (existing) {
      existing.value = jvmArgs;
    } else {
      props.push({ type: 'property', key: 'org.gradle.jvmargs', value: jvmArgs });
    }
    return modConfig;
  });
}

module.exports = function withAndroidReleaseFixes(config) {
  config = withRemoveFlipper(config);
  config = withGradleJvmArgs(config);
  return config;
};
