// electron/preload.js – الجسر الآمن بين React وقاعدة البيانات SQLite المحلية
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // استعلامات SELECT – إرجاع البيانات
  getQuery: (sql, params = []) => ipcRenderer.invoke('getQuery', sql, params),
  
  // استعلامات INSERT/UPDATE/DELETE – تنفيذ وتعديل
  runQuery: (sql, params = []) => ipcRenderer.invoke('runQuery', sql, params),
  
  // تصدير قاعدة البيانات كـ Base64
  exportDB: () => ipcRenderer.invoke('exportDB'),
  
  // استيراد قاعدة البيانات من Base64
  importDB: (data) => ipcRenderer.invoke('importDB', data),
  
  // معلومات النظام
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
});
