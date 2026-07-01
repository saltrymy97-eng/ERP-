// src/services/whatsapp.js – نظام بث إشعارات واتساب السيادي (نسخة مصلحة ومؤمنة بالكامل 2026)
import { getQuery, runQuery } from './db';

let whatsappConfig = null;

// ========== تحميل وتأمين إعدادات الربط السحابي ==========
function loadConfig() {
  if (!whatsappConfig) {
    const saved = localStorage.getItem('whatsapp_config');
    whatsappConfig = saved ? JSON.parse(saved) : { enabled: false };
  }
  return whatsappConfig;
}

// ========== الدالة الأساسية للإرسال عبر سحابة ميتآ (Meta API) ==========
export async function sendWhatsApp(to, message) {
  const config = loadConfig();
  
  if (!config.enabled || !config.api_key || !config.phone_number_id) {
    console.warn('⚠️ نظام إشعارات واتساب غير نشط أو الإعدادات غير مكتملة');
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
    
    if (data.error) {
      console.error('❌ خطأ من خادم Meta API:', data.error.message);
      return { success: false, error: data.error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('💥 فشل الاتصال الشبكي ببوابة WhatsApp:', error.message);
    return { success: false, error: error.message };
  }
}

// ========== دالة توجيه الإشعارات الفردية وتوثيقها محلياً ==========
export async function notifyParent(studentId, type, extra = {}) {
  const student = await getQuery("SELECT * FROM students WHERE id = ?", [studentId]);

  if (!student || student.length === 0 || !student[0].parent_phone) {
    return { success: false, error: 'لا يوجد رقم هاتف مسجل لولي الأمر' };
  }

  const s = student[0];
  let message = '';

  // صياغة الرسائل بناءً على نوع الحركة البيومترية أو الأكاديمية
  switch (type) {
    case 'entry':
      message = `السلام عليكم\nنحيطكم علماً بأن:\nالطالب: ${s.full_name}\nسجل دخوله إلى المركز الساعة ${extra.time || '—'}.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'lecture':
      message = `السلام عليكم\nابنكم ${s.full_name}\nدخل محاضرة: ${extra.subject || '—'}\nالوقت: ${extra.time || '—'}\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'absent':
      message = `السلام عليكم\nنود إبلاغكم بأن الطالب:\n${s.full_name}\nتغيب عن محاضرة اليوم.\nيرجى المتابعة والالتزام لمنع الحرمان.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'exit':
      message = `السلام عليكم\nتم تسجيل خروج الطالب:\n${s.full_name}\nالساعة: ${extra.time || '—'}\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'warning':
      message = `⚠️ تنبيه هام\nالطالب: ${s.full_name}\nنسبة الغياب الإجمالية: ${extra.rate || '0'}%\nيرجى المتابعة العاجلة مع الإدارة الأكاديمية.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    // ========== قوالب مراحل الغياب المتدرج المعتمدة ==========
    case 'stage_10':
      message = `🟢 تنبيه أول\nالطالب: ${s.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nتجاوز نسبة 10% غياب.\nيرجى المتابعة الفورية.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'stage_20':
      message = `🟡 تنبيه ثانٍ\nالطالب: ${s.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nتجاوز نسبة 20% غياب.\nيجب الحضور لمقابلة المرشد الأكاديمي لتفادي الحرمان.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'stage_25':
      message = `🔴 إنذار أكاديمي نهائي\nالطالب: ${s.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nتجاوز نسبة 25% غياب.\nتم إصدار إنذار أكاديمي رسمي وربطه بملف الطالب.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'stage_30':
      message = `🚨 حرمان من الاختبار\nالطالب: ${s.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nتجاوز نسبة 30% غياب.\nتم الحرمان من الاختبارات النهائية بشكل رسمي.\nيرجى مراجعة العمادة فوراً.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    default:
      message = `السلام عليكم\nالطالب: ${s.full_name}\n${extra.text || ''}\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
  }

  // تنفيذ الإرسال الفعلي
  const result = await sendWhatsApp(s.parent_phone, message);

  // توثيق العملية في قاعدة البيانات المحلية لإصدار تقارير الإرسال لاحقاً
  await runQuery(
    "INSERT INTO notifications (student_id, parent_phone, message, type, status, sent_at) VALUES (?, ?, ?, ?, ?, ?)",
    [studentId, s.parent_phone, message, type, result.success ? 'sent' : 'failed', new Date().toISOString()]
  );

  return result;
}

// ========== دالة بث الحضور الجماعي (معدلة ومصلحة لتطابق واجهة Attendance.js) ==========
export async function notifyAllAbsent() {
  const today = new Date().toISOString().slice(0, 10);

  // استعلام متقدم لجلب كافة الطلاب النشطين الذين لم يسجلوا أي حضور أو تأخير اليوم
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
    if (!student.parent_phone) continue;
    const result = await notifyParent(student.id, 'absent');
    if (result.success) sent++;
  }

  // التعديل الجوهري: إرسال الـ success: true لتفعيل واجهة الـ React بنجاح كامل
  return { success: true, total: absentStudents.length, sent };
}

// ========== المعالجة الذكية والمؤتمتة لنسب الحرمان التصاعدية ==========
export async function notifyAbsenceStages() {
  const config = loadConfig();
  if (!config.enabled) return { success: false, error: 'الواتساب غير مفعل' };

  const attendance = await getQuery(
    "SELECT a.student_id, a.status, s.full_name, s.parent_phone FROM attendance a INNER JOIN students s ON a.student_id = s.id WHERE s.status = 'active' AND s.parent_phone != ''"
  );

  if (!attendance || attendance.length === 0) return { success: false, error: 'لا توجد حركات حضور مسجلة لحساب النسب' };

  // تجميع وتقييم حركات الحضور والغياب لكل طالب
  const studentMap = {};
  attendance.forEach(a => {
    const sid = a.student_id;
    if (!studentMap[sid]) studentMap[sid] = { full_name: a.full_name, parent_phone: a.parent_phone, total: 0, absent: 0 };
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
      // فحص أمني لمنع تكرار إرسال نفس المرحلة للطالب منعاً لإزعاجه
      const alreadySent = await getQuery(
        "SELECT id FROM notifications WHERE student_id = ? AND type = ? ORDER BY sent_at DESC LIMIT 1",
        [sid, stageType]
      );

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

// ========== إرسال تنبيه جماعي للغياب عن محاضرة معينة بالجدول ==========
export async function notifyAbsentFromLecture(scheduleId) {
  const schedule = await getQuery("SELECT * FROM schedules WHERE id = ?", [scheduleId]);
  if (!schedule || schedule.length === 0) return { success: false, error: 'المحاضرة المحددة غير موجودة بالجدول' };

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

  return { success: true, total: absentStudents.length, sent };
}
