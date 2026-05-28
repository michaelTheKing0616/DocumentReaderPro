const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('db', 'mp3', 'ttf', 'otf', 'woff', 'woff2', 'bin', 'mjs');
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== 'mjs');

const webShims = {
  'react-native-zeromq': 'react-native-zeromq.web.ts',
  'react-native-zeroconf': 'react-native-zeroconf.web.ts',
  'react-native-pdf': 'react-native-pdf.web.tsx',
  'react-native-share': 'react-native-share.web.ts',
  '@tensorflow/tfjs-react-native': 'tfjs-react-native.shim.ts',
  'pdfjs-dist/legacy/build/pdf': 'pdfjs-dist.web.ts',
  'pdfjs-dist/legacy/build/pdf.mjs': 'pdfjs-dist.web.ts',
  'pdfjs-dist/legacy/build/pdf.min.mjs': 'pdfjs-dist.web.ts',
};

const nativeShims = {
  '@tensorflow/tfjs-react-native': 'tfjs-react-native.shim.ts',
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shimFile = webShims[moduleName];
  if (shimFile && platform === 'web') {
    return {
      filePath: path.resolve(__dirname, 'src/shims', shimFile),
      type: 'sourceFile',
    };
  }

  const nativeShim = nativeShims[moduleName];
  if (nativeShim && platform !== 'web') {
    return {
      filePath: path.resolve(__dirname, 'src/shims', nativeShim),
      type: 'sourceFile',
    };
  }

  if (moduleName === '@tensorflow/tfjs-react-native') {
    return {
      filePath: path.resolve(__dirname, 'src/shims', 'tfjs-react-native.shim.ts'),
      type: 'sourceFile',
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;
