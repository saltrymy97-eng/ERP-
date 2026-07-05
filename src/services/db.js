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

/**
 * 👑 دالة الاستعلام الأساسية الحاكمة والمصّدورة (المفقودة التي تسببت في خطأ البورشيل)
 * مخصصة لتحويل نتائج sql.js إلى مصفوفة كائنات (Key-Value Objects) لخدمة شاشات النظام
 */
export const getQuery = async (sql, params = []) => {
  if (!db) {
    console.warn("⚠️ قاعدة البيانات غير مهيأة بعد.");
    return [];
  }
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (error) {
    console.error(`❌ خطأ أثناء تنفيذ الاستعلام [ ${sql} ] في SQLite:`, error);
    throw error;
  }
};

// =========================================================
// 🌟 الدالة الإمبراطورية المطورة لجلب كافة التفاصيل بدقة للذكاء الاصطناعي 🌟
// =========================================================
export const getSystemStatsForAI = async () => {
  if (!db) {
    return "تنبيه: قاعدة البيانات غير متصلة حالياً.";
  }

  try {
    // 1. جلب إجمالي الأعداد العامة للسيطرة
    const resStudentsCount = db.exec("SELECT COUNT(*) as count FROM students;");
    const totalStudents = resStudentsCount[0]?.values[0]?.[0] || 0;

    const resTeachersCount = db.exec("SELECT COUNT(*) as count FROM teachers;");
    const totalTeachers = resTeachersCount[0]?.values[0]?.[0] || 0;

    // 2. جلب كشف تفصيلي وشامل بأسماء كافة الطلاب وحالة حضورهم اليوم عبر LEFT JOIN
    const resFullKashf = db.exec(`
      SELECT 
        s.name, 
        s.academic_id, 
        s.college, 
        s.department, 
        s.level,
        COALESCE(a.status, 'لم يرصد (غائب)') as today_status
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date = date('now', 'localtime');
    `);

    let studentsDetailsText = "لا يوجد طلاب مسجلين في الكشوفات حالياً.";
    if (resFullKashf[0] && resFullKashf[0].values) {
      studentsDetailsText = resFullKashf[0].values
        .map((row, idx) => `${idx + 1}. الاسم: ${row[0]} | الرقم الأكاديمي: ${row[1]} | الكلية: ${row[2]} | القسم: ${row[3]} | المستوى: ${row[4]} | حالة اليوم: ${row[5] === 'present' ? 'حاضر ✅' : row[5] === 'absent' ? 'غائب ❌' : row[5]}`)
        .join("\n");
    }

    // 3. جلب قائمة كادر هيئة التدريس المسجلين
    const resTeachersList = db.exec("SELECT name, department, activity_status FROM teachers;");
    let teachersDetailsText = "لا يوجد دكاترة أو معلمين مسجلين حالياً.";
    if (resTeachersList[0] && resTeachersList[0].values) {
      teachersDetailsText = resTeachersList[0].values
        .map((row, idx) => `${idx + 1}. المحاضر: ${row[0]} | القسم: ${row[1]} | الحالة: ${row[2]}`)
        .join("\n");
    }

    // 4. صياغة بنية المعطيات السيادية الكاملة ليتغذى عليها نموذج Llama 3.3
    const megaContextReport = `
--- سجلات ومعطيات منظومة SQLITE السيادية الحية ---
[الأرقام الإجمالية]:
* إجمالي الطلاب المقيدين: ${totalStudents} طالب.
* إجمالي الكادر التدريسي: ${totalTeachers} محاضر.

[كشف الطلاب التفصيلي وحالة حضورهم اليوم]:
${studentsDetailsText}

[سجل كادر هيئة التدريس]:
${teachersDetailsText}
--------------------------------------------------
    `;
    
    return megaContextReport;
  } catch (error) {
    console.error("❌ فشل الاستعلام الشامل من الـ SQLite لصالح الـ AI:", error);
    return "تنبيه: فشل استخراج كشوفات وجداول الـ SQLite بسبب عارض تقني في استعلامات الربط.";
  }
};
