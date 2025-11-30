const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('demTiler', {
  selectInputDem: () => ipcRenderer.invoke('select-input-dem'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  readMetadata: (inputPath) => ipcRenderer.invoke('read-metadata', inputPath),
  runTiler: (options) => ipcRenderer.invoke('run-tiler', options),
});
