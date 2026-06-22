// services/db.js – قاعدة البيانات المحلية (SQLite)
import initSqlJs from 'sql.js';

let db = null;

// ========== بدء قاعدة البيانات ==========
export async function initDatabase() {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: file => `https://sql.js.org/dist/${file}`
  });

  db = new SQL.Database();

  // ========== إنشاء الجداول ==========
  db.run(`
    -- الكليات
    CREATE TABLE IF NOT EXISTS colleges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- الأقسام
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      college_id INTEGER,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (college_id) REFERENCES colleges(id)
    );

    -- التخصصات
    CREATE TABLE IF NOT EXISTS majors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id INTEGER,
      fees REAL DEFAULT 0,
      duration TEXT DEFAULT '4 سنوات',
      status TEXT DEFAULT 'active',
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    -- الطلاب
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      parent_phone TEXT,
      national_id TEXT,
      major_id INTEGER,
      level TEXT,
      group_name TEXT,
      photo TEXT,
      fingerprint_data TEXT,
      qr_code TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (major_id) REFERENCES majors(id)
    );

    -- أعضاء هيئة التدريس
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      department_id INTEGER,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    -- الجدول الدراسي
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      subject TEXT NOT NULL,
      teacher_id INTEGER,
      time_from TEXT NOT NULL,
      time_to TEXT NOT NULL,
      room TEXT,
      major_id INTEGER,
      break_time INTEGER DEFAULT 0,
      late_tolerance INTEGER DEFAULT 10,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (major_id) REFERENCES majors(id)
    );

    -- الحضور والغياب
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      schedule_id INTEGER,
      date TEXT NOT NULL,
      time_in TEXT,
      time_out TEXT,
      status TEXT DEFAULT 'present',
      late_minutes INTEGER DEFAULT 0,
      method TEXT DEFAULT 'fingerprint',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    );

    -- أجهزة البصمة
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      port INTEGER DEFAULT 4370,
      status TEXT DEFAULT 'offline',
      last_sync TEXT,
      fingerprint_count INTEGER DEFAULT 0
    );

    -- سجل الإشعارات
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      parent_phone TEXT,
      message TEXT,
      type TEXT,
      sent_at TEXT DEFAULT (datetime('now','localtime')),
      status TEXT DEFAULT 'sent',
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    -- التقويم الأكاديمي
    CREATE TABLE IF NOT EXISTS calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      type TEXT DEFAULT 'event'
    );

    -- سجل التدقيق
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT,
      action TEXT,
      details TEXT,
      timestamp TEXT DEFAULT (datetime('now','localtime'))
    );

    -- تقييم الانضباط
    CREATE TABLE IF NOT EXISTS discipline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER UNIQUE,
      attendance_score REAL DEFAULT 0,
      punctuality_score REAL DEFAULT 0,
      absence_score REAL DEFAULT 0,
      discipline_score REAL DEFAULT 0,
      total_score REAL DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    -- المستخدمين
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // مستخدم افتراضي
  const adminExists = db.exec("SELECT id FROM users WHERE username='admin'");
  if (!adminExists.length || !adminExists[0].values.length) {
    db.run("INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')");
  }

  return db;
}

// ========== دوال مساعدة ==========
export function getDB() {
  if (!db) throw new Error('قاعدة البيانات غير مهيأة. استدع initDatabase() أولاً');
  return db;
}

export function runQuery(sql, params = []) {
  const database = getDB();
  database.run(sql, params);
  saveToLocalStorage(database);
}

export function getQuery(sql, params = []) {
  const database = getDB();
  const result = database.exec(sql, params);
  if (!result.length) return [];
  const columns = result[0].columns;
  const values = result[0].values;
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function saveToLocalStorage(database) {
  try {
    const data = database.export();
    const arr = Array.from(data);
    localStorage.setItem('attendance_db', JSON.stringify(arr));
  } catch (e) {
    console.error('فشل حفظ قاعدة البيانات محلياً:', e);
  }
}

export async function loadFromLocalStorage() {
  const saved = localStorage.getItem('attendance_db');
  if (saved) {
    const SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });
    const arr = JSON.parse(saved);
    const u8 = new Uint8Array(arr);
    db = new SQL.Database(u8);
    return db;
  }
  return null;
}

export function closeDatabase() {
  if (db) {
    saveToLocalStorage(db);
    db.close();
    db = null;
  }
}

// ========== تصدير البيانات ==========
export function exportDatabase() {
  const database = getDB();
  const data = database.export();
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_backup_${new Date().toISOString().slice(0,10)}.db`;
  a.click();
  URL.revokeObjectURL(url);
}

// ========== استيراد البيانات ==========
export async function importDatabase(file) {
  const SQL = await initSqlJs({
    locateFile: f => `https://sql.js.org/dist/${f}`
  });
  const buffer = await file.arrayBuffer();
  const u8 = new Uint8Array(buffer);
  db = new SQL.Database(u8);
  saveToLocalStorage(db);
  return db;
}
