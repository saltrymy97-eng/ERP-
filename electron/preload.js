// electron/preload.js – الجسر الآمن المحدث لدعم البصمة الحقيقية ZD-K وقاعدة البيانات SQLite
// مطور النظام: المهندس سالم فهمي التريمي
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

  // =========================================================
  // 🖐️ جسور العبور الخاصة بجهاز البصمة الحقيقي ZD-K (ZKTeco)
  // =========================================================
  
  // فحص الاتصال الحقيقي والفعلي بجهاز البصمة عبر الشبكة
  testDevicePing: (ip, port) => ipcRenderer.invoke('testDevicePing', ip, port),

  // إرسال أمر بدء تسجيل إحدى البصمات الـ 5 الاحتياطية للطالب أو المدرس
  enrollFinger: (options) => ipcRenderer.invoke('enrollFinger', options),
  
  // معلومات النظام
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
});
