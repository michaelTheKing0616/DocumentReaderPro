const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';
const WEBPACK_DEV_SERVER_URL = process.env.WEBPACK_DEV_SERVER_URL;
const DEV_LAB = process.env.EXPO_PUBLIC_DEV_LAB === 'true';

const TOBII_GAZE_HZ = 60;
const TOBII_GAZE_INTERVAL_MS = 1000 / TOBII_GAZE_HZ;

let mainWindow = null;
let tobiiConnected = false;
let tobiiInitialized = false;
let tobiiGazeInterval = null;
let tobiiNativeSdk = null;

function getTobiiStatus() {
  return {
    connected: tobiiConnected,
    initialized: tobiiInitialized,
    devLab: DEV_LAB,
    nativeSdkAvailable: Boolean(tobiiNativeSdk),
    platform: process.platform,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    title: 'ReadAssist Pro',
  });

  if (WEBPACK_DEV_SERVER_URL) {
    mainWindow.loadURL(WEBPACK_DEV_SERVER_URL);
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../web-build/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopTobiiGazeEmitter();
  });
}

function stopTobiiGazeEmitter() {
  if (tobiiGazeInterval) {
    clearInterval(tobiiGazeInterval);
    tobiiGazeInterval = null;
  }
}

function emitTobiiGaze(payload) {
  if (!tobiiConnected || !mainWindow) {
    return;
  }
  mainWindow.webContents.send('tobii:gaze', payload);
}

function tryLoadNativeTobiiSdk() {
  try {
    // Optional native binding when Tobii SDK is installed on the host machine.
    tobiiNativeSdk = require('@tobii/sdk-node');
    return true;
  } catch {
    tobiiNativeSdk = null;
    return false;
  }
}

function startNativeTobiiGazeStream() {
  if (!tobiiNativeSdk || typeof tobiiNativeSdk.onGaze !== 'function') {
    return false;
  }

  tobiiNativeSdk.onGaze((event) => {
    emitTobiiGaze({
      x: event.x,
      y: event.y,
      timestamp: event.timestamp ?? Date.now(),
      valid: event.valid !== false,
    });
  });
  return true;
}

/** Synthetic gaze stream when native SDK is unavailable (dev-lab or desktop testing). */
function startSyntheticTobiiGazeStream() {
  stopTobiiGazeEmitter();

  if (!mainWindow) {
    return;
  }

  let x = 640;
  let y = 400;

  tobiiGazeInterval = setInterval(() => {
    if (!tobiiConnected || !mainWindow) {
      return;
    }

    x = Math.max(0, Math.min(1280, x + (Math.random() - 0.5) * 12));
    y = Math.max(0, Math.min(800, y + (Math.random() - 0.5) * 8));

    emitTobiiGaze({
      x,
      y,
      timestamp: Date.now(),
      valid: true,
    });
  }, TOBII_GAZE_INTERVAL_MS);
}

function startTobiiGazeEmitter() {
  stopTobiiGazeEmitter();

  if (!tobiiConnected || !mainWindow) {
    return;
  }

  if (startNativeTobiiGazeStream()) {
    return;
  }

  if (DEV_LAB || isDev) {
    startSyntheticTobiiGazeStream();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopTobiiGazeEmitter();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', async () => {
  tobiiConnected = false;
  stopTobiiGazeEmitter();
  if (tobiiNativeSdk && typeof tobiiNativeSdk.disconnect === 'function') {
    try {
      await tobiiNativeSdk.disconnect();
    } catch {
      // Native SDK may already be torn down during quit.
    }
  }
});

ipcMain.handle('readassist:get-version', () => app.getVersion());

ipcMain.handle('readassist:open-external', async (_event, url) => {
  const { shell } = require('electron');
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new Error('Invalid external URL');
  }
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('tobii:initialize', async () => {
  try {
    const nativeAvailable = tryLoadNativeTobiiSdk();
    tobiiInitialized = true;
    return {
      ok: true,
      nativeSdkAvailable: nativeAvailable,
      devLab: DEV_LAB,
    };
  } catch (error) {
    tobiiInitialized = false;
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

ipcMain.handle('tobii:connect', async () => {
  if (!tobiiInitialized) {
    tryLoadNativeTobiiSdk();
    tobiiInitialized = true;
  }

  tobiiConnected = true;
  startTobiiGazeEmitter();
  return { ok: true, ...getTobiiStatus() };
});

ipcMain.handle('tobii:disconnect', async () => {
  tobiiConnected = false;
  stopTobiiGazeEmitter();

  if (tobiiNativeSdk && typeof tobiiNativeSdk.disconnect === 'function') {
    await tobiiNativeSdk.disconnect();
  }

  return { ok: true, ...getTobiiStatus() };
});

ipcMain.handle('tobii:calibrate', async () => {
  if (!tobiiConnected) {
    return { ok: false, error: 'Tobii not connected' };
  }

  if (tobiiNativeSdk && typeof tobiiNativeSdk.calibrate === 'function') {
    const result = await tobiiNativeSdk.calibrate();
    return { ok: Boolean(result) };
  }

  return { ok: true, simulated: true };
});

ipcMain.handle('tobii:get-status', async () => getTobiiStatus());

ipcMain.handle('tobii:is-connected', async () => tobiiConnected);
