// src/services/db.js – SQLite حقيقية محلية احترافية (نسخة الديسكتوب النقية)
// الإصدار 5.0 – دعم كامل ومباشر لـ Electron فقط لضمان الاستقرار الحقيقي

let getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase;

// ========== الاتصال المباشر بجسر الـ Electron ==========

getQuery = async (sql, params = []) => {
  return await window.electronAPI.getQuery(sql, params);
};

runQuery = async (sql, params = []) => {
  return await window.electronAPI.runQuery(sql, params);
};

initDatabase = async () => {
  console.log('✅ SQLite حقيقية جاهزة ومستقرة (Electron Desktop Only)');
  return true;
};

closeDatabase = () => {
  console.log('🔒 إشارة إغلاق قاعدة البيانات');
};

exportDatabase = async () => {
  try {
    const data = await window.electronAPI.exportDB();
    if (!data) throw new Error('لم يتم إرجاع بيانات من قاعدة البيانات');
    
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('📥 تم تصدير نسخة احتياطية بنجاح');
  } catch (e) {
    console.error('❌ فشل تصدير قاعدة البيانات:', e);
  }
};

importDatabase = async (file) => {
  try {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const base64Data = reader.result.split(',')[1];
          const result = await window.electronAPI.importDB(base64Data);
          console.log('✅ تم استيراد قاعدة البيانات بنجاح');
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
    });
  } catch (e) {
    console.error('❌ فشل استيراد قاعدة البيانات:', e);
    return false;
  }
};

export { 
  getQuery, 
  runQuery, 
  initDatabase, 
  closeDatabase, 
  exportDatabase, 
  importDatabase 
};
