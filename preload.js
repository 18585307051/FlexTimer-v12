const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
    setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag)
});
