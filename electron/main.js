// electron/main.js – تطبيق Electron مع SQLite حقيقية
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// ========== إعداد قاعدة البيانات ==========
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'university.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// إنشاء الجداول
db.exec(`
  CREATE TABLE IF NOT EXISTS colleges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    college_id INTEGER,
    status TEXT DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS majors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department_id INTEGER,
    fees INTEGER DEFAULT 0,
    duration TEXT DEFAULT '4 سنوات',
    status TEXT DEFAULT 'active'
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
    status TEXT DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    date TEXT NOT NULL,
    time_in TEXT,
    time_out TEXT,
    status TEXT DEFAULT 'present',
    method TEXT DEFAULT 'fingerprint',
    late_minutes INTEGER DEFAULT 0
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
    subject TEXT DEFAULT '',
    time_from TEXT DEFAULT '',
    time_to TEXT DEFAULT '',
    room TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at TEXT,
    student_id INTEGER,
    message TEXT DEFAULT '',
    status TEXT DEFAULT 'sent'
  );
  CREATE TABLE IF NOT EXISTS discipline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    attendance_score INTEGER DEFAULT 0,
    punctuality_score INTEGER DEFAULT 0,
    absence_score INTEGER DEFAULT 0,
    discipline_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0
  );
`);

// ========== IPC ==========
ipcMain.handle('db:query', (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (e) {
    console.error('Query Error:', e);
    return [];
  }
});

ipcMain.handle('db:run', (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    stmt.run(...params);
    return { success: true };
  } catch (e) {
    console.error('Run Error:', e);
    return null;
  }
});

ipcMain.handle('db:export', () => {
  return db.serialize();
});

// ========== النافذة ==========
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../public/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
