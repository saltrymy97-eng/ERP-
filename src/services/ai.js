// src/services/ai.js – المستشار الأكاديمي الذكي | إصدار Cloud API السحابي (نسخة احترافية محسّنة)
// مطور النظام: المهندس سالم فهمي التريمي
import { getQuery, getSystemStatsForAI } from './db';

let isLoaded = true; 
let totalRequests = 0;
let successfulRequests = 0;

// 🧠 محرك حفظ السياق (Conversation Memory)
const MAX_HISTORY_MESSAGES = 8;  // آخر 4 تبادلات (سؤال + رد)
let conversationHistory = [];

export const AI_STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  TYPING: 'typing',
  ERROR: 'error'
};
let currentSystemState = AI_STATES.IDLE;
let stateListener = null;

// إعدادات النموذج
const GROQ_MODEL = 'openai/gpt-oss-20b'; 
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20000;

function updateSystemState(newState) {
  currentSystemState = newState;
  if (stateListener) stateListener(newState);
}

export function subscribeToAIState(callback) {
  stateListener = callback;
  return () => { stateListener = null; };
}

export function getSystemState() { return currentSystemState; }

// =========================================================
// 🎭 شخصية المستشار الأكاديمي (محدّثة: ردود قصيرة، بلا رموز)
// =========================================================
const SYSTEM_PROMPT = `أنت "المستشار الأكاديمي الذكي" لجامعة القرآن الكريم والعلوم الإسلامية بفرع غيل باوزير - حضرموت.

[القاعدة الذهبية للأسلوب]:
أنت مساعد ذكي وودود، لست روبوت تقارير.
- إذا قال المستخدم "مرحبا" أو "أهلاً" أو "السلام عليكم" → رد بترحيب قصير فقط دون أي تحليل.
- إذا سأل سؤالاً محدداً → أجب عليه فقط دون إضافات غير مطلوبة.
- إذا طلب تحليلاً → قدّم التحليل المطلوب فقط.
- إذا كان سؤاله غير واضح، اطلب منه التوضيح بجملة قصيرة.

[طول الردود]:
- الرد الافتراضي: سطر واحد إلى ثلاثة أسطر.
- إذا طلب المستخدم التفصيل صراحة → يمكنك التوسع.
- إذا كان السؤال بسيطاً → الإجابة بجملة واحدة.

[قواعد صياغة صارمة]:
- ممنوع استخدام الرموز التنسيقية: ** ## -- | ~~ ##
- ممنوع استخدام الرموز التعبيرية (emojis) نهائياً.
- ممنوع سرد الجداول المعقدة إلا إذا طُلب منك صراحة.
- استخدم جملاً كاملة بسيطة، وليس نقاطاً متقطعة.
- اكتب بالأرقام العربية فقط (1، 2، 3) عند الحاجة.
- اكتب الأسماء كما هي بدون تحريف.

[بيانات النظام المتاحة لك]:
- students: الطلاب (الاسم، الرقم الجامعي، الكلية، التخصص).
- attendance: الحضور والغياب (التاريخ، الوقت، الحالة).
- teachers: هيئة التدريس.
- teacher_attendance: حضور المدرسين (الدرس، نسبة الإنجاز، الساعات).

[أمثلة على الردود الصحيحة]:
مثال 1:
المستخدم: مرحبا
الرد: أهلاً بك سيدي، كيف أخدمك؟

مثال 2:
المستخدم: كم عدد الطلاب النشطين؟
الرد: عدد الطلاب النشطين حالياً 120 طالباً.

مثال 3:
المستخدم: حلل حالة الحضور اليوم.
الرد: بلغ حضور اليوم 95 طالباً، بينهم 8 متأخرين. أنصح بمتابعة الطلاب المتأخرين بشكل دوري.

[تذكر دائماً]:
- أنت في محادثة متصلة، تذكر ما قاله المستخدم سابقاً.
- إذا سأل عن شيء سبق أن ذكرته، لا تكرره حرفياً، بل أضف قيمة جديدة.
- لا تقرأ الرموز التنسيقية بصوت عالٍ (النظام يحذفها تلقائياً لكنك تجنب كتابتها).

هويتك: مساعد ذكي محترف في خدمة جامعة القرآن الكريم بفرع غيل باوزير.`;

// =========================================================
// 🔑 جلب مفتاح API بشكل آمن
// =========================================================
async function getApiKey() {
  if (window.electronAPI && typeof window.electronAPI.getSecret === 'function') {
    try {
      const securedKey = await window.electronAPI.getSecret('GROQ_API_KEY');
      if (securedKey) return securedKey;
    } catch (err) {
      console.warn("فشل جلب المفتاح عبر الجسر الآمن:", err);
    }
  }
  return localStorage.getItem('GROQ_API_KEY') || '';
}

// =========================================================
// 🧠 إدارة السياق (Conversation Memory)
// =========================================================

/**
 * إضافة رسالة إلى السجل (يُحتفظ بآخر N رسائل فقط)
 */
function addToHistory(role, content) {
  conversationHistory.push({ role, content });
  
  // إذا تجاوزنا الحد، احذف الأقدم (نحتفظ بآخر N رسائل)
  if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
  }
}

/**
 * مسح تاريخ المحادثة بالكامل (تبدأ محادثة جديدة)
 */
export function clearConversationHistory() {
  conversationHistory = [];
  return true;
}

/**
 * الحصول على عدد الرسائل المحفوظة
 */
export function getHistoryLength() {
  return conversationHistory.length;
}

/**
 * الحصول على نسخة من السجل (للتصحيح)
 */
export function getConversationHistory() {
  return [...conversationHistory];
}

// =========================================================
// 🎯 كشف الترحيب والوداع (ردود فورية بدون API)
// =========================================================
function getGreetingResponse(question) {
  const cleanQuestion = question.trim().replace(/[؟!.،\s]+$/g, '');
  
  const greetings = {
    'مرحبا': 'أهلاً بك سيدي، كيف أخدمك؟',
    'مرحباً': 'أهلاً بك سيدي، كيف أخدمك؟',
    'أهلا': 'أهلاً بك، كيف يمكنني مساعدتك؟',
    'أهلاً': 'أهلاً بك، كيف يمكنني مساعدتك؟',
    'السلام عليكم': 'وعليكم السلام ورحمة الله وبركاته، كيف أخدمك؟',
    'هاي': 'مرحباً بك، تفضل بسؤالك.',
    'hi': 'مرحباً بك، تفضل بسؤالك.',
    'hello': 'مرحباً بك، تفضل بسؤالك.',
    'صباح الخير': 'صباح النور، كيف أخدمك؟',
    'مساء الخير': 'مساء النور، كيف أخدمك؟',
    'كيف حالك': 'بخير والحمد لله، كيف أخدمك؟',
    'شكرا': 'العفو، في خدمتك دائماً.',
    'شكراً': 'العفو، في خدمتك دائماً.',
    'مع السلامة': 'في رعاية الله، نراك قريباً.',
    'وداعا': 'في رعاية الله، نراك قريباً.',
    'وداعاً': 'في رعاية الله، نراك قريباً.'
  };
  
  return greetings[cleanQuestion] || null;
}

// =========================================================
// 🚀 تحميل النموذج (فحص المفتاح)
// =========================================================
export async function loadMobileModel(onProgress) {
  updateSystemState(AI_STATES.THINKING);
  const apiKey = await getApiKey();
  
  if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('gsk_YOUR_DEFAULT')) {
    if (onProgress) onProgress('❌ لم يتم تفعيل مفتاح Groq API؛ يرجى تهيئته في الإعدادات.');
    updateSystemState(AI_STATES.ERROR);
    return false;
  }

  if (onProgress) onProgress('✅ منظومة الاستعلام السحابي متصلة بـ Groq بنجاح');
  updateSystemState(AI_STATES.IDLE);
  return true;
}

// =========================================================
// 🌐 محرك الاتصال بالـ Cloud
// =========================================================
async function callCloudGroq(messages) {
  totalRequests++;
  updateSystemState(AI_STATES.THINKING);

  const apiKey = await getApiKey();
  if (!apiKey) {
    updateSystemState(AI_STATES.ERROR);
    return 'خطأ أمني: مفتاح Groq API فارغ، يرجى إدخاله في الإعدادات.';
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
        temperature: 0.2,       // توازن بين الإبداع والدقة
        top_p: 0.85,
        max_tokens: 500,        // تقليل الحد الأقصى لمنع الردود الطويلة
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) throw new Error('مفتاح API غير صالح أو انتهت صلاحيته.');
      if (response.status === 429) throw new Error('تم تجاوز حد الطلبات، انتظر دقيقة ثم أعد المحاولة.');
      if (response.status === 500) throw new Error('خادم Groq يواجه مشكلة مؤقتة، أعد المحاولة.');
      throw new Error(`استجابة خادم غير متوقعة (${response.status}).`);
    }

    const data = await response.json();
    successfulRequests++;
    
    updateSystemState(AI_STATES.TYPING);
    setTimeout(() => updateSystemState(AI_STATES.IDLE), 600);

    return data.choices[0]?.message?.content?.trim() || 'لم أستقبل رداً من الخادم.';
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('Groq Error:', e);
    updateSystemState(AI_STATES.ERROR);

    if (e.name === 'AbortError') {
      return 'استغرق الخادم وقتاً طويلاً (تجاوز 20 ثانية). تأكد من جودة الإنترنت.';
    }
    if (e.message.includes('Failed to fetch') || e.message.includes('ERR_CERT')) {
      return 'تعذر الاتصال بالخادم. تأكد من صحة تاريخ جهازك ومن اتصال الإنترنت.';
    }
    return `تعذر إتمام الطلب. السبب: ${e.message}`;
  }
}

// =========================================================
// 🎯 الدالة الرئيسية: askAI (مع دعم السياق)
// =========================================================
export async function askAI(question, context = '') {
  if (!question || question.trim() === '') {
    return 'عذراً، لم أفهم سؤالك. هل يمكنك إعادة صياغته؟';
  }

  // 🟢 كشف الترحيب والوداع (رد فوري بدون API)
  const greetingResponse = getGreetingResponse(question);
  if (greetingResponse) {
    // نحفظ الترحيب في السجل ليعرف السياق
    addToHistory('user', question);
    addToHistory('assistant', greetingResponse);
    return greetingResponse;
  }

  // 🛡️ جلب البيانات الحية
  let freshSystemContext = "";
  try {
    freshSystemContext = await getSystemStatsForAI();
  } catch (e) {
    console.error("فشل استدعاء البيانات الحية:", e);
    freshSystemContext = "تنبيه: تعذر سحب البيانات الحية.";
  }

  // 🎯 تحديد أسلوب الرد حسب طول السؤال
  const isShortQuestion = question.length < 30;
  const responseStyle = isShortQuestion 
    ? 'أجب بإيجاز شديد (سطر واحد إلى سطرين فقط).' 
    : 'أجب بشكل مركّز (بحد أقصى 3 إلى 5 أسطر).';

  // 📝 بناء الرسالة الحالية (مع البيانات الحية)
  const currentUserMessage = {
    role: 'user',
    content: `[البيانات الحية من قاعدة البيانات]:
${freshSystemContext}

[تعليمات الرد]:
- ${responseStyle}
- لا تستخدم رموزاً تنسيقية أو رموزاً تعبيرية.
- اكتب بلغة عربية فصحى بسيطة وواضحة.
- لا تكرر البيانات من تلقاء نفسك.

[سؤال المستخدم]:
${question}`
  };

  // 🧠 بناء الرسائل الكاملة (System + History + Current)
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,      // 🎯 السياق السابق
    currentUserMessage           // 🎯 السؤال الحالي
  ];

  // 🚀 إرسال الطلب
  const response = await callCloudGroq(messages);

  // 🧠 حفظ التبادل في السجل
  addToHistory('user', question);
  addToHistory('assistant', response);

  return response;
}

// =========================================================
// 🛡️ دوال توافقية (للواجهات القديمة)
// =========================================================
export function startVoiceChat(onDataReady, onError) { 
  if (onError) onError('النظام يعمل حالياً بالنمط الكتابي والسحابي.'); 
}
export function stopVoiceRecognition() {}
export function startRecordingLocal(onDataReady, onError) { return startVoiceChat(onDataReady, onError); }
export function stopRecordingLocal() { return stopVoiceRecognition(); }

// =========================================================
// 🔊 دالة النطق الصوتي (محسّنة: تنظيف شامل)
// =========================================================
export function speakText(text, options = {}) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  // 🧹 تنظيف شامل للنص
  const cleanText = text
    // إزالة Markdown
    .replace(/[*#_~`>|]/g, ' ')
    // إزالة الشرطات المتعددة
    .replace(/[-]{2,}/g, ' ')
    // إزالة الرموز التعبيرية
    .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '')
    // إزالة الرموز الأخرى
    .replace(/[\[\]{}()<>]/g, ' ')
    // دمج المسافات
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'ar-SA';
  utterance.rate = options.rate || 1.0;
  utterance.pitch = options.pitch || 1.0;
  utterance.volume = options.volume || 1.0;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith('ar') &&
    (v.name.includes('Majed') || v.name.includes('Naeem') || v.name.includes('Maged'))
  ) || voices.find(v => v.lang.startsWith('ar-SA'))
    || voices.find(v => v.lang.startsWith('ar'));

  if (preferred) utterance.voice = preferred;

  if (options.onEnd) utterance.onend = options.onEnd;
  window.speechSynthesis.speak(utterance);
}

// =========================================================
// 📊 الدوال التحليلية الجاهزة
// =========================================================
export async function analyzeDailyAttendance() {
  return await askAI('حلل حالة الحضور اليوم باختصار وأعطِ التوصية الأهم.');
}

export async function predictAtRiskStudents() {
  return await askAI('اذكر الطلاب المعرضين للخطر مع توصية سريعة.');
}

export async function detectAnomalies() {
  return await askAI('هل هناك أنماط غير طبيعية اليوم؟ أجب باختصار.');
}

export async function getWeeklyRecommendations() {
  return await askAI('أعطني 3 توصيات استراتيجية سريعة بناءً على الحضور الأسبوعي.');
}

export async function comprehensiveAnalysis() {
  return await askAI('قدم خلاصة سريعة عن حالة النظام بنقاط واضحة.');
}

// =========================================================
// ⚙️ معلومات النموذج والإحصائيات
// =========================================================
export function isModelReady() { return isLoaded; }
export function isModelLoading() { return false; }
export async function unloadModel() { isLoaded = true; }

export function getModelInfo() {
  return { 
    الاسم: GROQ_MODEL, 
    المزود: 'Groq Cloud', 
    الحالة: 'جاهز ومستقر عبر الإنترنت',
    حفظ_السياق: `مُفعّل (آخر ${MAX_HISTORY_MESSAGES} رسائل)`
  };
}

export function getUsageStats() {
  return { 
    totalRequests, 
    successfulRequests,
    conversationLength: conversationHistory.length
  };
}
