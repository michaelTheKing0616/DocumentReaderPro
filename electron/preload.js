const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('readassistDesktop', {
  getVersion: () => ipcRenderer.invoke('readassist:get-version'),
  openExternal: (url) => ipcRenderer.invoke('readassist:open-external', url),
  platform: process.platform,
  isElectron: true,
});

contextBridge.exposeInMainWorld('readAssistTobiiBridge', {
  initialize: () => ipcRenderer.invoke('tobii:initialize'),
  connect: () => ipcRenderer.invoke('tobii:connect'),
  disconnect: () => ipcRenderer.invoke('tobii:disconnect'),
  calibrate: () => ipcRenderer.invoke('tobii:calibrate'),
  getStatus: () => ipcRenderer.invoke('tobii:get-status'),
  isConnected: () => ipcRenderer.invoke('tobii:is-connected'),
  onGaze: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('tobii:gaze', handler);
    return () => ipcRenderer.removeListener('tobii:gaze', handler);
  },
});
