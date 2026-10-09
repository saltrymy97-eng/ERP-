// src/services/db.js – الإصدار 3.3.0
// مع دعم Transaction الذرّي للاستيراد
let getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase, getSystemStatsForAI, runBulkImport, runBulkAbsence;

getQuery = async (sql, params = []) => {
  return await window.electronAPI.getQuery(sql, params);
};

runQuery = async (sql, params = []) => {
  return await window.electronAPI.runQuery(sql, params);
};

initDatabase = async () => {
  console.log('✅ SQLite متوافقة ومربوطة بجسم النظام بنجاح');
  return true;
};

closeDatabase = () => {};

// 🚀 استيراد جماعي ذرّي (Transaction)
runBulkImport = async (target, records) => {
  return await window.electronAPI.runBulkImport(target, records);
};

// 🚀 تسجيل غائبين جماعي (Transaction)
runBulkAbsence = async (target, dates) => {
  return await window.electronAPI.runBulkAbsence(target, dates);
};

// 📥 تصدير آمن
exportDatabase = async () => {
  try {
    const result = await window.electronAPI.exportDB();
    if (result && result.success) {
      return true;
    } else if (result && result.canceled) {
      return false;
    } else {
      throw new Error(result?.error || 'فشلت عملية التصدير.');
    }
  } catch (e) {
    console.error("❌ فشل التصدير:", e);
    throw e;
  }
};

// 📤 استيراد آمن
importDatabase = async (fileOrPath) => {
  try {
    const filePath = typeof fileOrPath === 'string' ? fileOrPath : fileOrPath?.path;
    const result = await window.electronAPI.importDB(filePath);

    if (result && result.success) {
      return result;
    } else if (result && result.canceled) {
      return false;
    } else {
      throw new Error(result?.error || "فشلت عملية الترميم.");
    }
  } catch (err) {
    console.error("❌ فشل الاستعادة:", err);
    throw err;
  }
};

// 🧠 الدالة السيادية الكبرى للـ AI
getSystemStatsForAI = async () => {
  try {
    const localDate = new Date();
    const offset = localDate.getTimezoneOffset();
    const adjustedDate = new Date(localDate.getTime() - (offset * 60 * 1000));
    const todayStr = adjustedDate.toISOString().split('T')[0];

    const resStudentsCount = await getQuery("SELECT COUNT(*) as count FROM students;");
    const totalStudents = resStudentsCount[0]?.count || 0;

    const resTeachersCount = await getQuery("SELECT COUNT(*) as count FROM teachers WHERE status = 'active';");
    const totalTeachers = resTeachersCount[0]?.count || 0;

    const studentsList = await getQuery("SELECT id, university_id, full_name, level, group_name FROM students;");
    const attendanceRecords = await getQuery("SELECT student_id, status, date, time_in FROM attendance ORDER BY id DESC LIMIT 200;");

    const attendanceMap = {};
    if (attendanceRecords && attendanceRecords.length > 0) {
      attendanceRecords.forEach(record => {
        if (record.student_id && !attendanceMap[record.student_id]) {
          attendanceMap[record.student_id] = {
            status: record.status,
            date: record.date,
            time: record.time_in || ''
          };
        }
      });
    }

    let studentsDetailsText = "لا يوجد طلاب مسجلين حالياً.";
    if (studentsList && studentsList.length > 0) {
      studentsDetailsText = studentsList
        .map((row, idx) => {
          const studentAttendance = attendanceMap[row.id];
          let formattedStatus = "⏳ لم ترصد له أي عملية حضور أو غياب بعد.";

          if (studentAttendance) {
            const rawStatus = studentAttendance.status;
            const statusText = rawStatus === 'present' ? 'حاضر ✅' : rawStatus === 'absent' ? 'غائب ❌' : rawStatus;
            const timeInfo = studentAttendance.time ? ` الساعة ${studentAttendance.time}` : '';
            formattedStatus = `${statusText} (بتاريخ: ${studentAttendance.date}${timeInfo})`;
          }

          return `${idx + 1}. الاسم: ${row.full_name} | الرقم الجامعي: ${row.university_id} | المستوى: ${row.level} | المجموعة: ${row.group_name} | الحالة: ${formattedStatus}`;
        })
        .join("\n");
    }

    const teachersList = await getQuery("SELECT id, teacher_id, full_name, speciality, status FROM teachers WHERE status = 'active';");
    const teacherAttendanceRecords = await getQuery(`
      SELECT ta.*, t.full_name 
      FROM teacher_attendance ta 
      INNER JOIN teachers t ON ta.teacher_id = t.id 
      ORDER BY ta.date DESC, ta.time_in DESC LIMIT 100
    `);

    const teacherAttendanceMap = {};
    if (teacherAttendanceRecords && teacherAttendanceRecords.length > 0) {
      teacherAttendanceRecords.forEach(rec => {
        if (rec.teacher_id && !teacherAttendanceMap[rec.teacher_id]) {
          teacherAttendanceMap[rec.teacher_id] = {
            status: rec.status,
            date: rec.date,
            time_in: rec.time_in || '—',
            time_out: rec.time_out || '—',
            lesson_title: rec.lesson_title || '—',
            completion_rate: rec.completion_rate || 0,
            total_hours: rec.total_hours || 0
          };
        }
      });
    }

    let teachersDetailsText = "لا يوجد دكاترة أو معلمين مسجلين حالياً.";
    if (teachersList && teachersList.length > 0) {
      teachersDetailsText = teachersList
        .map((row, idx) => {
          const tAtt = teacherAttendanceMap[row.id];
          let attStatusText = "⏳ لم يتم تسجيل حضور/انصراف له اليوم.";

          if (tAtt) {
            const state = tAtt.status === 'present' ? 'حاضر ✅' : 'غائب ❌';
            attStatusText = `${state} بتاريخ ${tAtt.date} (دخول: ${tAtt.time_in} | خروج: ${tAtt.time_out}) | الدرس: "${tAtt.lesson_title}" | الإنجاز: ${tAtt.completion_rate}% | الساعات المنجزة: ${tAtt.total_hours} ساعة`;
          }

          return `${idx + 1}. المحاضر: ${row.full_name} | التخصص: ${row.speciality} | آخر حالة حضور: ${attStatusText}`;
        })
        .join("\n");
    }

    const megaContextReport = `
--- سجلات ومعطيات منظومة SQLITE السيادية الحية ---
[تاريخ الاستعلام الحالي من جهاز الإدارة]: ${todayStr}
[الأرقام الإجمالية المقيدة]:
* إجمالي الطلاب المقيدين: ${totalStudents} طالب مسجل.
* إجمالي الكادر التدريسي الفعال: ${totalTeachers} محاضر مسجل.

[كشف الطلاب التفصيلي وبيانات الحضور]:
${studentsDetailsText}

[سجل كادر هيئة التدريس التفصيلي]:
${teachersDetailsText}
--------------------------------------------------
    `;

    return megaContextReport;
  } catch (error) {
    console.error("❌ فشل الاستعلام للـ AI:", error);
    return "تنبيه: فشل استخراج كشوفات الـ SQLite الحية.";
  }
};

export { getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase, getSystemStatsForAI, runBulkImport, runBulkAbsence };
