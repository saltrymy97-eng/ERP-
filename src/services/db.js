// src/services/db.js – SQLite حقيقية محلية احترافية
// تدعم Electron و Termux والمتصفح بحفظ دائم في ملف .db

let getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase;

// ========== اكتشاف البيئة تلقائياً ==========
const isElectron = !!(window.electronAPI);
const isNode = (typeof process !== 'undefined' && process.versions && process.versions.node);

if (isElectron) {
  // ========== Electron + SQLite حقيقية ==========
  getQuery = async (sql, params = []) => {
    return await window.electronAPI.getQuery(sql, params);
  };

  runQuery = async (sql, params = []) => {
    return await window.electronAPI.runQuery(sql, params);
  };

  initDatabase = async () => {
    console.log('✅ SQLite حقيقية جاهزة (Electron)');
    return true;
  };

  closeDatabase = () => {};

  exportDatabase = async () => {
    const data = await window.electronAPI.exportDB();
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup.db';
    a.click();
  };

  importDatabase = async (file) => {
    const buffer = await file.arrayBuffer();
    await window.electronAPI.importDB(new Uint8Array(buffer));
  };

} else {
  // ========== sql.js مع IndexedDB (وليس localStorage) ==========
  let db = null;
  let SQL = null;
  let dbReady = false;

  // تهيئة sql.js مرة واحدة فقط
  const initSQL = async () => {
    if (SQL) return SQL;
    const initSqlJs = (await import('sql.js')).default;
    SQL = await initSqlJs({ 
      locateFile: file => `https://sql.js.org/dist/${file}` 
    });
    return SQL;
  };

  // استخدام IndexedDB بدل localStorage (أكبر وأكثر استقراراً)
  const DB_NAME = 'AttendanceSystem';
  const DB_STORE = 'database';
  const DB_KEY = 'university_db';

  const openIDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  };

  const saveToIDB = async (data) => {
    try {
      const idb = await openIDB();
      const tx = idb.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      store.put(data, DB_KEY);
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.error('❌ فشل الحفظ في IndexedDB:', e);
      return false;
    }
  };

  const loadFromIDB = async () => {
    try {
      const idb = await openIDB();
      const tx = idb.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const request = store.get(DB_KEY);
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch (e) {
      console.error('❌ فشل التحميل من IndexedDB:', e);
      return null;
    }
  };

  initDatabase = async () => {
    try {
      await initSQL();
      
      // تحميل البيانات من IndexedDB
      const saved = await loadFromIDB();
      
      if (saved) {
        db = new SQL.Database(new Uint8Array(saved));
        console.log('📂 تم تحميل قاعدة البيانات من IndexedDB');
      } else {
        db = new SQL.Database();
        console.log('🆕 تم إنشاء قاعدة بيانات جديدة');
      }
      
      dbReady = true;
      
      // إنشاء الجداول الأساسية إذا لم تكن موجودة
      db.run(`
        CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          department TEXT,
          student_id TEXT UNIQUE,
          fingerprint_data TEXT,
          created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id TEXT NOT NULL,
          date TEXT NOT NULL,
          time_in TEXT,
          time_out TEXT,
          status TEXT DEFAULT 'غائب',
          method TEXT DEFAULT 'يدوي',
          created_at TEXT DEFAULT (datetime('now', 'localtime')),
          UNIQUE(student_id, date)
        )
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);
      
      // حفظ الجداول المنشأة
      await saveToIDB(Array.from(db.export()));
      
      console.log('✅ SQLite جاهزة (IndexedDB)');
      return true;
    } catch (e) {
      console.error('❌ فشل تهيئة قاعدة البيانات:', e);
      db = new SQL.Database();
      dbReady = true;
      return false;
    }
  };

  getQuery = async (sql, params = []) => {
    if (!dbReady || !db) {
      console.error('❌ قاعدة البيانات غير جاهزة');
      return [];
    }
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    } catch (e) {
      console.error('❌ خطأ في الاستعلام:', e.message);
      return [];
    }
  };

  runQuery = async (sql, params = []) => {
    if (!dbReady || !db) {
      console.error('❌ قاعدة البيانات غير جاهزة');
      return null;
    }
    try {
      db.run(sql, params);
      
      // حفظ فوري بعد كل تعديل
      const data = db.export();
      await saveToIDB(Array.from(data));
      
      return { success: true };
    } catch (e) {
      console.error('❌ خطأ في التنفيذ:', e.message);
      return null;
    }
  };

  closeDatabase = () => {
    if (db) {
      db.close();
      db = null;
      dbReady = false;
    }
  };

  exportDatabase = async () => {
    if (!db) return;
    const data = db.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    URL.revokeObjectURL(url);
  };

  importDatabase = async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      db = new SQL.Database(data);
      dbReady = true;
      await saveToIDB(Array.from(data));
      console.log('✅ تم استيراد قاعدة البيانات بنجاح');
      return true;
    } catch (e) {
      console.error('❌ فشل استيراد قاعدة البيانات:', e);
      return false;
    }
  };
}

export { 
  getQuery, 
  runQuery, 
  initDatabase, 
  closeDatabase, 
  exportDatabase, 
  importDatabase 
};
