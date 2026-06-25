// src/services/db.js – SQLite حقيقية محلية احترافية
// تدعم Electron و Termux والمتصفح بحفظ دائم في IndexedDB
// الإصدار 4.0 – جميع الجداول + المعلمين + ربط المدرس بالجداول

let getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase;

// ========== اكتشاف البيئة تلقائياً ==========
const isElectron = !!(window.electronAPI);

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
  // ========== sql.js مع IndexedDB ==========
  let db = null;
  let SQL = null;
  let dbReady = false;

  const initSQL = async () => {
    if (SQL) return SQL;
    const initSqlJs = (await import('sql.js')).default;
    SQL = await initSqlJs({ 
      locateFile: file => `https://sql.js.org/dist/${file}` 
    });
    return SQL;
  };

  const DB_NAME = 'AttendanceSystem';
  const DB_STORE = 'database';
  const DB_KEY = 'university_db';

  const openIDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onupgradeneeded = (event) => {
        const idb = event.target.result;
        if (!idb.objectStoreNames.contains(DB_STORE)) {
          idb.createObjectStore(DB_STORE);
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
      
      const saved = await loadFromIDB();
      
      if (saved) {
        db = new SQL.Database(new Uint8Array(saved));
        console.log('📂 تم تحميل قاعدة البيانات من IndexedDB');
      } else {
        db = new SQL.Database();
        console.log('🆕 تم إنشاء قاعدة بيانات جديدة');
      }
      
      dbReady = true;
      
      // ========== إنشاء جميع الجداول (14 جدول) ==========
      
      // 1. المستخدمين
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'staff',
          created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
      `);

      // 2. سجل التدقيق
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user TEXT,
          action TEXT,
          details TEXT,
          timestamp TEXT DEFAULT (datetime('now', 'localtime'))
        )
      `);

      // 3. الكليات
      db.run(`
        CREATE TABLE IF NOT EXISTS colleges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          status TEXT DEFAULT 'active'
        )
      `);

      // 4. الأقسام
      db.run(`
        CREATE TABLE IF NOT EXISTS departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          college_id INTEGER,
          status TEXT DEFAULT 'active'
        )
      `);

      // 5. التخصصات
      db.run(`
        CREATE TABLE IF NOT EXISTS majors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          department_id INTEGER,
          fees INTEGER DEFAULT 0,
          duration TEXT DEFAULT '4 سنوات',
          status TEXT DEFAULT 'active'
        )
      `);

      // 6. الطلاب (مع حقل الصورة)
      db.run(`
        CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          university_id TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL,
          phone TEXT DEFAULT '',
          parent_phone TEXT DEFAULT '',
          national_id TEXT DEFAULT '',
          major_id INTEGER,
          level TEXT DEFAULT '',
          group_name TEXT DEFAULT '',
          photo TEXT DEFAULT '',
          fingerprint_data TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
      `);

      // 7. المعلمين (جديد)
      db.run(`
        CREATE TABLE IF NOT EXISTS teachers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL,
          email TEXT DEFAULT '',
          phone TEXT DEFAULT '',
          speciality TEXT DEFAULT '',
          department_id INTEGER,
          college_id INTEGER,
          photo TEXT DEFAULT '',
          qualifications TEXT DEFAULT '',
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
      `);

      // 8. الحضور والغياب
      db.run(`
        CREATE TABLE IF NOT EXISTS attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          date TEXT NOT NULL,
          time_in TEXT,
          time_out TEXT,
          status TEXT DEFAULT 'present',
          method TEXT DEFAULT 'fingerprint',
          late_minutes INTEGER DEFAULT 0,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now', 'localtime')),
          UNIQUE(student_id, date)
        )
      `);

      // 9. الأجهزة
      db.run(`
        CREATE TABLE IF NOT EXISTS devices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          port INTEGER DEFAULT 4370,
          status TEXT DEFAULT 'offline',
          last_sync TEXT
        )
      `);

      // 10. التقويم الأكاديمي
      db.run(`
        CREATE TABLE IF NOT EXISTS calendar (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event TEXT NOT NULL,
          date_from TEXT NOT NULL,
          date_to TEXT NOT NULL,
          type TEXT DEFAULT 'event'
        )
      `);

      // 11. الجداول الدراسية (مع ربط المدرس)
      db.run(`
        CREATE TABLE IF NOT EXISTS schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day TEXT DEFAULT '',
          subject TEXT DEFAULT '',
          teacher TEXT DEFAULT '',
          teacher_id INTEGER,
          time_from TEXT DEFAULT '',
          time_to TEXT DEFAULT '',
          room TEXT DEFAULT '',
          break_time INTEGER DEFAULT 0,
          late_tolerance INTEGER DEFAULT 10
        )
      `);

      // 12. الإشعارات
      db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER,
          parent_phone TEXT,
          message TEXT DEFAULT '',
          type TEXT DEFAULT 'manual',
          status TEXT DEFAULT 'sent',
          sent_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
      `);

      // 13. تقييم الانضباط
      db.run(`
        CREATE TABLE IF NOT EXISTS discipline (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER UNIQUE,
          attendance_score INTEGER DEFAULT 0,
          punctuality_score INTEGER DEFAULT 0,
          absence_score INTEGER DEFAULT 0,
          discipline_score INTEGER DEFAULT 0,
          total_score INTEGER DEFAULT 0
        )
      `);

      // 14. الإعدادات
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      // مستخدم افتراضي
      const adminExists = db.exec("SELECT id FROM users WHERE username = 'admin'");
      if (!adminExists || adminExists.length === 0 || !adminExists[0].values.length) {
        db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', 'admin123', 'admin']);
        console.log('👑 تم إنشاء حساب المدير الافتراضي');
      }
      
      // حفظ الجداول المنشأة
      await saveToIDB(Array.from(db.export()));
      
      console.log('✅ SQLite جاهزة (IndexedDB) - 14 جدول');
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
