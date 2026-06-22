// services/whatsapp.js – إشعارات واتساب
import { getQuery } from './db';

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
  const student = getQuery(
    "SELECT * FROM students WHERE id=?",
    [studentId]
  )[0];

  if (!student || !student.parent_phone) {
    return { success: false, error: 'لا يوجد رقم ولي أمر' };
  }

  let message = '';

  switch (type) {
    case 'entry':
      message = `السلام عليكم\nنحيطكم علماً بأن:\nالطالب: ${student.full_name}\nسجل دخوله إلى المركز الساعة ${extra.time || '—'}.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'lecture':
      message = `السلام عليكم\nابنكم ${student.full_name}\nدخل محاضرة: ${extra.subject || '—'}\nالوقت: ${extra.time || '—'}\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'absent':
      message = `السلام عليكم\nنود إبلاغكم بأن الطالب:\n${student.full_name}\nتغيب عن محاضرة اليوم.\nيرجى المتابعة.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'exit':
      message = `السلام عليكم\nتم تسجيل خروج الطالب:\n${student.full_name}\nالساعة: ${extra.time || '—'}\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    case 'warning':
      message = `⚠️ تنبيه هام\nالطالب: ${student.full_name}\nنسبة الغياب: ${extra.rate || '0'}%\nيرجى المتابعة العاجلة.\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
      break;

    default:
      message = `السلام عليكم\nالطالب: ${student.full_name}\n${extra.text || ''}\n\nجامعة القرآن الكريم والعلوم الإسلامية`;
  }

  const result = await sendWhatsApp(student.parent_phone, message);

  const { runQuery } = await import('./db');
  runQuery(
    "INSERT INTO notifications (student_id, parent_phone, message, type, status) VALUES (?, ?, ?, ?, ?)",
    [studentId, student.parent_phone, message, type, result.success ? 'sent' : 'failed']
  );

  return result;
}

export async function notifyAllAbsent(scheduleId) {
  const { getQuery } = await import('./db');
  const today = new Date().toISOString().slice(0, 10);

  const absentStudents = getQuery(`
    SELECT DISTINCT s.id, s.full_name, s.parent_phone
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
    WHERE a.id IS NULL OR a.status = 'absent'
  `, [today]);

  let sent = 0;
  for (const student of absentStudents) {
    const result = await notifyParent(student.id, 'absent');
    if (result.success) sent++;
  }

  return { total: absentStudents.length, sent };
}
