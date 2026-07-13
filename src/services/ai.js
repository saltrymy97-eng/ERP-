// src/services/ai.js – المستشار الأكاديمي الذكي الفخم | إصدار الـ Cloud API السحابي المطور كلياً
// مطور النظام: المهندس سالم فهمي التريمي
import { getQuery, getSystemStatsForAI } from './db';

let isLoaded = true; 
let totalRequests = 0;
let successfulRequests = 0;

// محرك تتبع حالة المعالجة اللحظي لدعم المؤثرات البصرية والأيقونات الـ 3D التفاعلية
export const AI_STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  TYPING: 'typing',
  ERROR: 'error'
};
let currentSystemState = AI_STATES.IDLE;
let stateListener = null;

// إعدادات الوصول السحابي لـ Groq API (النموذج العملاق المطور فائق الذكاء والاستيعاب)
const GROQ_MODEL = 'llama-3.3-70b-versatile'; 
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 15000; // مهلة أمان للإنترنت (15 ثانية)

// دالة لتحديث الحالة البرمجية وضخها مباشرة للواجهة الرسومية (UI Animation Trigger)
function updateSystemState(newState) {
  currentSystemState = newState;
  if (stateListener) stateListener(newState);
}

export function subscribeToAIState(callback) {
  stateListener = callback;
  return () => { stateListener = null; };
}

export function getSystemState() { return currentSystemState; }

// ========== شخصية المستشار الأكاديمي الفائق ومتعدد المهام الشامل ==========
const SYSTEM_PROMPT = `أنت "المستشار الأكاديمي والتحليلي الاستراتيجي السيادي الأول" المطور خصيصاً لجامعة القرآن الكريم والعلوم الإسلامية بفرع غيل باوزير - حضرموت.
أنت لست مجرد أداة لإرجاع النصوص، بل أنت عقل المنظومة الإدارية القادر على اتخاذ القرار، وإمداد عمادة الكلية، إدارة القبول والتسجيل، والأستاذ سعيد بمرئيات استباقية دقيقة.

[المهام والوظائف الاحترافية المطلوبة منك بدقة متناهية]:
1. تحليل الكشوفات والمطابقة الذكية: مطابقة كشوفات حضور وغياب الطلاب وتحديد نسب الانضباط العام لكل مجموعة دراسية ومستوى أكاديمي بشكل تلقائي.
2. إدارة وتقييم الأكاديميين (طلب الأستاذ سعيد الحاسم):
   - مراقبة الخطط الدراسية: فحص نسبة إنجاز المنهج لكل مقرر، والتحذير الفوري من أي دكتور أو محاضر يتأخر في وتيرة التسليم بالنسبة للتاريخ الحالي.
   - قياس الكفاءة والإنتاجية: تحليل الساعات المنجزة ومقارنتها بالساعات المخطط لها، مع القدرة التقديرية على ربط الساعات المنجزة بمتطلبات الدفع الإداري والمالي إن طُلب منك ذلك.
   - رصد العناوين: تتبع العناوين العلمية للمحاضرات لضمان اتساق المادة مع متطلبات جودة التعليم والاعتماد الأكاديمي.
3. التنبؤ الاستباقي بالمخاطر (Risk Mitigation):
   - التنبؤ بالتعثر الطلابي: تحديد الطلاب المعرضين للحرمان أو الرسوب بسبب تجاوز نسب الغياب المسموح بها برمجياً وقانونياً (20% من المحاضرات).
   - رصد الفجوات الأكاديمية: الكشف عن أي خلل في توزيع الساعات الأسبوعية أو عدم انتظام رصد الحضور والغياب.
4. صياغة التوصيات الإدارية الفورية (Actionable Insights): تقديم توصيات مباشرة، واقعية ومبنية حصراً على بيانات الـ SQLite الحية لمعالجة أي قصور في العملية التعليمية داخل الكلية.

[هيكلية قاعدة البيانات المرجعية المحدثة التي تحكم تفكيرك]:
- كشوفات الطلاب (students): تحتوي على الهوية الكاملة لكل طالب (الاسم، الرقم الجامعي الفريد، الكلية، القسم، المستوى، المجموعة الدراسية).
- سجلات حضور الطلاب (attendance): ترصد السجل الزمني اليومي (تاريخ الحضور، وقت تسجيل البصمة/الدخول، وحالة الطالب: حاضر ✅ أو غائب ❌).
- كادر هيئة التدريس (teachers): سجل المحاضرين، التخصص الدقيق، وحالة الفعالية في الأقسام الأكاديمية.
- سجلات حضور الأكاديميين (teacher_attendance): تفصيل الأداء التدريسي اليومي (تاريخ المحاضرة، وقت الدخول والخروج، المادة والدرس الملقى، عدد الساعات المنجزة الفعلي، ونسبة إنجاز الخطة المقررة).

[المنطق الإجرائي وضوابط جودة المخرجات]:
- التوازن والحيادية: عامل بيانات الطلاب ببالغ الاهتمام لتأمين مسيرتهم الدراسية، وعامل سجلات حضور المعلمين ببالغ الدقة لتأمين جودة الأداء الأكاديمي للجامعة.
- صرامة البيانات: لا تقبل وجود "بيانات مفقودة" كحجة للوقوف العاجز؛ إن نقصت البيانات في سياق ما، قم بتحليل المتاح واقترح خطة لجمع البيانات المفقودة لمدخل البيانات الإداري.
- لغة الخطاب وسرعة المعالجة: ردودك باللغة العربية الفصحى البليغة، ذات طابع إداري رفيع، ومصممة لتكون خالية تماماً من الرموز المعقدة أو الحواشي غير المجدية لضمان تفعيل ميزة النطق الصوتي التلقائي بسلاسة متناهية.`;

// جلب مفتاح الـ API بشكل آمن متوافق مع بيئة الـ Electron السحابية والمحلية
async function getApiKey() {
  if (window.electronAPI && typeof window.electronAPI.getSecret === 'function') {
    try {
      const securedKey = await window.electronAPI.getSecret('GROQ_API_KEY');
      if (securedKey) return securedKey;
    } catch (err) {
      console.warn("فشل جلب المفتاح عبر الجسر الآمن للويندوز، جاري التحول للتخزين المحلي:", err);
    }
  }
  return localStorage.getItem('GROQ_API_KEY') || '';
}

export async function loadMobileModel(onProgress) {
  updateSystemState(AI_STATES.THINKING);
  const apiKey = await getApiKey();
  
  if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('gsk_YOUR_DEFAULT')) {
    if (onProgress) onProgress('❌ لم يتم تفعيل مفتاح Groq API بنجاح؛ يرجى تهيئته في لوحة الإعدادات أولاً.');
    updateSystemState(AI_STATES.ERROR);
    return false;
  }

  if (onProgress) onProgress('✅ منظومة الاستعلام السحابي الخارجي مؤمنة ومتصلة بـ Groq بنجاح');
  updateSystemState(AI_STATES.IDLE);
  return true;
}

// محرك إرسال النصوص السحابي المحمي كلياً ضد مشاكل الشبكة والتجمد
async function callCloudGroq(messages) {
  totalRequests++;
  updateSystemState(AI_STATES.THINKING);

  const apiKey = await getApiKey();
  if (!apiKey) {
    updateSystemState(AI_STATES.ERROR);
    return '⚠️ خطأ أمني: مفتاح الـ Groq API فارغ أو غير مضبوط، يرجى إدخاله في وحدة الإعدادات.';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: 0.15, 
        top_p: 0.85,
        max_tokens: 1200, // زيادة طفيفة لدعم الإجابات الأكثر تفصيلاً واحترافية
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) throw new Error('مفتاح الـ API المدخل غير صالح أو انتهت صلاحية باقته الحرة.');
      if (response.status === 429) throw new Error('تم تجاوز حد الطلبات المسموح بها مؤقتاً (Rate Limit)، يرجى الانتظار دقيقة.');
      throw new Error(`استجابة خادم غير متوقعة بكود: ${response.status}`);
    }

    const data = await response.json();
    successfulRequests++;
    
    updateSystemState(AI_STATES.TYPING);
    setTimeout(() => updateSystemState(AI_STATES.IDLE), 800);

    return data.choices[0]?.message?.content?.trim() || '⚠️ استقبل النظام حزمة فارغة من المستشار السحابي.';
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('Groq Execution Architecture Error:', e);
    updateSystemState(AI_STATES.ERROR);

    if (e.name === 'AbortError') {
      return '⚠️ استغرق الخادم وقتاً طويلاً للرد (انتهت مهلة الأمان 15 ثانية). يرجى فحص جودة اتصال الإنترنت في الكلية.';
    }
    return `⚠️ تعذر إتمام التحليل الاستراتيجي السحابي. السبب: ${e.message}`;
  }
}

// 🔮 دالة الاستقبال المحصنة والمعدلة جذرياً لقطع دابر الفراغ والهلوسة 🔮
export async function askAI(question, context = '') {
  if (!question || question.trim() === '') return 'عذراً مدير النظام الموقر، حقل الاستفسار الأكاديمي فارغ حالياً.';
  
  // 🛡️ الحصن البرمجي: جلب مباشر وفوري لأحدث كشف حي من SQLite دون وسيط
  let freshSystemContext = "";
  try {
    freshSystemContext = await getSystemStatsForAI();
  } catch (e) {
    console.error("فشل استدعاء الكشوفات الحية تلقائياً داخل الدالة الحصينة:", e);
    freshSystemContext = "تنبيه: تعذر سحب كشوفات الـ SQLite الحية بسبب عارض تقني في استعلامات الربط.";
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { 
      role: 'user', 
      content: `إليك مستندات وبيانات نظام جامعة القرآن الكريم الحية والمستخرجة حالياً من الـ SQLite للتحليل والفحص الفوري:
      
      [بيانات قاعدة البيانات الحية]:
      """
      ${freshSystemContext}
      """
      
      بناءً على السجلات الحقيقية المرفقة أعلاه، أجب بدقة واحترافية عالية على السؤال التالي دون تجاهل السجلات المذكورة:
      السؤال: ${question}` 
    }
  ];
  return await callCloudGroq(messages);
}

// ========================================================
// 🛡️ دالات توافقية لمنع انهيار البناء مع الواجهات السابقة
// ========================================================
export function startVoiceChat(onDataReady, onError) { if (onError) onError('💡 النظام يعمل حالياً بالنمط الكتابي الفخم والسحابي الكامل.'); }
export function stopVoiceRecognition() {}
export function startRecordingLocal(onDataReady, onError) { return startVoiceChat(onDataReady, onError); }
export function stopRecordingLocal() { return stopVoiceRecognition(); }

// دالة النطق الصوتي الفخمة والمحسنة
export function speakText(text, options = {}) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel(); 

  const cleanText = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'ar-SA';
  utterance.rate = options.rate || 0.95;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith('ar') &&
    (v.name.includes('Majed') || v.name.includes('Naeem') || v.name.includes('Google'))
  );
  utterance.voice = preferred || voices.find(v => v.lang.startsWith('ar')) || voices[0];
  
  if (options.onEnd) utterance.onend = options.onEnd;
  window.speechSynthesis.speak(utterance);
}

// =========================================================
// ٦. الدوال المساعدة الإحصائية المربوطة مباشرة بقواعد البيانات
// =========================================================
export async function analyzeDailyAttendance() {
  const context = await getSystemStatsForAI();
  return await askAI('حلل حالة الحضور اليوم باختصار وأعطِ التوصية الأهم وفقط.', context);
}

export async function predictAtRiskStudents() {
  const context = await getSystemStatsForAI();
  return await askAI('اذكر الطلاب المعرضين للخطر وتوصية سريعة لهم.', context);
}

export async function detectAnomalies() {
  const context = await getSystemStatsForAI();
  return await askAI('هل هناك أنماط غير طبيعية اليوم؟ أجب بوضوح واختصار.', context);
}

export async function getWeeklyRecommendations() {
  const context = await getSystemStatsForAI();
  return await askAI('أعطني 3 توصيات استراتيجية سريعة ومباشرة بناءً على الحضور الأسبوعي.', context);
}

export async function comprehensiveAnalysis() {
  const context = await getSystemStatsForAI();
  return await askAI('قدم خلاصة سريعة جداً عن حالة النظام بنقاط رصاصية واضحة.', context);
}

export function isModelReady() { return isLoaded; }
export function isModelLoading() { return false; }
export async function unloadModel() { isLoaded = true; } 
export function getModelInfo() { return { الاسم: GROQ_MODEL, المزود: 'منظومة سحابية متطورة (Groq Cloud)', الحالة: '✅ جاهز ومستقر عبر الإنترنت فائق السرعة' }; }
export function getUsageStats() { return { totalRequests, successfulRequests }; }
