const { contextBridge } = require('electron');

// Exponer APIs seguras al renderizador
contextBridge.exposeInMainWorld('api', {
  version: process.versions.electron
});
