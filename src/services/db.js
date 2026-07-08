// src/services/db.js – SQLite حقيقية محلية احترافية (نسخة الديسكتوب النقية)
// الإصدار 5.1 المطور – حل مشكلة قيد التاريخ ودعم الربط الذكي الشامل مع المستشار

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
// 🔮 الدالة المحصنة والمعدلة جذرياً لمنع فقدان الحضور وإيقاف الهلوسة 🔮
// =========================================================
getSystemStatsForAI = async () => {
  try {
    // استخراج التاريخ المحلي الصحيح لجهاز الكمبيوتر لتفادي فارق توقيت UTC
    const localDate = new Date();
    const offset = localDate.getTimezoneOffset();
    const adjustedDate = new Date(localDate.getTime() - (offset * 60 * 1000));
    const todayStr = adjustedDate.toISOString().split('T')[0];

    // 1. جلب إجمالي الأعداد العامة للسيطرة الإدارية العليا
    const resStudentsCount = await getQuery("SELECT COUNT(*) as count FROM students;");
    const totalStudents = resStudentsCount[0]?.count || 0;

    const resTeachersCount = await getQuery("SELECT COUNT(*) as count FROM teachers;");
    const totalTeachers = resTeachersCount[0]?.count || 0;

    // 2. جلب كشف الطلاب الصافي مباشرة من جدول الطلاب لمنع الاختفاء
    const studentsList = await getQuery("SELECT id, name, academic_id, college, department, level FROM students;");
    
    // 3. الحل الحاسم: جلب سجلات الحضور الأخيرة بنمط مرن وشامل (ترتيب تنازلي لضمان قراءة البيانات المضافة حديثاً)
    const attendanceRecords = await getQuery("SELECT student_id, status, date, time FROM attendance ORDER BY id DESC LIMIT 200;");
    
    // رسم خريطة مطابقة (Map) ذكية مبنية على أحدث العمليات المسجلة للطلاب في قاعدة البيانات
    const attendanceMap = {};
    if (attendanceRecords && attendanceRecords.length > 0) {
      attendanceRecords.forEach(record => {
        if (record.student_id && !attendanceMap[record.student_id]) {
          attendanceMap[record.student_id] = {
            status: record.status,
            date: record.date || todayStr,
            time: record.time || ''
          };
        }
      });
    }

    let studentsDetailsText = "لا يوجد طلاب مسجلين في الكشوفات حالياً.";
    if (studentsList && studentsList.length > 0) {
      studentsDetailsText = studentsList
        .map((row, idx) => {
          const studentAttendance = attendanceMap[row.id];
          let formattedStatus = "⏳ لم ترصد له أي عملية حضور أو غياب بعد في هذه الجلسة.";
          
          if (studentAttendance) {
            const rawStatus = studentAttendance.status;
            const statusText = rawStatus === 'present' ? 'حاضر ✅' : rawStatus === 'absent' ? 'غائب ❌' : rawStatus;
            const timeInfo = studentAttendance.time ? ` الساعة ${studentAttendance.time}` : '';
            formattedStatus = `${statusText} (تم الرصد بتاريخ: ${studentAttendance.date}${timeInfo})`;
          }
          
          return `${idx + 1}. الاسم: ${row.name} | الرقم الأكاديمي: ${row.academic_id} | الكلية: ${row.college} | القسم: ${row.department} | المستوى: ${row.level} | حالة السجل الحالية: ${formattedStatus}`;
        })
        .join("\n");
    }

    // 4. جلب قائمة كادر هيئة التدريس المسجلين بنقاوة كاملة
    const teachersList = await getQuery("SELECT name, department, activity_status FROM teachers;");
    let teachersDetailsText = "لا يوجد دكاترة أو معلمين مسجلين حالياً.";
    if (teachersList && teachersList.length > 0) {
      teachersDetailsText = teachersList
        .map((row, idx) => `${idx + 1}. المحاضر: ${row.name} | القسم: ${row.department} | الحالة العامة: ${row.activity_status}`)
        .join("\n");
    }

    // 5. صياغة بنية المعطيات السيادية الكاملة ليتغذى عليها نموذج الذكاء الاصطناعي
    const megaContextReport = `
--- سجلات ومعطيات منظومة SQLITE السيادية الحية ---
[تاريخ الاستعلام الحالي من جهاز الإدارة]: ${todayStr}
[الأرقام الإجمالية المقيدة]:
* إجمالي الطلاب المقيدين في جداول النظام: ${totalStudents} طالب مسجل.
* إجمالي الكادر التدريسي المقيد في جداول النظام: ${totalTeachers} محاضر مسجل.

[كشف الطلاب التفصيلي والبيانات المكتشفة في جداول الحضور]:
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
