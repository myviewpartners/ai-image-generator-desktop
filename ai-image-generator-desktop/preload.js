const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  generateImage: (params) => ipcRenderer.invoke('generate-image', params),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getHistory: (params) => ipcRenderer.invoke('get-history', params),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  downloadImage: (params) => ipcRenderer.invoke('download-image', params),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
