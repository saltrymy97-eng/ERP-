// src/services/db.js – محرك إدارة قاعدة البيانات السيادية للمنظومة البيومترية
// مطور النظام: المهندس سالم فهمي التريمي
import initSqlJs from 'sql.js';

let db = null;

// دالة تهيئة قاعدة بيانات SQLite محلياً
export const initDatabase = async () => {
  if (db) return db;
  try {
    const SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });
    
    // محاولة استعادة قاعدة البيانات المخزنة في الجهاز أو إنشاء واحدة جديدة
    const savedDb = localStorage.getItem('biometric_attendance_db');
    if (savedDb) {
      const u8arr = new Uint8Array(JSON.parse(savedDb));
      db = new SQL.Database(u8arr);
      console.log("🏛️ تم تحميل قاعدة بيانات SQLite السيادية بنجاح.");
    } else {
      db = new SQL.Database();
      createTables();
      saveDatabase();
      console.log("✨ تم إنشاء قاعدة بيانات SQLite جديدة وتأسيس الجداول.");
    }
    return db;
  } catch (error) {
    console.error("❌ فشل في تهيئة قاعدة بيانات SQLite:", error);
    throw error;
  }
};

// إنشاء الجداول الأساسية للنظام الإمبراطوري
const createTables = () => {
  if (!db) return;
  
  // جدول الطلاب
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      academic_id TEXT UNIQUE NOT NULL,
      college TEXT,
      department TEXT,
      level TEXT,
      biometric_template TEXT
    );
  `);

  // جدول الحضور والغياب
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      date TEXT NOT NULL,
      time TEXT,
      status TEXT NOT NULL,
      FOREIGN KEY(student_id) REFERENCES students(id)
    );
  `);

  // جدول كادر هيئة التدريس
  db.run(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department TEXT,
      activity_status TEXT
    );
  `);
};

// دالة حفظ التغييرات محلياً في المتصفح/إلكترون
export const saveDatabase = () => {
  if (!db) return;
  const data = db.export();
  const array = Array.from(data);
  localStorage.setItem('biometric_attendance_db', JSON.stringify(array));
};

// =========================================================
// 🌟 الدالة الإمبراطورية المضافة لخدمة المستشار الذكي 🌟
// =========================================================
export const getSystemStatsForAI = async () => {
  if (!db) {
    return "تنبيه: قاعدة البيانات غير متصلة حالياً.";
  }

  try {
    // 1. جلب إجمالي الطلاب
    const resStudents = db.exec("SELECT COUNT(*) as count FROM students;");
    const totalStudents = resStudents[0]?.values[0]?.[0] || 0;

    // 2. جلب إجمالي الكادر التعليمي
    const resTeachers = db.exec("SELECT COUNT(*) as count FROM teachers;");
    const totalTeachers = resTeachers[0]?.values[0]?.[0] || 0;

    // 3. جلب إحصائيات حضور اليوم (حاضر / غائب)
    const resAttendance = db.exec(`
      SELECT status, COUNT(*) as count 
      FROM attendance 
      WHERE date = date('now', 'localtime') 
      GROUP BY status;
    `);

    let attendanceSummary = "لم يتم رصد عمليات حضور أو غياب لليوم حتى الآن.";
    if (resAttendance[0] && resAttendance[0].values) {
      attendanceSummary = resAttendance[0].values
        .map(row => `${row[0] === 'present' ? 'حاضر' : 'غائب'}: ${row[1]}`)
        .join(' | ');
    }

    // 4. بناء خلاصة نصية احترافية لتقديمها للموديل Llama
    const reportSummary = `
--- معطيات منظومة SQLite الحية الحالية ---
* إجمالي الطلاب المسجلين بالنظام: ${totalStudents} طالب.
* إجمالي أعضاء هيئة التدريس: ${totalTeachers} محاضر.
* حالة رصد الحضور والغياب ليومنا هذا: [ ${attendanceSummary} ].
---------------------------------------
    `;
    
    return reportSummary;
  } catch (error) {
    console.error("فشل الاستعلام من الـ SQLite لصالح الـ AI:", error);
    return "تنبيه: فشل استخراج جداول الإحصائيات الحية من الـ SQLite بسبب عارض تقني في الاستعلام.";
  }
};
