// electron/main.js – تطبيق Electron مع SQLite حقيقية محلية احترافية لدعم جهاز ZD-K البصمة الحقيقية
// الإصدار المطور كلياً والمكمل للجداول الـ 16 لمنظومة الحضور الأكاديمي والطباعة الفاخرة
// مطور النظام: المهندس سالم فهمي التريمي
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const net = require('net'); // للاتصال الشبكي المباشر بجهاز ZD-K عبر منفذ 4370
const fs = require('fs');

// استدعاء ملف البصمة من الجذر مباشرة داخل التغليف
try {
  require(path.join(__dirname, 'fingerprint'));
} catch (err) {
  console.error('⚠️ تحذير: ملف fingerprint.js غير موجود في المسار المحدد:', err.message);
}

// ========== إعداد قاعدة البيانات ==========
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'attendance_system.db');
console.log('📁 مسار قاعدة البيانات المعتمد:', dbPath);

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  console.log('✅ تم فتح قاعدة البيانات بنجاح في المسار الآمن');
} catch (e) {
  console.error('❌ فشل فتح قاعدة البيانات الملحقة:', e);
  app.quit();
}

// ========== إنشاء جميع الجداول (16 جدول متكامل بعد إضافة جداول البصمات الخمس) ==========
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

  -- [جدول البصمات الخمس الاحتياطية للطلاب - الأستاذ سعيد]
  CREATE TABLE IF NOT EXISTS student_fingerprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    finger_index INTEGER NOT NULL, -- من 0 إلى 4 لتمثيل الأصابع الخمسة
    template TEXT NOT NULL, -- البصمة الثنائية المشفرة
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

  -- [جدول البصمات الخمس الاحتياطية للمدرسين - الأستاذ سعيد]
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

// إدراج مستخدم افتراضي إذا لم يوجد
const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('admin', 'admin123', 'admin');
  console.log('👑 تم إنشاء حساب المدير الافتراضي بنجاح');
}

console.log('%c✅ جميع الجداول السيادية جاهزة ومؤمنة (16 جدولاً متكاملة مع جداول الـ 5 بصمات الاحتياطية)', 'color: green');

// ========== IPC: استعلام SELECT المحمي والمطور لفك البارامترات ==========
ipcMain.handle('getQuery', (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const safeParams = Array.isArray(params) && params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    
    const rows = stmt.all(safeParams);
    return rows || [];
  } catch (e) {
    console.error('❌ خطأ في استعلام الـ SQLite:', e.message);
    return [];
  }
});

// ========== IPC: تنفيذ INSERT/UPDATE/DELETE ==========
ipcMain.handle('runQuery', (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(params);
    return { 
      success: true, 
      lastID: result.lastInsertRowid, 
      changes: result.changes 
    };
  } catch (e) {
    console.error('❌ خطأ في تنفيذ الاستعلام التعديلي:', e.message);
    return null;
  }
});

// ========== IPC: تصدير قاعدة البيانات ==========
ipcMain.handle('exportDB', () => {
  try {
    const data = db.serialize();
    return Buffer.from(data).toString('base64');
  } catch (e) {
    console.error('❌ خطأ في تصدير النسخة الاحتياطية للـ DB:', e);
    return null;
  }
});

// ========== IPC: استيراد قاعدة البيانات ==========
ipcMain.handle('importDB', (event, data) => {
  try {
    const buffer = Buffer.from(data, 'base64');
    db.close();
    fs.writeFileSync(dbPath, buffer);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return { success: true };
  } catch (e) {
    console.error('❌ خطأ في استيراد قاعدة البيانات الفاخرة:', e);
    return { success: false, error: e.message };
  }
});

// =========================================================================
// 🖐️ قنوات الاتصال والتحكم بجهاز البصمة الحقيقي ZD-K (بروتوكول TCP/IP للشبكة)
// =========================================================================

ipcMain.handle('testDevicePing', async (event, ip, port = 4370) => {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(2500);

    client.on('connect', () => {
      client.destroy();
      resolve(true);
    });

    client.on('timeout', () => {
      client.destroy();
      resolve(false);
    });

    client.on('error', () => {
      client.destroy();
      resolve(false);
    });

    client.connect(port, ip);
  });
});

// =========================================================================
// 🔄 مستمع الوقت الفعلي (Background Attendance Listener)
// =========================================================================
function startRealtimeAttendanceListener() {
  const checkInterval = 5000;
  
  setInterval(async () => {
    try {
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
            
            console.log(`✅ تم تسجيل حضور (${isTeacher ? 'محاضر' : 'طالب'}) رقم ${userId} تلقائياً.`);
            if (mainWindow) mainWindow.webContents.send('attendance-updated', { type: isTeacher ? 'teacher' : 'student', id: userId });
          }
        }
      });

      client.on('error', () => client.destroy());
      client.on('timeout', () => client.destroy());

      client.connect(activeDevice.port, activeDevice.ip_address);
    } catch (e) {
      // حماية المستمع الخلفي
    }
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

// ========== النافذة الرئيسية (إعدادات التغليف النقي) ==========
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, 'logo.png'), // فك التجميع الصريح والمباشر من جذر الـ ASAR
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // يتوجه مباشرة للجذر مصلحاً خطأ الـ Console تماماً
    }
  });

  // 🔥 [الحل الجذري الاحترافي المستقر]: استدعاء ملف index.html مباشرة من مجلد البناء عند التغليف لإنهاء أزمة الرابط الوهمي
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html')); // مرحلة التطوير العادية
  }

  // السماح بنوافذ الطباعة المنبثقة وحقن مسار الـ preload النقي من الجذر
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js') // جذر التغليف المباشر
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
      console.log('🔒 تم إغلاق قاعدة البيانات بأمان');
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
    console.log('🔒 تم إغلاق قاعدة البيانات قبل الإغلاق الكلي للبرنامج');
  }
});
