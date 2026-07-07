// src/services/db.js – SQLite حقيقية محلية احترافية (نسخة الديسكتوب النقية)
// الإصدار 5.0 – دعم كامل ومباشر لـ Electron فقط لضمان الاستقرار الحقيقي

let getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase, getSystemStatsForAI;

// ========== الاتصال المباشر بجسر الـ Electron ==========

getQuery = async (sql, params = []) => {
  return await window.electronAPI.getQuery(sql, params);
};

runQuery = async (sql, params = []) => {
  return await window.electronAPI.runQuery(sql, params);
};

initDatabase = async () => {
  console.log('✅ SQLite حقيقية جاهزة ومستقرة (Electron Desktop Only)');
  return true;
};

closeDatabase = () => {
  console.log('🔒 إشارة إغلاق قاعدة البيانات');
};

exportDatabase = async () => {
  try {
    const data = await window.electronAPI.exportDB();
    if (!data) throw new Error('لم يتم إرجاع بيانات من قاعدة البيانات');
    
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('📥 تم تصدير نسخة احتياطية بنجاح');
  } catch (e) {
    console.error('❌ فشل تصدير قاعدة البيانات:', e);
  }
};

importDatabase = async (file) => {
  try {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const base64Data = reader.result.split(',')[1];
          const result = await window.electronAPI.importDB(base64Data);
          console.log('✅ تم استيراد قاعدة البيانات بنجاح');
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
    });
  } catch (e) {
    console.error('❌ فشل استيراد قاعدة البيانات:', e);
    return false;
  }
};

// =========================================================
// 🔮 الدالة المطورة لجلب كافة التفاصيل بدقة للذكاء الاصطناعي عبر الجسر الأصلي 🔮
// =========================================================
getSystemStatsForAI = async () => {
  try {
    // تنسيق التاريخ الافتراضي للنظام بصيغة YYYY-MM-DD
    const today = new Date().toISOString().slice(0, 10);

    // 1. جلب إجمالي الأعداد العامة للسيطرة الإدارية
    const resStudentsCount = await getQuery("SELECT COUNT(*) as count FROM students;");
    const totalStudents = resStudentsCount[0]?.count || 0;

    const resTeachersCount = await getQuery("SELECT COUNT(*) as count FROM teachers;");
    const totalTeachers = resTeachersCount[0]?.count || 0;

    // 2. جلب كشف الطلاب الصافي مباشرة من جدول الطلاب لمنع الاختفاء بسب الـ JOIN
    const studentsList = await getQuery("SELECT id, name, academic_id, college, department, level FROM students;");
    
    // 3. جلب سجلات الحضور اليومية بشكل مرن ومستقل
    const attendanceToday = await getQuery("SELECT student_id, status FROM attendance WHERE date LIKE ?;", [`%${today}%`]);
    
    // رسم خريطة مطابقة (Map) في الذاكرة لربط الحالات بالطلاب
    const attendanceMap = {};
    if (attendanceToday && attendanceToday.length > 0) {
      attendanceToday.forEach(record => {
        if (record.student_id) {
          attendanceMap[record.student_id] = record.status;
        }
      });
    }

    let studentsDetailsText = "لا يوجد طلاب مسجلين في الكشوفات حالياً.";
    if (studentsList && studentsList.length > 0) {
      studentsDetailsText = studentsList
        .map((row, idx) => {
          // استخراج الحالة أو إعطاؤه القيمة الافتراضية إذا لم يتم رصد البصمة بعد اليوم
          const rawStatus = attendanceMap[row.id] || 'لم يرصد (غائب)';
          const formattedStatus = rawStatus === 'present' ? 'حاضر ✅' : rawStatus === 'absent' ? 'غائب ❌' : rawStatus;
          
          return `${idx + 1}. الاسم: ${row.name} | الرقم الأكاديمي: ${row.academic_id} | الكلية: ${row.college} | القسم: ${row.department} | المستوى: ${row.level} | حالة اليوم: ${formattedStatus}`;
        })
        .join("\n");
    }

    // 4. جلب قائمة كادر هيئة التدريس المسجلين بنقاوة كاملة
    const teachersList = await getQuery("SELECT name, department, activity_status FROM teachers;");
    let teachersDetailsText = "لا يوجد دكاترة أو معلمين مسجلين حالياً.";
    if (teachersList && teachersList.length > 0) {
      teachersDetailsText = teachersList
        .map((row, idx) => `${idx + 1}. المحاضر: ${row.name} | القسم: ${row.department} | الحالة: ${row.activity_status}`)
        .join("\n");
    }

    // 5. صياغة بنية المعطيات السيادية الكاملة ليتغذى عليها نموذج الذكاء الاصطناعي
    const megaContextReport = `
--- سجلات ومعطيات منظومة SQLITE السيادية الحية ---
[تاريخ الكشف الحي]: ${today}
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
    return "تنبيه: فشل استخراج كشوفات وجداول الـ SQLite الحية بسبب عارض تقني في استعلامات الربط.";
  }
};

export { 
  getQuery, 
  runQuery, 
  initDatabase, 
  closeDatabase, 
  exportDatabase, 
  importDatabase,
  getSystemStatsForAI
};
