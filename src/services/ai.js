// src/services/ai.js – ذكاء اصطناعي محلي متقدم + صوت كامل
// النموذج: TinyLlama 1.1B – 700MB فقط – أسرع 3 مرات
import { getQuery } from './db';

// ========== حالة النظام ==========
let model = null;
let isLoaded = false;
let isLoading = false;
let recognition = null;

// ========== نظام الشخصية المتقدم ==========
const SYSTEM_PROMPT = `أنت "المستشار الأكاديمي الذكي" في جامعة القرآن الكريم والعلوم الإسلامية.
دورك: تحليل بيانات الحضور والغياب وتقديم توصيات استراتيجية.

[هويتك]
- اسمك: المستشار الأكاديمي
- تتحدث العربية الفصحى الميسرة مع لمسة احترافية
- خبير في التحليل الأكاديمي وإدارة الحضور

[قدراتك]
- تحليل أنماط الغياب واكتشاف الاتجاهات
- توقع الطلاب المعرضين للتعثر الأكاديمي
- تقديم توصيات عملية مبنية على البيانات
- كشف الحالات الطارئة التي تحتاج تدخل فوري
- اقتراح حلول لتحسين نسبة الحضور

[أسلوبك]
- موجز لكن عميق
- تبدأ بالأولوية القصوى
- تستعمل الأرقام والنسب في تحليلك
- تقدم توصيات قابلة للتنفيذ فوراً
- لا تكرر المعلومات العامة`;

// ==========================================
// ١. تحميل النموذج (TinyLlama 1.1B - 700MB)
// ==========================================

export async function loadMobileModel(onProgress) {
  if (isLoaded) return true;
  if (isLoading) {
    while (isLoading) await new Promise(r => setTimeout(r, 500));
    return isLoaded;
  }

  isLoading = true;
  if (onProgress) onProgress('جاري تحميل النموذج... (0%)');

  try {
    const { pipeline } = await import('@xenova/transformers');

    if (onProgress) onProgress('جاري تحميل النموذج... (30%)');

    // ⚡ TinyLlama 1.1B – 700MB فقط – أسرع 3 مرات من Gemma 2B
    model = await pipeline('text-generation', 'Xenova/TinyLlama-1.1B-Chat-v1.0', {
      quantized: true,
      local: true,
      progress_callback: (progress) => {
        if (onProgress && progress?.progress) {
          const percent = Math.round(progress.progress * 100);
          onProgress(`جاري تحميل النموذج... (${percent}%)`);
        }
      }
    });

    isLoaded = true;
    isLoading = false;
    if (onProgress) onProgress('✅ النموذج جاهز!');
    console.log('✅ AI محلي جاهز (TinyLlama 1.1B)');
    return true;
  } catch (e) {
    isLoading = false;
    console.error('❌ فشل تحميل AI:', e);
    return false;
  }
}

// ==========================================
// ٢. محرك الذكاء الاصطناعي
// ==========================================

export async function askAI(question, context = '', options = {}) {
  if (!isLoaded) {
    const loaded = await loadMobileModel();
    if (!loaded) return '⚠️ الذكاء الاصطناعي غير متاح حالياً. النظام يعمل بدون إنترنت. تأكد من تحميل النموذج أولاً.';
  }

  const {
    maxTokens = 200,
    temperature = 0.5,
    detailed = false
  } = options;

  const detailLevel = detailed
    ? 'قدم تحليلاً مفصلاً وعميقاً.'
    : 'كن موجزاً ومباشراً.';

  const prompt = `[INST] ${SYSTEM_PROMPT}\n\n${detailLevel}\n\nالبيانات: ${context || 'لا توجد بيانات محددة.'}\n\nالسؤال: ${question} [/INST]`;

  try {
    const result = await model(prompt, {
      max_new_tokens: maxTokens,
      temperature: temperature,
      top_p: 0.9,
      repetition_penalty: 1.1
    });

    const answer = result[0]?.generated_text?.split('[/INST]')[1]?.trim();

    if (!answer || answer.length < 10) {
      return '⚠️ لم يتمكن الذكاء الاصطناعي من تحليل البيانات بشكل كافٍ.';
    }

    return answer.replace(/\[INST\].*\[\/INST\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  } catch (e) {
    console.error('خطأ AI:', e);
    return '⚠️ حدث خطأ في معالجة السؤال.';
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
  const rate = students.length > 0 ? Math.round((present / students.length) * 100) : 0;
  const context = `الطلاب: ${students.length}، حاضر: ${present} (${rate}%)، غائب: ${absent}`;
  return await askAI('حلل حالة اليوم. من يحتاج متابعة؟', context, { maxTokens: 150 });
}

export async function predictAtRiskStudents() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];
  const analysis = students.map(s => {
    const sA = attendance.filter(a => a.student_id === s.id);
    if (sA.length === 0) return null;
    const absences = sA.filter(a => a.status === 'absent').length;
    const rate = Math.round((absences / sA.length) * 100);
    if (rate >= 10) return { name: s.full_name, absenceRate: rate, risk: rate >= 30 ? 'خطر' : rate >= 20 ? 'إنذار' : 'مراقبة' };
    return null;
  }).filter(Boolean).sort((a, b) => b.absenceRate - a.absenceRate);
  if (analysis.length === 0) return '✅ جميع الطلاب منتظمون.';
  const context = JSON.stringify(analysis.slice(0, 5), null, 2);
  return await askAI('من الأكثر إلحاحاً؟', context, { maxTokens: 200 });
}

export async function detectAnomalies() {
  const attendance = getQuery('attendance') || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayData = attendance.filter(a => a.date === today);
  const context = `عمليات اليوم: ${todayData.length}`;
  return await askAI('هل هناك أنماط غير طبيعية؟', context, { maxTokens: 150 });
}

export async function getWeeklyRecommendations() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const weekData = attendance.filter(a => a.date >= weekStart.toISOString().slice(0, 10));
  const absences = weekData.filter(a => a.status === 'absent').length;
  const context = `غيابات الأسبوع: ${absences}، الطلاب: ${students.length}`;
  return await askAI('قدم 5 توصيات.', context, { maxTokens: 250 });
}

export async function comprehensiveAnalysis() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];
  const today = new Date().toISOString().slice(0, 10);
  const present = attendance.filter(a => a.date === today && a.status === 'present').length;
  const context = `الطلاب: ${students.length}، حاضر: ${present}`;
  return await askAI('قدم تقريراً شاملاً.', context, { maxTokens: 300, detailed: true });
}

// ==========================================
// ٤. المحادثة الصوتية
// ==========================================

export function startVoiceRecognition(callback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { callback('❌ استعمل Chrome.', null); return null; }
  recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA';
  recognition.continuous = false;
  recognition.onresult = (e) => { callback(null, e.results[0][0].transcript); };
  recognition.onerror = () => callback('❌ خطأ.', null);
  recognition.start();
  return recognition;
}

export function stopVoiceRecognition() { if (recognition) { recognition.stop(); recognition = null; } }

export function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ar-SA'; u.rate = 0.95; u.pitch = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const ar = voices.find(v => v.lang.startsWith('ar'));
  if (ar) u.voice = ar;
  window.speechSynthesis.speak(u);
}

export async function startVoiceChat(onThinking) {
  return new Promise((resolve) => {
    startVoiceRecognition(async (error, text) => {
      if (error) { resolve({ error }); return; }
      if (!text) { resolve({}); return; }
      if (onThinking) onThinking(true);
      const answer = await askAI(text);
      if (onThinking) onThinking(false);
      speakText(answer);
      resolve({ question: text, answer });
    });
  });
}

// ==========================================
// ٥. دوال مساعدة
// ==========================================

export function isModelReady() { return isLoaded; }
export function isModelLoading() { return isLoading; }
export async function unloadModel() { model = null; isLoaded = false; }
export function getModelInfo() {
  return {
    name: 'TinyLlama 1.1B',
    size: '700MB',
    type: 'محلي - بدون إنترنت',
    status: isLoaded ? '✅ جاهز' : isLoading ? '⏳ جاري التحميل' : '❌ غير محمل'
  };
}
