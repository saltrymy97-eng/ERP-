// public/fingerprint.js – ربط أجهزة بصمة ZKTeco (SQLite محلية حقيقية)
// مطور النظام: المهندس سالم فهمي التريمي

const { ipcMain, app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// إعداد قاعدة البيانات مباشرة داخل ملف البصمة لضمان تنفيذ عمليات الاستعلام (runQuery, getQuery) محلياً بدون أخطاء استيراد
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'attendance_system.db');
let db;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (e) {
  console.error('❌ فشل فتح قاعدة البيانات من ملف البصمة:', e);
}

// دالات بديلة للتعامل مع قاعدة البيانات محلياً بشكل مباشر وآمن
function localGetQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(params) || [];
  } catch (e) {
    console.error('❌ خطأ استعلام في fingerprint:', e.message);
    return [];
  }
}

function localRunQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(params);
    return { success: true, lastID: result.lastInsertRowid, changes: result.changes };
  } catch (e) {
    console.error('❌ خطأ تعديل في fingerprint:', e.message);
    return { success: false, error: e.message };
  }
}

// --- الدوال الأساسية بعد تحويلها لصيغة CommonJS ---

async function connectDevice(device) {
  try {
    const response = await fetch(`http://${device.ip_address}:${device.port}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect' })
    });

    if (response.ok) {
      localRunQuery(
        "UPDATE devices SET status = 'online', last_sync = ? WHERE id = ?",
        [new Date().toISOString(), device.id]
      );
      return { success: true, message: 'تم الاتصال' };
    }

    return { success: false, message: 'فشل الاتصال' };
  } catch (error) {
    localRunQuery(
      "UPDATE devices SET status = 'offline' WHERE id = ?",
      [device.id]
    );
    return { success: false, message: error.message };
  }
}

async function getAttendanceFromDevice(device) {
  try {
    const response = await fetch(`http://${device.ip_address}:${device.port}/api/attendance`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data: data.logs || [] };
    }

    return { success: false, data: [] };
  } catch (error) {
    return { success: false, data: [], error: error.message };
  }
}

async function syncAllDevices() {
  const devices = localGetQuery("SELECT * FROM devices WHERE status = 'online'");
  let totalSynced = 0;

  for (const device of devices) {
    const result = await getAttendanceFromDevice(device);
    if (result.success) {
      for (const log of result.data) {
        const student = localGetQuery(
          "SELECT id FROM students WHERE fingerprint_data = ?",
          [log.fingerprint_id]
        );

        if (student && student.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const exists = localGetQuery(
            "SELECT id FROM attendance WHERE student_id = ? AND date = ?",
            [student[0].id, today]
          );

          if (!exists || exists.length === 0) {
            localRunQuery(
              "INSERT INTO attendance (student_id, date, time_in, status, method) VALUES (?, ?, ?, 'present', 'fingerprint')",
              [student[0].id, today, log.time]
            );
            totalSynced++;
          }
        }
      }
    }
  }

  return { success: true, synced: totalSynced };
}

async function registerFingerprint(studentId, fingerprintData) {
  localRunQuery(
    "UPDATE students SET fingerprint_data = ? WHERE id = ?",
    [fingerprintData, studentId]
  );
  return { success: true, message: 'تم تسجيل البصمة بنجاح في قاعدة البيانات' };
}

// =========================================================================
// 🛠️ جسر الربط والـ IPC Handlers (تمت إزالة التكرارات وحمايتها)
// =========================================================================

// التحقق من عدم تسجيل المستمع مسبقاً لتجنب مشاكل إعادة التشغيل في بيئة التطوير
if (!ipcMain.listenerCount('enrollFinger')) {
  ipcMain.handle('enrollFinger', async (event, studentId, fingerprintData) => {
    try {
      const result = await registerFingerprint(studentId, fingerprintData);
      return result;
    } catch (error) {
      console.error("خطأ أثناء تسجيل البصمة عبر الـ IPC:", error);
      return { success: false, error: error.message };
    }
  });
}

// تصدير الدوال بشكل رسمي يتناسب مع نظام Node.js
module.exports = {
  connectDevice,
  getAttendanceFromDevice,
  syncAllDevices,
  registerFingerprint
};
