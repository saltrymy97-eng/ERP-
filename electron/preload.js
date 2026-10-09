// electron/preload.js – الجسر الآمن المحدث لدعم البصمة الحقيقية ZD-K وقاعدة البيانات SQLite
// الإصدار 3.3.0 - مع دعم Transaction الذرّي للاستيراد
// مطور النظام: المهندس سالم فهمي التريمي
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // =========================================================
  // 📊 استعلامات قاعدة البيانات
  // =========================================================
  
  // استعلامات SELECT – إرجاع البيانات
  getQuery: (sql, params = []) => ipcRenderer.invoke('getQuery', sql, params),
  
  // استعلامات INSERT/UPDATE/DELETE – تنفيذ وتعديل
  runQuery: (sql, params = []) => ipcRenderer.invoke('runQuery', sql, params),
  
  // =========================================================
  // 🚀 استيراد جماعي ذرّي (Transaction)
  // =========================================================
  
  // استيراد سجلات الحضور بشكل ذرّي (إما الكل ينجح أو الكل يفشل)
  runBulkImport: (target, records) => ipcRenderer.invoke('runBulkImport', target, records),
  
  // تسجيل الغائبين بشكل ذرّي
  runBulkAbsence: (target, dates) => ipcRenderer.invoke('runBulkAbsence', target, dates),
  
  // =========================================================
  // 💾 النسخ الاحتياطي
  // =========================================================
  
  // تصدير قاعدة البيانات المباشر عبر نافذة الويندوز
  exportDB: () => ipcRenderer.invoke('exportDB'),
  
  // استيراد واستعادة قاعدة البيانات بالمسار المباشر
  importDB: (filePath) => ipcRenderer.invoke('importDB', filePath),

  // =========================================================
  // 🖐️ جسور العبور الخاصة بجهاز البصمة الحقيقي ZD-K (ZKTeco)
  // =========================================================
  
  // فحص الاتصال الحقيقي والفعلي بجهاز البصمة عبر الشبكة
  testDevicePing: (ip, port) => ipcRenderer.invoke('testDevicePing', ip, port),

  // إرسال أمر بدء تسجيل إحدى البصمات الـ 5 الاحتياطية للطالب أو المدرس
  enrollFinger: (options) => ipcRenderer.invoke('enrollFinger', options),
  
  // =========================================================
  // 🔄 مستمع التحديثات الفورية (Background Listener)
  // =========================================================
  
  // الاستماع لتحديثات الحضور الآلية من المستمع الخلفي
  onAttendanceUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('attendance-updated', handler);
    return () => ipcRenderer.removeListener('attendance-updated', handler);
  },
  
  // =========================================================
  // ℹ️ معلومات النظام
  // =========================================================
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  }
});
