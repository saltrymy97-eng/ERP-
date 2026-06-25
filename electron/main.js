// electron/main.js – تطبيق Electron مع SQLite حقيقية محلية احترافية
// الإصدار 3.0 – جميع الجداول موحدة + صورة الطالب + الجداول الدراسية الكاملة
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// ========== إعداد قاعدة البيانات ==========
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'attendance_system.db');
console.log('📁 مسار قاعدة البيانات:', dbPath);

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  console.log('✅ تم فتح قاعدة البيانات بنجاح');
} catch (e) {
  console.error('❌ فشل فتح قاعدة البيانات:', e);
  app.quit();
}

// ========== إنشاء جميع الجداول (متوافقة مع db.js) ==========
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'staff',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    action TEXT,
    details TEXT,
    timestamp TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS colleges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    college_id INTEGER,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS majors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department_id INTEGER,
    fees INTEGER DEFAULT 0,
    duration TEXT DEFAULT '4 سنوات',
    status TEXT DEFAULT 'active',
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
  );

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
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL
  );

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
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(student_id, date)
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 4370,
    status TEXT DEFAULT 'offline',
    last_sync TEXT
  );

  CREATE TABLE IF NOT EXISTS calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    type TEXT DEFAULT 'event'
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    teacher TEXT DEFAULT '',
    time_from TEXT DEFAULT '',
    time_to TEXT DEFAULT '',
    room TEXT DEFAULT '',
    break_time INTEGER DEFAULT 0,
    late_tolerance INTEGER DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    parent_phone TEXT,
    message TEXT DEFAULT '',
    type TEXT DEFAULT 'manual',
    status TEXT DEFAULT 'sent',
    sent_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS discipline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER UNIQUE,
    attendance_score INTEGER DEFAULT 0,
    punctuality_score INTEGER DEFAULT 0,
    absence_score INTEGER DEFAULT 0,
    discipline_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// إدراج مستخدم افتراضي إذا لم يوجد
const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('admin', 'admin123', 'admin');
  console.log('👑 تم إنشاء حساب المدير الافتراضي');
}

console.log('✅ جميع الجداول جاهزة (13 جدول)');

// ========== IPC: استعلام SELECT ==========
ipcMain.handle('getQuery', (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    return rows || [];
  } catch (e) {
    console.error('❌ خطأ في الاستعلام:', e.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    return [];
  }
});

// ========== IPC: تنفيذ INSERT/UPDATE/DELETE ==========
ipcMain.handle('runQuery', (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { 
      success: true, 
      lastID: result.lastInsertRowid, 
      changes: result.changes 
    };
  } catch (e) {
    console.error('❌ خطأ في التنفيذ:', e.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    return null;
  }
});

// ========== IPC: تصدير قاعدة البيانات ==========
ipcMain.handle('exportDB', () => {
  try {
    const data = db.serialize();
    return Buffer.from(data).toString('base64');
  } catch (e) {
    console.error('❌ خطأ في التصدير:', e);
    return null;
  }
});

// ========== IPC: استيراد قاعدة البيانات ==========
ipcMain.handle('importDB', (event, data) => {
  try {
    const buffer = Buffer.from(data, 'base64');
    db.close();
    const fs = require('fs');
    fs.writeFileSync(dbPath, buffer);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return { success: true };
  } catch (e) {
    console.error('❌ خطأ في الاستيراد:', e);
    return { success: false, error: e.message };
  }
});

// ========== النافذة الرئيسية ==========
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) {
      db.close();
      console.log('🔒 تم إغلاق قاعدة البيانات');
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
    console.log('🔒 تم إغلاق قاعدة البيانات');
  }
});
