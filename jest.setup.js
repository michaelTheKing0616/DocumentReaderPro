jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue({
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('@tensorflow/tfjs-react-native', () => ({
  bundleResourceIO: jest.fn(),
}));

jest.mock('@tensorflow/tfjs', () => ({
  ready: jest.fn().mockResolvedValue(undefined),
  loadLayersModel: jest.fn(),
}));

jest.mock('pdfjs-dist/legacy/build/pdf.min.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: jest.fn(),
  version: '0.0.0',
}));
