// electron/preload.js – الجسر الآمن بين React وقاعدة البيانات
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  runQuery: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  exportDB: () => ipcRenderer.invoke('db:export')
});
