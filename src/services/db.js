// src/services/db.js – الإصدار المتوافق كلياً مع الجداول الـ 14 لمنظومة Electron
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

// الدالة السيادية الكبرى بعد مطابقتها مع جداول main.js الحقيقية
getSystemStatsForAI = async () => {
  try {
    const localDate = new Date();
    const offset = localDate.getTimezoneOffset();
    const adjustedDate = new Date(localDate.getTime() - (offset * 60 * 1000));
    const todayStr = adjustedDate.toISOString().split('T')[0];

    // 1. جلب الأعداد الإجمالية
    const resStudentsCount = await getQuery("SELECT COUNT(*) as count FROM students;");
    const totalStudents = resStudentsCount[0]?.count || 0;

    const resTeachersCount = await getQuery("SELECT COUNT(*) as count FROM teachers;");
    const totalTeachers = resTeachersCount[0]?.count || 0;

    // 2. جلب كشف الطلاب بالأسماء الحقيقية للمطابقة (full_name & university_id)
    const studentsList = await getQuery("SELECT id, university_id, full_name, level, group_name FROM students;");
    
    // 3. جلب سجلات الحضور الأخيرة
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

    // 4. جلب قائمة كادر هيئة التدريس بالاسم الحقيقي (full_name)
    const teachersList = await getQuery("SELECT full_name, speciality, status FROM teachers;");
    let teachersDetailsText = "لا يوجد دكاترة أو معلمين مسجلين حالياً.";
    if (teachersList && teachersList.length > 0) {
      teachersDetailsText = teachersList
        .map((row, idx) => `${idx + 1}. المحاضر: ${row.full_name} | التخصص: ${row.speciality} | الحالة: ${row.status}`)
        .join("\n");
    }

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
    console.error("❌ فشل الاستعلام لصالح الـ AI:", error);
    return "تنبيه: فشل استخراج كشوفات وجداول الـ SQLite الحية.";
  }
};

export { getQuery, runQuery, initDatabase, closeDatabase, exportDatabase, importDatabase, getSystemStatsForAI };
