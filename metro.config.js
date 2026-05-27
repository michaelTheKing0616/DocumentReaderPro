const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('db', 'mp3', 'ttf', 'otf', 'woff', 'woff2', 'bin');

const webShims = {
  'react-native-zeromq': 'react-native-zeromq.web.ts',
  'react-native-zeroconf': 'react-native-zeroconf.web.ts',
  'react-native-pdf': 'react-native-pdf.web.tsx',
  'react-native-share': 'react-native-share.web.ts',
  '@tensorflow/tfjs-react-native': 'tfjs-react-native.web.ts',
  'pdfjs-dist/legacy/build/pdf.mjs': 'pdfjs-dist.web.ts',
  'pdfjs-dist/legacy/build/pdf.js': 'pdfjs-dist.web.ts',
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webShims[moduleName]) {
    return {
      filePath: path.resolve(__dirname, 'src/shims', webShims[moduleName]),
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
