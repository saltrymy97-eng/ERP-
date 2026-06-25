// src/services/whatsapp.js – إشعارات واتساب (SQLite محلية + مراحل الغياب المتدرج)
import { getQuery, runQuery } from './db';

let whatsappConfig = null;

function loadConfig() {
  if (!whatsappConfig) {
    const saved = localStorage.getItem('whatsapp_config');
    whatsappConfig = saved ? JSON.parse(saved) : { enabled: false };
  }
  return whatsappConfig;
}

export async function sendWhatsApp(to, message) {
  const config = loadConfig();
  
  if (!config.enabled || !config.api_key || !config.phone_number_id) {
    console.log('واتساب غير مفعل');
    return { success: false, error: 'غير مفعل' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message }
        })
      }
    );

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function notifyParent(studentId, type, extra = {}) {
  const student = await getQuery("SELECT * FROM students WHERE id = ?", [studentId]);

  if (!student || student.length === 0 || !student[0].parent_phone) {
    return { success: false, error: 'لا يوجد رقم ولي أمر' };
  }

  const s = student[0];
  let message = '';

  switch (type) {
    case 'entry':
      message = `السلام عليكم\nنحيطكم علماً بأن:\nالطالب: ${s.full_name}\nسجل دخوله إلى المركز الساعة ${extra.time || '—'}.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'lecture':
      message = `السلام عليكم\nابنكم ${s.full_name}\nدخل محاضرة: ${extra.subject || '—'}\nالوقت: ${extra.time || '—'}\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'absent':
      message = `السلام عليكم\nنود إبلاغكم بأن الطالب:\n${s.full_name}\nتغيب عن محاضرة اليوم.\nيرجى المتابعة.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'exit':
      message = `السلام عليكم\nتم تسجيل خروج الطالب:\n${s.full_name}\nالساعة: ${extra.time || '—'}\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'warning':
      message = `⚠️ تنبيه هام\nالطالب: ${s.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nيرجى المتابعة العاجلة.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    // ========== مراحل الغياب المتدرج ==========
    case 'stage_10':
      message = `🟢 تنبيه أول\nالطالب: ${s.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nتجاوز نسبة 10% غياب.\nيرجى المتابعة.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'stage_20':
      message = `🟡 تنبيه ثانٍ\nالطالب: ${s.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nتجاوز نسبة 20% غياب.\nيجب الحضور لمقابلة المرشد الأكاديمي.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'stage_25':
      message = `🔴 إنذار أكاديمي نهائي\nالطالب: ${s.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nتجاوز نسبة 25% غياب.\nتم إصدار إنذار أكاديمي رسمي.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'stage_30':
      message = `🚨 حرمان من الاختبار\nالطالب: ${s.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nتجاوز نسبة 30% غياب.\nتم الحرمان من الاختبارات النهائية.\nيرجى مراجعة العمادة فوراً.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    default:
      message = `السلام عليكم\nالطالب: ${s.full_name}\n${extra.text || ''}\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
  }

  const result = await sendWhatsApp(s.parent_phone, message);

  await runQuery(
    "INSERT INTO notifications (student_id, parent_phone, message, type, status, sent_at) VALUES (?, ?, ?, ?, ?, ?)",
    [studentId, s.parent_phone, message, type, result.success ? 'sent' : 'failed', new Date().toISOString()]
  );

  return result;
}

export async function notifyAllAbsent() {
  const today = new Date().toISOString().slice(0, 10);

  const absentStudents = await getQuery(
    `SELECT DISTINCT s.id, s.full_name, s.parent_phone
     FROM students s
     WHERE s.status = 'active' 
     AND s.id NOT IN (
       SELECT DISTINCT a.student_id 
       FROM attendance a 
       WHERE a.date = ? AND (a.status = 'present' OR a.status = 'late')
     )`,
    [today]
  );

  let sent = 0;
  for (const student of absentStudents) {
    const result = await notifyParent(student.id, 'absent');
    if (result.success) sent++;
  }

  return { total: absentStudents.length, sent };
}

// ========== إرسال تنبيهات مراحل الغياب تلقائياً ==========
export async function notifyAbsenceStages() {
  const config = loadConfig();
  if (!config.enabled) return { success: false, error: 'الواتساب غير مفعل' };

  const attendance = await getQuery(
    "SELECT a.student_id, a.status, s.full_name, s.parent_phone FROM attendance a INNER JOIN students s ON a.student_id = s.id WHERE s.status = 'active' AND s.parent_phone != ''"
  );

  if (!attendance || attendance.length === 0) return { success: false, error: 'لا توجد بيانات' };

  // تجميع حسب الطالب
  const studentMap = {};
  attendance.forEach(a => {
    const sid = a.student_id;
    if (!studentMap[sid]) studentMap[sid] = { full_name: a.full_name, parent_phone: a.parent_phone, total: 0, absent: 0, lastStage: null };
    studentMap[sid].total++;
    if (a.status === 'absent') studentMap[sid].absent++;
  });

  let sent = 0;
  const notifications = [];

  for (const [sid, s] of Object.entries(studentMap)) {
    const rate = s.total > 0 ? Math.round((s.absent / s.total) * 100 * 10) / 10 : 0;
    let stageType = null;

    if (rate >= 30) stageType = 'stage_30';
    else if (rate >= 25) stageType = 'stage_25';
    else if (rate >= 20) stageType = 'stage_20';
    else if (rate >= 10) stageType = 'stage_10';

    if (stageType) {
      // التحقق من عدم إرسال نفس المرحلة مسبقاً
      const alreadySent = await getQuery(
        "SELECT id FROM notifications WHERE student_id = ? AND type = ? ORDER BY sent_at DESC LIMIT 1",
        [sid, stageType]
      );

      // إرسال إذا لم ترسل من قبل أو مر 7 أيام على آخر إرسال
      if (!alreadySent || alreadySent.length === 0) {
        const result = await notifyParent(parseInt(sid), stageType, { rate });
        if (result.success) {
          sent++;
          notifications.push({ student: s.full_name, stage: stageType, rate });
        }
      }
    }
  }

  return { success: true, sent, notifications };
}

// ========== إرسال تنبيه لجميع الغائبين عن محاضرة ==========
export async function notifyAbsentFromLecture(scheduleId) {
  const schedule = await getQuery("SELECT * FROM schedules WHERE id = ?", [scheduleId]);
  if (!schedule || schedule.length === 0) return { success: false, error: 'المحاضرة غير موجودة' };

  const today = new Date().toISOString().slice(0, 10);
  const absentStudents = await getQuery(
    `SELECT DISTINCT s.id, s.full_name, s.parent_phone
     FROM students s
     WHERE s.status = 'active' AND s.parent_phone != ''
     AND s.id NOT IN (
       SELECT DISTINCT a.student_id FROM attendance a WHERE a.date = ?
     )`,
    [today]
  );

  let sent = 0;
  for (const student of absentStudents) {
    const result = await notifyParent(student.id, 'lecture', { subject: schedule[0].subject, time: schedule[0].time_from });
    if (result.success) sent++;
  }

  return { total: absentStudents.length, sent };
}
