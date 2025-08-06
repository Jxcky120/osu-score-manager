// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setFolder: (path) => ipcRenderer.send('set:osufolder', path),
  selectFolder: () => ipcRenderer.invoke('select:osufolder'),
  loadScores: () => ipcRenderer.send('load:scores'),
  receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  saveReplay: (beatmapHash, replayHash, name) => ipcRenderer.send('save:replay', beatmapHash, replayHash, name),
  openReplay: (beatmapHash, replayHash) => ipcRenderer.send('open:replay', beatmapHash, replayHash)
});
