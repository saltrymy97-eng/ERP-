// src/services/db.js – الإصدار المتوافق كلياً مع الجداول الـ 14 لمنظومة Electron + دعم حضور الأكاديميين لـ AI
let getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase, getSystemStatsForAI;

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

exportDatabase = async () => {
  try {
    const data = await window.electronAPI.exportDB();
    if (!data) throw new Error('لم يتم إرجاع بيانات');
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) { console.error(e); }
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
          resolve(result);
        } catch (err) { reject(err); }
      };
    });
  } catch (e) { return false; }
};

// الدالة السيادية الكبرى بعد مطابقتها مع جداول الحضور الأكاديمي والطلاب
getSystemStatsForAI = async () => {
  try {
    const localDate = new Date();
    const offset = localDate.getTimezoneOffset();
    const adjustedDate = new Date(localDate.getTime() - (offset * 60 * 1000));
    const todayStr = adjustedDate.toISOString().split('T')[0];

    // 1. جلب الأعداد الإجمالية من الجداول الحية
    const resStudentsCount = await getQuery("SELECT COUNT(*) as count FROM students;");
    const totalStudents = resStudentsCount[0]?.count || 0;

    const resTeachersCount = await getQuery("SELECT COUNT(*) as count FROM teachers WHERE status = 'active';");
    const totalTeachers = resTeachersCount[0]?.count || 0;

    // 2. جلب كشف الطلاب بالأسماء الحقيقية للمطابقة
    const studentsList = await getQuery("SELECT id, university_id, full_name, level, group_name FROM students;");
    
    // 3. جلب سجلات حضور الطلاب الأخيرة
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

    let studentsDetailsText = "لا يوجد طلاب مسجلين في الكشوفات حالياً.";
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

    // 4. جلب قائمة كادر هيئة التدريس وسجلات حضورهم الأخيرة متضمنة متطلبات الأستاذ سعيد
    const teachersList = await getQuery("SELECT id, teacher_id, full_name, speciality, status FROM teachers WHERE status = 'active';");
    
    // جلب آخر عمليات حضور للمعلمين متضمنة الدرس ونسبة الإنجاز وإجمالي الساعات
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
* إجمالي الطلاب المقيدين في جداول النظام: ${totalStudents} طالب مسجل.
* إجمالي الكادر التدريسي الفعال المقيد: ${totalTeachers} محاضر مسجل.

[كشف الطلاب التفصيلي والبيانات المكتشفة في جداول الحضور]:
${studentsDetailsText}

[سجل كادر هيئة التدريس التفصيلي وحالة الحضور والدروس ونسب الإنجاز (طلب الأستاذ سعيد)]:
${teachersDetailsText}
--------------------------------------------------
    `;
    
    return megaContextReport;
  } catch (error) {
    console.error("❌ فشل الاستعلام لصالح الـ AI:", error);
    return "تنبيه: فشل استخراج كشوفات وجداول الـ SQLite الحية.";
  }
};

export { getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase, getSystemStatsForAI };
