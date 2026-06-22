// src/services/ai.js – الذكاء الاصطناعي المحلي (Llama 3.2 1B + صوت + تحليل)
import { getQuery } from './db';

// ========== إعدادات Groq ==========
const GROQ_API_KEY = 'gsk_your_api_key_here';
const GROQ_MODEL = 'llama-3.2-1b-preview';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ========== نظام الشخصية ==========
const SYSTEM_PROMPT = `أنت مساعد ذكي في نظام متابعة حضور وغياب الطلاب بجامعة القرآن الكريم والعلوم الإسلامية.
أنت خبير في تحليل بيانات الحضور والغياب.
تتحدث العربية الفصحى الميسرة.
كن موجزاً ومفيداً ودقيقاً.
لا تذكر معلومات خارج نطاق النظام.`;

// ========== تحميل النموذج ==========
export async function loadMobileModel() {
  console.log('✅ Groq API جاهز');
  return true;
}

// ========== استدعاء Groq ==========
async function callGroq(messages, maxTokens = 300) {
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: 0.3,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`خطأ في الاتصال: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'عذراً، لم أستطع المعالجة.';
  } catch (error) {
    console.error('خطأ Groq:', error);
    return '⚠️ تعذر الاتصال بالذكاء الاصطناعي. تأكد من الاتصال بالإنترنت.';
  }
}

// ========== سؤال عام ==========
export async function askAI(question, context = '') {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `البيانات المتاحة:\n${context}\n\nالسؤال: ${question}` }
  ];
  return await callGroq(messages);
}

// ========== تحليل الحضور اليومي ==========
export async function analyzeDailyAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const totalStudents = getQuery("SELECT COUNT(*) as c FROM students WHERE status='active'")[0]?.c || 0;
  const present = getQuery("SELECT COUNT(DISTINCT student_id) as c FROM attendance WHERE date=? AND status='present'", [today])[0]?.c || 0;
  const absent = getQuery("SELECT COUNT(DISTINCT student_id) as c FROM attendance WHERE date=? AND status='absent'", [today])[0]?.c || 0;
  const late = getQuery("SELECT COUNT(*) as c FROM attendance WHERE date=? AND status='late'", [today])[0]?.c || 0;
  const topAbsent = getQuery(`
    SELECT s.full_name, COUNT(*) as days
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.status = 'absent'
    GROUP BY a.student_id
    ORDER BY days DESC
    LIMIT 5
  `);
  const context = JSON.stringify({
    التاريخ: today, إجمالي_الطلاب: totalStudents, الحاضرون: present,
    الغائبون: absent, المتأخرون: late, الأكثر_غياباً: topAbsent
  }, null, 2);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `حلل بيانات الحضور التالية. من يحتاج متابعة فورية؟ ما هي توصياتك السريعة؟\n\n${context}` }
  ];
  return await callGroq(messages, 500);
}

// ========== توقع الطلاب المعرضين للخطر ==========
export async function predictAtRiskStudents() {
  const atRisk = getQuery(`
    SELECT s.full_name, s.university_id,
           COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as total_absences,
           COUNT(*) as total_days,
           ROUND(CAST(COUNT(CASE WHEN a.status = 'absent' THEN 1 END) AS FLOAT) / COUNT(*) * 100, 1) as absence_rate
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id
    GROUP BY s.id
    HAVING absence_rate > 10
    ORDER BY absence_rate DESC
    LIMIT 10
  `);
  const context = JSON.stringify(atRisk, null, 2);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `هؤلاء الطلاب تجاوزوا 10% غياب. توقع من سيتعثر دراسياً. قدم توصيات عاجلة.\n\n${context}` }
  ];
  return await callGroq(messages, 500);
}

// ========== كشف أنماط غير طبيعية ==========
export async function detectAnomalies() {
  const anomalies = getQuery(`
    SELECT s.full_name, a.date, a.time_in, a.status, a.method
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.status = 'present'
    AND (a.time_in > '09:00' OR a.time_in < '07:00')
    ORDER BY a.date DESC
    LIMIT 15
  `);
  const context = JSON.stringify(anomalies, null, 2);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `افحص سجلات الحضور هذه. هل هناك أنماط مشبوهة أو غير طبيعية؟\n\n${context}` }
  ];
  return await callGroq(messages, 400);
}

// ========== توصيات أسبوعية ==========
export async function getWeeklyRecommendations() {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const startDate = weekStart.toISOString().slice(0, 10);
  const weekly = getQuery(`
    SELECT 
      COUNT(DISTINCT a.student_id) as unique_attended,
      COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absences,
      COUNT(CASE WHEN a.status = 'late' THEN 1 END) as lates
    FROM attendance a
    WHERE a.date >= ?
  `, [startDate]);
  const context = JSON.stringify(weekly[0], null, 2);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `بناءً على بيانات الأسبوع الماضي، قدم 5 توصيات عملية لتحسين الحضور.\n\n${context}` }
  ];
  return await callGroq(messages, 500);
}

// ========== محادثة صوتية ==========
let recognition = null;

export function startVoiceRecognition(callback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    callback('❌ متصفحك لا يدعم التعرف على الصوت', null);
    return null;
  }
  recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    if (text && text.trim()) callback(null, text.trim());
  };
  recognition.onerror = () => callback('❌ خطأ في التسجيل الصوتي', null);
  recognition.onend = () => callback(null, null);
  recognition.start();
  return recognition;
}

export function stopVoiceRecognition() {
  if (recognition) { recognition.stop(); recognition = null; }
}

// ========== نطق الرد ==========
export function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-SA';
  utterance.rate = 0.95;
  utterance.pitch = 0.9;
  utterance.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const arabicVoice = voices.find(v => v.lang.startsWith('ar') && (v.name.includes('Male') || v.name.includes('Natural')));
  if (arabicVoice) utterance.voice = arabicVoice;
  window.speechSynthesis.speak(utterance);
}

// ========== محادثة صوتية كاملة ==========
export async function startVoiceChat() {
  return new Promise((resolve) => {
    startVoiceRecognition(async (error, text) => {
      if (error) { resolve({ error, question: null, answer: null }); return; }
      if (!text) { resolve({ error: null, question: null, answer: null }); return; }
      const answer = await askAI(text);
      speakText(answer);
      resolve({ error: null, question: text, answer });
    });
  });
}

// ========== تحليل شامل ==========
export async function comprehensiveAnalysis() {
  const today = new Date().toISOString().slice(0, 10);
  const stats = {
    totalStudents: getQuery("SELECT COUNT(*) as c FROM students WHERE status='active'")[0]?.c || 0,
    totalTeachers: getQuery("SELECT COUNT(*) as c FROM teachers WHERE status='active'")[0]?.c || 0,
    todayPresent: getQuery("SELECT COUNT(DISTINCT student_id) as c FROM attendance WHERE date=? AND status='present'", [today])[0]?.c || 0,
    todayAbsent: getQuery("SELECT COUNT(DISTINCT student_id) as c FROM attendance WHERE date=? AND status='absent'", [today])[0]?.c || 0,
    devicesOnline: getQuery("SELECT COUNT(*) as c FROM devices WHERE status='online'")[0]?.c || 0,
    notificationsSent: getQuery("SELECT COUNT(*) as c FROM notifications WHERE date(sent_at)=?", [today])[0]?.c || 0
  };
  const context = JSON.stringify(stats, null, 2);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `قدم تقريراً شاملاً عن حالة النظام اليوم. ماذا تلاحظ؟\n\n${context}` }
  ];
  return await callGroq(messages, 600);
}
