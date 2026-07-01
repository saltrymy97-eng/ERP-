// src/services/whatsapp.js – نظام بث إشعارات واتساب السيادي (نسخة الربط المحلي الذكي والمجاني 2026)
import { getQuery, runQuery } from './db';

let whatsappConfig = null;

// ========== تحميل وتأمين إعدادات الربط ==========
function loadConfig() {
  if (!whatsappConfig) {
    const saved = localStorage.getItem('whatsapp_config');
    // نعتبره مفعلاً تلقائياً للربط المحلي، أو نعتمد على قيمة الحفظ لسهولة التحكم
    whatsappConfig = saved ? JSON.parse(saved) : { enabled: true };
  }
  return whatsappConfig;
}

// ========== الدالة الأساسية المعدلة: الإرسال عبر البروتوكول المحلي العبقري ==========
export async function sendWhatsApp(to, message) {
  const config = loadConfig();
  
  // حماية برمجية: التحقق من التفعيل (يمكن للمستخدم إطفائه من الإعدادات)
  if (config.enabled === false) {
    console.warn('⚠️ نظام إشعارات واتساب غير نشط من شاشة الإعدادات');
    return { success: false, error: 'غير مفعل' };
  }

  try {
    // 1. تنظيف رقم الهاتف ليصبح أرقاماً فقط متوافقة مع روابط ميتآ الدولية
    const cleanPhone = to.replace(/\D/g, ''); 

    if (!cleanPhone) {
      return { success: false, error: 'رقم الهاتف غير صالح' };
    }

    // 2. تشفير نص الرسالة المنسقة لتضمين المسافات والرموز والخط العريض
    const encodedMessage = encodeURIComponent(message);

    // 3. توليد رابط البروتوكول المباشر (Deep Linking)
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    // 4. إصدار أمر بيئة Electron لفتح تطبيق الواتساب أو المتصفح الخارجي فوراً
    if (window.require) {
      const { shell } = window.require('electron');
      shell.openExternal(whatsappUrl);
    } else {
      window.open(whatsappUrl, '_blank');
    }

    // نُعيد نجاح لإتمام عملية التوثيق في قاعدة البيانات والعدادات بشاشة الحضور
    return { success: true };
  } catch (error) {
    console.error('💥 فشل فتح واجهة تطبيق WhatsApp المحلية:', error.message);
    return { success: false, error: error.message };
  }
}

// ========== دالة توجيه الإشعارات الفردية وتوثيقها محلياً (المعدلة والمترابطة) ==========
export async function notifyParent(studentId, type = 'absent', extra = {}) {
  const student = await getQuery("SELECT * FROM students WHERE id = ?", [studentId]);

  if (!student || student.length === 0) {
    return { success: false, error: 'لم يتم العثور على الطالب في قاعدة البيانات' };
  }

  const s = student[0];
  
  // 💡 الحل العبقري للترابط: سحب رقم ولي الأمر، وإذا كان فارغاً يسحب رقم هاتف الطالب المتاح لضمان عدم توقف الفحص
  const targetPhone = s.parent_phone || s.phone;

  if (!targetPhone) {
    return { success: false, error: 'لا يوجد رقم هاتف مسجل للطالب أو لولي أمره' };
  }

  let message = '';

  // صياغة الرسائل منسقة بشكل جذاب (استخدام النجوم * للخط العريض)
  switch (type) {
    case 'entry':
      message = `السلام عليكم ورحمة الله وبركاته،\nنحيطكم علماً بأن الطالب: *${s.full_name}*\nسجل دخوله إلى المركز الساعة: [ ${extra.time || '—'} ].\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
      break;

    case 'lecture':
      message = `السلام عليكم ورحمة الله وبركاته،\nابنكم: *${s.full_name}*\nدخل محاضرة: *${extra.subject || '—'}*\nالوقت: [ ${extra.time || '—'} ]\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
      break;

    case 'absent':
      message = `السلام عليكم ورحمة الله وبركاته،\nنود إبلاغكم بأن الطالب: *${s.full_name}*\nقد تم تسجيله *غائباً* عن محاضرة اليوم.\nيرجى المتابعة والالتزام لمنع الحرمان.\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
      break;

    case 'exit':
      message = `السلام عليكم ورحمة الله وبركاته،\nتم تسجيل خروج الطالب: *${s.full_name}*\nالساعة: [ ${extra.time || '—'} ]\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
      break;

    case 'warning':
      message = `⚠️ *تنبيه هام جداً*\nالطالب: *${s.full_name}*\nنسبة الغياب الإجمالية وصلت إلى: *${extra.rate || '0'}%*\nيرجى المتابعة العاجلة مع الإدارة الأكاديمية.\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
      break;

    // ========== قوالب مراحل الغياب المتدرج المعتمدة ==========
    case 'stage_10':
      message = `🟢 *تنبيه أول (تجاوز 10%)*\nالطالب: *${s.full_name}*\nنسبة الغياب الحالية: *${extra.rate || '0'}%*\nيرجى حث الطالب على الالتزام الفوري.\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
      break;

    case 'stage_20':
      message = `🟡 *تنبيه ثانٍ (تجاوز 20%)*\nالطالب: *${s.full_name}*\nنسبة الغياب الحالية: *${extra.rate || '0'}%*\nيجب الحضور لمقابلة المرشد الأكاديمي لتفادي الحرمان الرسمي.\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
      break;

    case 'stage_25':
      message = `🔴 *إنذار أكاديمي نهائي (تجاوز 25%)*\nالطالب: *${s.full_name}*\nنسبة الغياب الحالية: *${extra.rate || '0'}%*\nتم إصدار إنذار أكاديمي رسمي وربطه بملف الطالب بصفة قطعية.\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
      break;

    case 'stage_30':
      message = `🚨 *حرمان رسمي من الاختبار (30%)*\nالطالب: *${s.full_name}*\nنسبة الغياب الحالية: *${extra.rate || '0'}%*\nبسبب تجاوز الحد المسموح، تم حرمان الطالب من دخول الاختبارات النهائية.\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
      break;

    default:
      message = `السلام عليكم ورحمة الله وبركاته،\nالطالب: *${s.full_name}*\n${extra.text || ''}\n\n*جامعة القرآن الكريم والعلوم الإسلامية*`;
  }

  // تنفيذ فتح نافذة الواتساب فوراً بالرقم النشط والمتاح تلقائياً
  const result = await sendWhatsApp(targetPhone, message);

  // توثيق العملية في قاعدة البيانات المحلية لإصدار التقارير حتى مع النظام المحلي!
  await runQuery(
    "INSERT INTO notifications (student_id, parent_phone, message, type, status, sent_at) VALUES (?, ?, ?, ?, ?, ?)",
    [studentId, targetPhone, message, type, result.success ? 'sent' : 'failed', new Date().toISOString()]
  );

  return result;
}

// ========== دالة بث الحضور الجماعي المتوافقة بالكامل مع واجهتك ==========
export async function notifyAllAbsent() {
  const today = new Date().toISOString().slice(0, 10);

  // جلب كافة الطلاب النشطين الذين لم يسجلوا حضوراً اليوم مع جلب حقول الهواتف المتاحة
  const absentStudents = await getQuery(
    `SELECT DISTINCT s.id, s.full_name, s.parent_phone, s.phone
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
    const activePhone = student.parent_phone || student.phone;
    if (!activePhone) continue;
    // استدعاء الففتح المحلي المتتالي
    const result = await notifyParent(student.id, 'absent');
    if (result.success) sent++;
  }

  return { success: true, total: absentStudents.length, sent };
}

// ========== المعالجة المؤتمتة لنسب الحرمان التصاعدية ==========
export async function notifyAbsenceStages() {
  const config = loadConfig();
  if (config.enabled === false) return { success: false, error: 'الواتساب غير مفعل' };

  const attendance = await getQuery(
    "SELECT a.student_id, a.status, s.full_name, s.parent_phone, s.phone FROM attendance a INNER JOIN students s ON a.student_id = s.id WHERE s.status = 'active'"
  );

  if (!attendance || attendance.length === 0) return { success: false, error: 'لا توجد حركات حضور مسجلة لحساب النسب' };

  const studentMap = {};
  attendance.forEach(a => {
    const sid = a.student_id;
    const activePhone = a.parent_phone || a.phone;
    if (!activePhone) return;

    if (!studentMap[sid]) studentMap[sid] = { full_name: a.full_name, parent_phone: activePhone, total: 0, absent: 0 };
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
    `SELECT DISTINCT s.id, s.full_name, s.parent_phone, s.phone
     FROM students s
     WHERE s.status = 'active'
     AND s.id NOT IN (
       SELECT DISTINCT a.student_id FROM attendance a WHERE a.date = ?
     )`,
    [today]
  );

  let sent = 0;
  for (const student of absentStudents) {
    const activePhone = student.parent_phone || student.phone;
    if (!activePhone) continue;

    const result = await notifyParent(student.id, 'lecture', { subject: schedule[0].subject, time: schedule[0].time_from });
    if (result.success) sent++;
  }

  return { success: true, total: absentStudents.length, sent };
}
