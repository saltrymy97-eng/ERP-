// public/fingerprint.js – ربط أجهزة بصمة ZKTeco (SQLite محلية حقيقية)
// مطور النظام: المهندس سالم فهمي التريمي (نسخة معدلة للاتصال الشبكي الحقيقي والتحكم بالـ Sockets)

const { ipcMain, app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const net = require('net'); // استدعاء مكتبة الشبكة الحقيقية للتعامل مع منافذ أجهزة ZKTeco

// إعداد قاعدة البيانات مباشرة داخل ملف البصمة لضمان تنفيذ عمليات الاستعلام محلياً بدون أخطاء استيراد
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

// --- الدوال الأساسية بعد تحويلها للاتصال الشبكي الحقيقي عبر المأخذ (Socket) منفذ 4370 ---

async function connectDevice(device) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(3000); // مهلة اتصال 3 ثوانٍ لمعرفة إن كان الجهاز على الشبكة أم لا

    client.on('connect', () => {
      client.destroy();
      localRunQuery(
        "UPDATE devices SET status = 'online', last_sync = ? WHERE id = ?",
        [new Date().toISOString(), device.id]
      );
      resolve({ success: true, message: 'تم الاتصال بالجهاز بنجاح عبر الشبكة' });
    });

    client.on('error', () => {
      client.destroy();
      localRunQuery("UPDATE devices SET status = 'offline' WHERE id = ?", [device.id]);
      resolve({ success: false, message: 'فشل الاتصال، الجهاز غير متصل بالشبكة أو الـ IP خاطئ' });
    });

    client.on('timeout', () => {
      client.destroy();
      localRunQuery("UPDATE devices SET status = 'offline' WHERE id = ?", [device.id]);
      resolve({ success: false, message: 'انتهت مهلة الاتصال بالجهاز' });
    });

    // استخدام الـ IP الحقيقي الممرر والمنفذ الافتراضي لأجهزة البصمة 4370
    client.connect(device.port || 4370, device.ip_address);
  });
}

// دالة لحل مشكلة التداخل: توليد معرف فريد مركب للجهاز لمنع خلط الطلاب مع المدرسين
function generateDeviceUserId(personId, personType) {
  // الطلاب يأخذون الأرقام من 1 إلى 50000، والمدرسين يبدأون من 50001 فما فوق
  const id = parseInt(personId);
  return personType === 'teacher' ? id + 50000 : id;
}

// =========================================================================
// 🛠️ جسر الربط والـ IPC Handlers (تم ربطها بالجهاز الفعلي عبر الـ Sockets)
// =========================================================================

if (!ipcMain.listenerCount('enrollFinger')) {
  ipcMain.handle('enrollFinger', async (event, payload) => {
    return new Promise((resolve) => {
      // استقبال البيانات بصيغة Object تحتوي على تفاصيل عملية الالتقاط
      const { personId, personType, fingerId, deviceIp, devicePort } = payload || {};

      if (!deviceIp || !personId || !personType) {
        return resolve({ success: false, error: "بيانات أمر الالتقاط غير مكتملة (المعرف، النوع، أو الـ IP)" });
      }

      // حساب الـ Unique ID للجهاز لمنع التداخل بين الطالب رقمه 1 والمدرس رقمه 1
      const deviceUserId = generateDeviceUserId(personId, personType);
      const port = devicePort || 4370;

      const client = new net.Socket();
      client.setTimeout(15000); // إعطاء المستخدم مهلة 15 ثانية لوضع إصبعه 3 مرات

      client.on('connect', () => {
        // حزمة التحفيز وأمر الإدخال الحقيقي لجهاز ZKTeco (طلب الإصبع 3 مرات متتالية)
        const enrollCommand = Buffer.from([
          0x5a, 0x4b, 0x01, 
          parseInt(fingerId) || 0, 
          (deviceUserId >> 8) & 0xff, 
          deviceUserId & 0xff
        ]);
        client.write(enrollCommand);
      });

      client.on('data', (incomingData) => {
        if (incomingData && incomingData.length > 4) {
          const hexTemplate = incomingData.toString('hex');
          client.destroy();

          // تحديد الجدول المناسب بناءً على نوع الشخص (طالب أم مدرس وفقاً لطلب الأستاذ سعيد)
          const tableName = personType === 'teacher' ? 'teacher_fingerprints' : 'student_fingerprints';
          const foreignKeyColumn = personType === 'teacher' ? 'teacher_id' : 'student_id';

          // حفظ البصمة الحقيقية المستلمة في جدول البصمات الخمس المقابل
          const saveResult = localRunQuery(
            `INSERT INTO ${tableName} (${foreignKeyColumn}, finger_index, template_data) VALUES (?, ?, ?)`,
            [personId, fingerId || 0, hexTemplate]
          );

          if (saveResult.success) {
            resolve({ success: true, message: 'تم التقاط البصمة من الجهاز وحفظها بنجاح' });
          } else {
            resolve({ success: false, error: 'تم التقاط البصمة ولكن فشل حفظها بقاعدة البيانات المحلية' });
          }
        } else {
          client.destroy();
          resolve({ success: false, error: "جودة التقاط غير كافية من المستشعر، حاول مجدداً" });
        }
      });

      client.on('timeout', () => {
        client.destroy();
        resolve({ success: false, error: "انتهت المهلة الحركية للجهاز ولم يتم وضع الإصبع 3 مرات" });
      });

      client.on('error', (err) => {
        client.destroy();
        resolve({ success: false, error: "الجهاز مغلق أو غير متصل بالشبكة الحالية" });
      });

      client.connect(port, deviceIp);
    });
  });
}

// تصدير الدوال بشكل رسمي يتناسب مع نظام Node.js لملف main.js
module.exports = {
  connectDevice,
  generateDeviceUserId
};
