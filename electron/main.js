// electron/main.js – تطبيق Electron مع SQLite حقيقية محلية احترافية
// الإصدار 3.3.0 - مع دعم Transaction ذرّي للاستيراد
// مطور النظام: المهندس سالم فهمي التريمي
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const net = require('net');
const fs = require('fs');

// استدعاء ملف البصمة
try {
  require(path.join(__dirname, 'fingerprint'));
} catch (err) {
  console.error('⚠️ تحذير: ملف fingerprint.js غير موجود:', err.message);
}

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

// ========== إنشاء جميع الجداول ==========
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
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS student_fingerprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    finger_index INTEGER NOT NULL,
    template TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(student_id, finger_index)
  );

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
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS teacher_fingerprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    finger_index INTEGER NOT NULL,
    template TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    UNIQUE(teacher_id, finger_index)
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

  CREATE TABLE IF NOT EXISTS teacher_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time_in TEXT,
    time_out TEXT,
    status TEXT DEFAULT 'present',
    lesson_title TEXT DEFAULT '',
    completion_rate INTEGER DEFAULT 0,
    total_hours REAL DEFAULT 0.0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    UNIQUE(teacher_id, date)
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
    teacher_id INTEGER,
    time_from TEXT DEFAULT '',
    time_to TEXT DEFAULT '',
    room TEXT DEFAULT '',
    break_time INTEGER DEFAULT 0,
    late_tolerance INTEGER DEFAULT 10,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
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

// إدراج مستخدم افتراضي
const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('admin', 'admin123', 'admin');
  console.log('👑 تم إنشاء حساب المدير الافتراضي');
}

console.log('✅ جميع الجداول جاهزة');

// ========== IPC: SELECT ==========
ipcMain.handle('getQuery', (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const safeParams = Array.isArray(params) && params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const rows = stmt.all(safeParams);
    return rows || [];
  } catch (e) {
    console.error('❌ خطأ SELECT:', e.message);
    return [];
  }
});

// ========== IPC: INSERT/UPDATE/DELETE ==========
ipcMain.handle('runQuery', (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(params);
    return { success: true, lastID: result.lastInsertRowid, changes: result.changes };
  } catch (e) {
    console.error('❌ خطأ RUN:', e.message);
    return null;
  }
});

// =========================================================================
// 🚀 IPC: استيراد جماعي ذرّي (Transaction)
// =========================================================================
ipcMain.handle('runBulkImport', (event, target, records) => {
  try {
    if (!target || !Array.isArray(records) || records.length === 0) {
      return { success: false, error: 'لا توجد سجلات للاستيراد' };
    }

    const isStudent = target === 'student';
    const table = isStudent ? 'attendance' : 'teacher_attendance';
    const foreignKey = isStudent ? 'student_id' : 'teacher_id';

    const checkStmt = db.prepare(`SELECT id FROM ${table} WHERE ${foreignKey} = ? AND date = ?`);
    const updateStmt = db.prepare(`UPDATE ${table} SET time_in = ?, status = ?, method = 'excel' WHERE id = ?`);
    const insertStmt = db.prepare(`INSERT INTO ${table} (${foreignKey}, date, time_in, status, method) VALUES (?, ?, ?, ?, 'excel')`);

    const executeImport = db.transaction((recs) => {
      let inserted = 0;
      let updated = 0;

      for (const rec of recs) {
        const exists = checkStmt.get(rec.personId, rec.date);
        if (exists) {
          updateStmt.run(rec.time, rec.status, exists.id);
          updated++;
        } else {
          insertStmt.run(rec.personId, rec.date, rec.time, rec.status);
          inserted++;
        }
      }

      return { inserted, updated };
    });

    const result = executeImport(records);
    return { success: true, inserted: result.inserted, updated: result.updated };
  } catch (e) {
    console.error('❌ خطأ في الاستيراد الجماعي:', e.message);
    return { success: false, error: e.message };
  }
});

// =========================================================================
// 🚀 IPC: تسجيل غائبين جماعي (Transaction)
// =========================================================================
ipcMain.handle('runBulkAbsence', (event, target, dates) => {
  try {
    if (!target || !Array.isArray(dates) || dates.length === 0) {
      return { success: false, error: 'لا توجد تواريخ' };
    }

    const isStudent = target === 'student';
    const table = isStudent ? 'attendance' : 'teacher_attendance';
    const foreignKey = isStudent ? 'student_id' : 'teacher_id';
    const sourceTable = isStudent ? 'students' : 'teachers';

    const activePeople = db.prepare(`SELECT id FROM ${sourceTable} WHERE status = 'active'`).all();

    const checkStmt = db.prepare(`SELECT id FROM ${table} WHERE ${foreignKey} = ? AND date = ?`);
    const insertStmt = db.prepare(`INSERT INTO ${table} (${foreignKey}, date, status, method) VALUES (?, ?, 'absent', 'excel-auto')`);

    const executeAbsence = db.transaction(() => {
      let absentCount = 0;

      for (const date of dates) {
        for (const p of activePeople) {
          const exists = checkStmt.get(p.id, date);
          if (!exists) {
            insertStmt.run(p.id, date);
            absentCount++;
          }
        }
      }

      return { absentCount };
    });

    const result = executeAbsence();
    return { success: true, absentCount: result.absentCount };
  } catch (e) {
    console.error('❌ خطأ في تسجيل الغائبين:', e.message);
    return { success: false, error: e.message };
  }
});

// ========== IPC: تصدير قاعدة البيانات ==========
ipcMain.handle('exportDB', async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'حفظ نسخة احتياطية',
      defaultPath: `quran_attendance_backup_${today}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    const data = db.serialize();
    fs.writeFileSync(filePath, data);

    console.log('✅ تم التصدير:', filePath);
    return { success: true, filePath };
  } catch (e) {
    console.error('❌ خطأ التصدير:', e);
    return { success: false, error: e.message };
  }
});

// ========== IPC: استيراد قاعدة البيانات ==========
ipcMain.handle('importDB', async (event, sourceFilePath) => {
  try {
    let filePathToImport = sourceFilePath;
    if (!filePathToImport || typeof filePathToImport !== 'string') {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'اختر ملف النسخة الاحتياطية',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile']
      });
      if (canceled || filePaths.length === 0) return { success: false, canceled: true };
      filePathToImport = filePaths[0];
    }

    const buffer = fs.readFileSync(filePathToImport);

    const header = buffer.toString('utf8', 0, 16);
    if (!header.startsWith('SQLite format 3')) {
      throw new Error('الملف المختار ليس قاعدة بيانات SQLite صحيحة.');
    }

    if (db) {
      try { db.pragma('journal_mode = DELETE'); } catch (errWal) { console.warn('⚠️', errWal.message); }
      db.close();
    }

    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) { try { fs.unlinkSync(walPath); } catch (e) {} }
    if (fs.existsSync(shmPath)) { try { fs.unlinkSync(shmPath); } catch (e) {} }

    fs.writeFileSync(dbPath, buffer);

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    console.log('✨ تمت الاستعادة بنجاح');
    return { success: true };
  } catch (e) {
    console.error('❌ خطأ الاستيراد:', e);

    try {
      if (!db || !db.open) {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
      }
    } catch (reconnectErr) {
      console.error('❌ فشل إعادة الاتصال:', reconnectErr);
    }

    return { success: false, error: e.message };
  }
});

// ========== IPC: فحص جهاز البصمة ==========
ipcMain.handle('testDevicePing', async (event, ip, port = 4370) => {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(2500);

    client.on('connect', () => { client.destroy(); resolve(true); });
    client.on('timeout', () => { client.destroy(); resolve(false); });
    client.on('error', () => { client.destroy(); resolve(false); });

    client.connect(port, ip);
  });
});

// =========================================================================
// 🔄 مستمع الحضور الفوري (Background Listener)
// =========================================================================
function startRealtimeAttendanceListener() {
  const checkInterval = 5000;

  setInterval(async () => {
    try {
      if (!db || !db.open) return;

      const activeDevice = db.prepare("SELECT ip_address, port FROM devices WHERE status = 'online' LIMIT 1").get();
      if (!activeDevice) return;

      const client = new net.Socket();
      client.setTimeout(2000);

      client.on('connect', () => {
        const requestLogCmd = Buffer.from([0x5a, 0x4b, 0x03, 0x00, 0x00, 0x00]);
        client.write(requestLogCmd);
      });

      client.on('data', async (data) => {
        client.destroy();

        const rawId = extractUserIdFromZKPacket(data);
        if (!rawId) return;

        const isTeacher = rawId > 50000;
        const targetTable = isTeacher ? 'teachers' : 'students';
        const attendanceTable = isTeacher ? 'teacher_attendance' : 'attendance';
        const foreignKey = isTeacher ? 'teacher_id' : 'student_id';

        const userId = isTeacher ? rawId - 50000 : rawId;
        const currentDate = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toLocaleTimeString('ar-SA', { hour12: false });

        if (!db || !db.open) return;

        const person = db.prepare(`SELECT id FROM ${targetTable} WHERE id = ?`).get(userId);
        if (person) {
          const exists = db.prepare(`SELECT id FROM ${attendanceTable} WHERE ${foreignKey} = ? AND date = ?`).get(userId, currentDate);
          if (!exists) {
            if (!isTeacher) {
              db.prepare(`INSERT INTO ${attendanceTable} (${foreignKey}, date, time_in, status, method) VALUES (?, ?, ?, 'present', 'fingerprint')`)
                .run(userId, currentDate, currentTime);
            } else {
              db.prepare(`INSERT INTO ${attendanceTable} (${foreignKey}, date, time_in, status) VALUES (?, ?, ?, 'present')`)
                .run(userId, currentDate, currentTime);
            }

            console.log(`✅ تم تسجيل حضور (${isTeacher ? 'محاضر' : 'طالب'}) رقم ${userId}`);
            if (mainWindow) mainWindow.webContents.send('attendance-updated', { type: isTeacher ? 'teacher' : 'student', id: userId });
          }
        }
      });

      client.on('error', () => client.destroy());
      client.on('timeout', () => client.destroy());

      client.connect(activeDevice.port, activeDevice.ip_address);
    } catch (e) { /* حماية المستمع */ }
  }, checkInterval);
}

function extractUserIdFromZKPacket(data) {
  if (data && data.length >= 6) {
    return ((data[4] << 8) | data[5]) >>> 0;
  }
  return null;
}

app.whenReady().then(() => {
  startRealtimeAttendanceListener();
});

// ========== النافذة الرئيسية ==========
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      }
    };
  });

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
    console.log('🔒 تم إغلاق قاعدة البيانات قبل الإغلاق');
  }
});
