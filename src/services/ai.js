// src/services/ai.js – ذكاء اصطناعي محلي + صوت كامل (بدون إنترنت)
import { getQuery } from './db';

let model = null;
let isLoaded = false;
let recognition = null;

// ========== نظام الشخصية ==========
const SYSTEM_PROMPT = `أنت مساعد ذكي في نظام متابعة حضور وغياب الطلاب بجامعة القرآن الكريم والعلوم الإسلامية.
أنت خبير في تحليل بيانات الحضور والغياب.
تتحدث العربية الفصحى الميسرة.
كن موجزاً ومفيداً ودقيقاً.
لا تذكر معلومات خارج نطاق النظام.`;

// ==========================================
// ١. تحميل النموذج المحلي
// ==========================================

export async function loadMobileModel() {
  if (isLoaded) return true;

  try {
    const { pipeline } = await import('@xenova/transformers');

    model = await pipeline('text-generation', 'Xenova/gemma-2-2b-it', {
      quantized: true,
      local: true
    });

    isLoaded = true;
    console.log('✅ AI محلي جاهز');
    return true;
  } catch (e) {
    console.warn('⚠️ AI غير متاح:', e.message);
    return false;
  }
}

// ==========================================
// ٢. سؤال الذكاء الاصطناعي
// ==========================================

export async function askAI(question, context = '') {
  if (!isLoaded) {
    const loaded = await loadMobileModel();
    if (!loaded) return '⚠️ الذكاء الاصطناعي غير متاح حالياً. تأكد من تحميل النموذج.';
  }

  const prompt = `[INST] ${SYSTEM_PROMPT}\n\nالبيانات: ${context}\n\nالسؤال: ${question} [/INST]`;

  try {
    const result = await model(prompt, {
      max_new_tokens: 200,
      temperature: 0.3
    });

    const answer = result[0]?.generated_text?.split('[/INST]')[1]?.trim();
    return answer || 'عذراً، لم أستطع الإجابة على هذا السؤال.';
  } catch (e) {
    return '⚠️ خطأ في معالجة السؤال. حاول مرة أخرى.';
  }
}

// ==========================================
// ٣. تحليلات جاهزة
// ==========================================

export async function analyzeDailyAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];

  const todayData = attendance.filter(a => a.date === today);
  const present = todayData.filter(a => a.status === 'present').length;
  const absent = todayData.filter(a => a.status === 'absent').length;
  const late = todayData.filter(a => a.status === 'late').length;

  const context = `إجمالي الطلاب: ${students.length}، حاضر: ${present}، غائب: ${absent}، متأخر: ${late}`;
  return await askAI('حلل هذه البيانات. من يحتاج متابعة؟ ما توصياتك؟', context);
}

export async function predictAtRiskStudents() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];

  let context = '';
  students.forEach(s => {
    const sAttendance = attendance.filter(a => a.student_id === s.id);
    if (sAttendance.length > 0) {
      const absences = sAttendance.filter(a => a.status === 'absent').length;
      const rate = Math.round((absences / sAttendance.length) * 100);
      if (rate > 10) {
        context += `${s.full_name}: غياب ${rate}%\n`;
      }
    }
  });

  if (!context) context = 'جميع الطلاب منتظمون.';
  return await askAI('حلل هؤلاء الطلاب. من معرض للخطر؟', context);
}

export async function detectAnomalies() {
  const attendance = getQuery('attendance') || [];
  const today = new Date().toISOString().slice(0, 10);

  const todayData = attendance.filter(a => a.date === today);
  const context = `سجلات اليوم: ${todayData.length} عملية.`;

  return await askAI('هل هناك أنماط غير طبيعية؟', context);
}

export async function getWeeklyRecommendations() {
  const attendance = getQuery('attendance') || [];
  const students = getQuery('students') || [];

  let totalAbsences = 0;
  attendance.forEach(a => { if (a.status === 'absent') totalAbsences++; });

  const context = `عدد الطلاب: ${students.length}، إجمالي الغيابات: ${totalAbsences}`;
  return await askAI('قدم 5 توصيات عملية لتحسين الحضور.', context);
}

export async function comprehensiveAnalysis() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];
  const today = new Date().toISOString().slice(0, 10);

  const present = attendance.filter(a => a.date === today && a.status === 'present').length;
  const absent = attendance.filter(a => a.date === today && a.status === 'absent').length;

  const context = `الطلاب: ${students.length}، حاضر: ${present}، غائب: ${absent}`;
  return await askAI('قدم تقريراً شاملاً عن حالة النظام اليوم.', context);
}

// ==========================================
// ٤. المحادثة الصوتية الكاملة
// ==========================================

export function startVoiceRecognition(callback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    callback('❌ متصفحك لا يدعم التعرف على الصوت. استعمل كروم.', null);
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    console.log('🎤 جاري الاستماع...');
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    if (text && text.trim()) {
      callback(null, text.trim());
    }
  };

  recognition.onerror = (event) => {
    let errorMsg = '❌ خطأ في التسجيل الصوتي.';
    if (event.error === 'not-allowed') errorMsg = '❌ الرجاء السماح للميكروفون.';
    if (event.error === 'no-speech') errorMsg = '❌ لم يتم اكتشاف صوت.';
    callback(errorMsg, null);
  };

  recognition.onend = () => {
    console.log('🎤 انتهى التسجيل.');
  };

  recognition.start();
  return recognition;
}

export function stopVoiceRecognition() {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}

export function speakText(text) {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-SA';
  utterance.rate = 0.95;
  utterance.pitch = 0.9;
  utterance.volume = 1.0;

  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v =>
      v.lang.startsWith('ar') &&
      (v.name.includes('Male') || v.name.includes('Natural') || v.name.includes('Google'))
    );
    if (arabicVoice) utterance.voice = arabicVoice;
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    setVoice();
  } else {
    window.speechSynthesis.onvoiceschanged = setVoice;
  }
}

export async function startVoiceChat() {
  return new Promise((resolve) => {
    startVoiceRecognition(async (error, text) => {
      if (error) {
        resolve({ error, question: null, answer: null });
        return;
      }

      if (!text) {
        resolve({ error: null, question: null, answer: null });
        return;
      }

      // تحليل السؤال بالذكاء المحلي
      const answer = await askAI(text);
      
      // نطق الرد
      speakText(answer);

      resolve({ error: null, question: text, answer });
    });
  });
}

// ==========================================
// ٥. دالة مساعدة: تحميل الصوت من ملف
// ==========================================

export async function transcribeAudio(audioFile) {
  // هذه الدالة للنسخة المتقدمة مع Whisper
  return '⚠️ النسخة المحلية لا تدعم تحميل الملفات الصوتية. استعمل الميكروفون.';
}
