const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withGradleProperties, withDangerousMod } = require('expo/config-plugins');

function findMainApplicationFile(androidDir) {
  const javaRoot = path.join(androidDir, 'app', 'src', 'main', 'java');
  if (!fs.existsSync(javaRoot)) {
    return null;
  }

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = walk(fullPath);
        if (found) {
          return found;
        }
      } else if (entry.name === 'MainApplication.kt' || entry.name === 'MainApplication.java') {
        return fullPath;
      }
    }
    return null;
  }

  return walk(javaRoot);
}

function stripFlipperFromMainApplication(contents) {
  return contents
    .replace(/\nimport com\.facebook\.react\.flipper\.ReactNativeFlipper/g, '')
    .replace(
      /\n\s*if \(BuildConfig\.DEBUG\) \{\s*\n\s*ReactNativeFlipper\.initializeFlipper\(this, reactNativeHost\.reactInstanceManager\)\s*\n\s*\}\s*\n/g,
      '\n'
    );
}

/** Remove Flipper Gradle dependency — avoids FLIPPER_VERSION failures on EAS Linux. */
function withRemoveFlipperDependency(config) {
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

/** Remove Flipper imports/calls from MainApplication — required after dependency removal. */
function withRemoveFlipperMainApplication(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const mainApplicationPath = findMainApplicationFile(modConfig.modRequest.platformProjectRoot);
      if (!mainApplicationPath) {
        return modConfig;
      }

      const original = fs.readFileSync(mainApplicationPath, 'utf8');
      const updated = stripFlipperFromMainApplication(original);
      if (updated !== original) {
        fs.writeFileSync(mainApplicationPath, updated);
      }

      return modConfig;
    },
  ]);
}

/** Give Gradle more heap for native compilation on EAS workers. */
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
  config = withRemoveFlipperDependency(config);
  config = withRemoveFlipperMainApplication(config);
  config = withGradleJvmArgs(config);
  return config;
};
