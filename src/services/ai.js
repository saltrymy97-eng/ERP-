// src/services/ai.js – المستشار الأكاديمي الذكي | Llama 3.2 1B | Groq API
// أعلى مستويات الاحترافية – ذكاء متقدم – تحليل عميق – توصيات استراتيجية
// المفتاح يُقرأ من الإعدادات (Settings → 🧠 المستشار الذكي)
import { getQuery } from './db';

// ========== حالة النظام ==========
let isLoaded = false;
let totalRequests = 0;
let successfulRequests = 0;
let recognition = null;

// ========== إعدادات Groq ==========
const GROQ_MODEL = 'llama-3.2-1b-preview';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ========== دالة جلب المفتاح من إعدادات النظام ==========
function getApiKey() {
  try {
    const saved = localStorage.getItem('ai_config');
    if (!saved) return null;
    const config = JSON.parse(saved);
    return config.enabled ? config.api_key : null;
  } catch (e) {
    return null;
  }
}

// ========== شخصية المستشار الأكاديمي (نسخة مطورة) ==========
const SYSTEM_PROMPT = `أنت "المستشار الأكاديمي الذكي" – الذكاء الاصطناعي الرسمي لجامعة القرآن الكريم والعلوم الإسلامية.
أنت لست مجرد مساعد... أنت شريك استراتيجي في صنع القرار الأكاديمي.

[هويتك الملكية]
- اسمك الرسمي: المستشار الأكاديمي الذكي
- تم تطويرك خصيصاً للجامعة
- تتحدث العربية الفصحى الميسرة بلمسة احترافية راقية
- خبير معتمد في التحليل الأكاديمي وإدارة الحضور والانضباط الطلابي

[قدراتك المتقدمة]
1. تحليل أنماط الغياب اليومية والأسبوعية والشهرية
2. توقع الطلاب المعرضين للتعثر الأكاديمي قبل حدوثه
3. اكتشاف الحالات الطارئة التي تحتاج تدخل فوري
4. تقديم توصيات استراتيجية قابلة للتنفيذ
5. كشف الأنماط غير الطبيعية والتلاعب في سجلات الحضور
6. تحليل أداء الكليات والأقسام ومقارنتها
7. اقتراح خطط تحسين نسبة الحضور

[منهجيتك في التحليل]
- تبدأ بذكر النسبة العامة للحضور
- تحدد النقاط الحرجة بالأرقام
- تصنف الحالات حسب الأولوية: 🔴 خطر → 🟡 إنذار → 🟢 مراقبة
- تقدم توصيات محددة وقابلة للتنفيذ فوراً
- تختم بخلاصة واضحة

[أسلوبك]
- احترافي وراقي
- موجز لكن عميق
- تستعمل الأرقام والنسب بدقة
- لا تكرر المعلومات العامة
- تخاطب المستخدم بصفته الرسمية (مدير النظام / المشرف الأكاديمي)`;

// ==========================================
// ١. تحميل النموذج (يقرأ المفتاح من الإعدادات ديناميكياً)
// ==========================================

export async function loadMobileModel(onProgress) {
  const apiKey = getApiKey();
  if (!apiKey) {
    isLoaded = false; // إعادة ضبط الحالة في حال تم إلغاء المفتاح من الإعدادات
    if (onProgress) onProgress('❌ لم يتم تعيين مفتاح AI');
    console.error('❌ لا يوجد مفتاح API. اذهب إلى الإعدادات → المستشار الذكي.');
    return false;
  }

  if (onProgress) onProgress('⚡ جاري الاتصال بالخادم الذكي...');

  try {
    const test = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      })
    });

    if (!test.ok) throw new Error('تعذر الاتصال');

    isLoaded = true;
    if (onProgress) onProgress('✅ المستشار الأكاديمي جاهز');
    console.log('✅ المستشار الأكاديمي الذكي جاهز (Llama 3.2 1B)');
    return true;
  } catch (e) {
    isLoaded = false;
    console.error('❌ فشل الاتصال:', e);
    if (onProgress) onProgress('❌ تعذر الاتصال بالخادم');
    return false;
  }
}

// ==========================================
// ٢. محرك الذكاء الاصطناعي (نسخة متقدمة)
// ==========================================

async function callGroq(messages, maxTokens = 300, temperature = 0.4) {
  const apiKey = getApiKey();
  if (!apiKey) return '⚠️ لم يتم تعيين مفتاح الذكاء الاصطناعي. اذهب إلى ⚙️ الإعدادات → 🧠 المستشار الذكي.';

  totalRequests++;
  const startTime = Date.now();

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: 0.92,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`خطأ ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;

    if (!answer || answer.length < 10) {
      return '⚠️ لم يتمكن المستشار الأكاديمي من تحليل البيانات. يرجى المحاولة مرة أخرى.';
    }

    successfulRequests++;
    isLoaded = true; // تأكيد جاهزية النظام طالما استجاب بنجاح
    console.log(`✅ استجابة AI (${elapsed}ms)`);
    return answer.trim();
  } catch (e) {
    console.error('❌ خطأ Groq:', e);
    return '⚠️ تعذر الاتصال بالمستشار الأكاديمي. تأكد من الاتصال بالإنترنت وصحة المفتاح.';
  }
}

// ==========================================
// ٣. واجهة الأسئلة العامة
// ==========================================

export async function askAI(question, context = '', options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return '⚠️ لم يتم تعيين مفتاح AI. اذهب إلى ⚙️ الإعدادات → 🧠 المستشار الذكي.';

  // الفحص الفوري لكسر تعليق القراءة لمرة واحدة عند الإقلاع
  if (!isLoaded) {
    const loaded = await loadMobileModel();
    if (!loaded) return '⚠️ تعذر الاتصال بالمستشار. تأكد من صحة المفتاح في الإعدادات ومن توفر الإنترنت.';
  }

  const {
    maxTokens = 300,
    temperature = 0.4,
    detailed = false,
    role = 'مدير النظام'
  } = options;

  const detailLevel = detailed
    ? 'قدم تحليلاً مفصلاً وعميقاً. اشرح الأسباب والنتائج والتوصيات.'
    : 'قدم تحليلاً موجزاً. ركز على النقاط الحرجة.';

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `[المستخدم: ${role}]\n${detailLevel}\n\nالبيانات المتاحة:\n${context || 'لا توجد بيانات محددة.'}\n\nالسؤال: ${question}\n\nالمطلوب: تحليل احترافي مع توصيات قابلة للتنفيذ.` }
  ];

  return await callGroq(messages, maxTokens, temperature);
}

// ==========================================
// ٤. تحليلات جاهزة (نسخة مطورة)
// ==========================================

export async function analyzeDailyAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];
  const schedules = getQuery('schedules') || [];

  const todayData = attendance.filter(a => a.date === today);
  const present = todayData.filter(a => a.status === 'present').length;
  const absent = todayData.filter(a => a.status === 'absent').length;
  const late = todayData.filter(a => a.status === 'late').length;
  const rate = students.length > 0 ? Math.round((present / students.length) * 100) : 0;

  const absentStudents = students.filter(s => {
    const todayRecord = todayData.find(a => a.student_id === s.id);
    return !todayRecord || todayRecord.status === 'absent';
  }).slice(0, 5);

  const context = [
    `📅 التاريخ: ${today}`,
    `👥 إجمالي الطلاب المسجلين: ${students.length}`,
    `📚 عدد المحاضرات اليوم: ${schedules.length}`,
    ``,
    `📊 إحصائيات اليوم:`,
    `✅ حاضر: ${present} (${rate}%)`,
    `❌ غائب: ${absent}`,
    `⚠️ متأخر: ${late}`,
    ``,
    `👤 أول 5 طلاب غائبين: ${absentStudents.map(s => s.full_name).join('، ') || 'لا يوجد'}`
  ].join('\n');

  return await askAI(
    'قدم تحليلاً احترافياً لحالة اليوم. ما هي النقاط الحرجة؟ من يحتاج متابعة فورية؟ ما توصياتك؟',
    context,
    { maxTokens: 250 }
  );
}

export async function predictAtRiskStudents() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];

  const analysis = students.map(s => {
    const sA = attendance.filter(a => a.student_id === s.id);
    if (sA.length === 0) return null;
    const absences = sA.filter(a => a.status === 'absent').length;
    const lates = sA.filter(a => a.status === 'late').length;
    const rate = Math.round((absences / sA.length) * 100);

    if (rate >= 10) {
      return {
        الاسم: s.full_name,
        الرقم_الجامعي: s.university_id,
        نسبة_الغياب: `${rate}%`,
        عدد_الغيابات: absences,
        عدد_التأخيرات: lates,
        مستوى_الخطر: rate >= 30 ? '🔴 خطر (يحتاج تدخل فوري)' : rate >= 20 ? '🟡 إنذار (يحتاج متابعة)' : '🟢 مراقبة'
      };
    }
    return null;
  }).filter(Boolean).sort((a, b) => parseInt(b.نسبة_الغياب) - parseInt(a.نسبة_الغياب));

  if (analysis.length === 0) {
    return '✅ تقرير الطلاب المعرضين للخطر:\n\nجميع الطلاب منتظمون. لا توجد حالات تستدعي القلق. نسبة الغياب عند جميع الطلاب أقل من 10%.';
  }

  const context = JSON.stringify(analysis.slice(0, 10), null, 2);
  return await askAI(
    'حلل قائمة الطلاب المعرضين للخطر. من الأكثر إلحاحاً؟ ما الإجراءات المقترحة لكل حالة؟',
    context,
    { maxTokens: 350, detailed: true }
  );
}

export async function detectAnomalies() {
  const attendance = getQuery('attendance') || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayData = attendance.filter(a => a.date === today);

  const byHour = {};
  todayData.forEach(a => {
    if (a.time_in) {
      const hour = a.time_in.split(':')[0];
      byHour[hour] = (byHour[hour] || 0) + 1;
    }
  });

  const byMethod = {};
  todayData.forEach(a => {
    const method = a.method || 'غير معروف';
    byMethod[method] = (byMethod[method] || 0) + 1;
  });

  const context = [
    `📊 إجمالي عمليات اليوم: ${todayData.length}`,
    `🕐 توزيع أوقات الدخول: ${JSON.stringify(byHour)}`,
    `📝 طرق التسجيل: ${JSON.stringify(byMethod)}`
  ].join('\n');

  return await askAI(
    'افحص هذه البيانات. هل هناك أنماط غير طبيعية؟ هل هناك شك في تلاعب؟ ما هي توصياتك للتحقيق؟',
    context,
    { maxTokens: 250 }
  );
}

export async function getWeeklyRecommendations() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const startDate = weekStart.toISOString().slice(0, 10);
  const weekData = attendance.filter(a => a.date >= startDate);
  const absences = weekData.filter(a => a.status === 'absent').length;
  const late = weekData.filter(a => a.status === 'late').length;
  const present = weekData.filter(a => a.status === 'present').length;
  const total = present + absences + late;
  const weekRate = total > 0 ? Math.round((present / total) * 100) : 0;

  const context = [
    `📊 إحصائيات الأسبوع (${startDate} – اليوم):`,
    `✅ حضور: ${present}`,
    `❌ غياب: ${absences}`,
    `⚠️ تأخير: ${late}`,
    `📈 نسبة الحضور: ${weekRate}%`,
    `👥 إجمالي الطلاب: ${students.length}`
  ].join('\n');

  return await askAI(
    'بناءً على بيانات الأسبوع، قدم 5 توصيات استراتيجية محددة لتحسين نسبة الحضور في الأسبوع القادم. رتبها حسب الأولوية.',
    context,
    { maxTokens: 400, detailed: true }
  );
}

export async function comprehensiveAnalysis() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];
  const devices = getQuery('devices') || [];
  const notifications = getQuery('notifications') || [];
  const schedules = getQuery('schedules') || [];

  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter(a => a.date === today);
  const present = todayAttendance.filter(a => a.status === 'present').length;
  const absent = todayAttendance.filter(a => a.status === 'absent').length;

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const todayNotifications = notifications.filter(n => n.sent_at?.startsWith(today)).length;

  const context = [
    `🏫 جامعة القرآن الكريم والعلوم الإسلامية – تقرير الحالة الشامل`,
    `📅 تاريخ التقرير: ${today}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📊 الحالة العامة:`,
    `👥 إجمالي الطلاب: ${students.length}`,
    `📚 المحاضرات: ${schedules.length}`,
    `🖐️ أجهزة البصمة: ${devices.length} (${onlineDevices} متصل | ${devices.length - onlineDevices} غير متصل)`,
    ``,
    `📈 إحصائيات اليوم:`,
    `✅ حضور: ${present}`,
    `❌ غياب: ${absent}`,
    `📱 إشعارات مرسلة: ${todayNotifications}`,
    ``,
    `📊 أداء النظام:`,
    `🧠 إجمالي استدعاءات AI: ${totalRequests}`,
    `✅ استدعاءات ناجحة: ${successfulRequests}`
  ].join('\n');

  return await askAI(
    'قدم تقريراً شاملاً عن حالة النظام. ما هي أبرز الملاحظات؟ ما التوصيات الاستراتيجية للتحسين؟',
    context,
    { maxTokens: 450, detailed: true, role: 'المدير التنفيذي للنظام' }
  );
}

// ==========================================
// ٥. المحادثة الصوتية المتقدمة
// ==========================================

export function startVoiceRecognition(callback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    callback('❌ متصفحك لا يدعم التعرف على الصوت. يرجى استعمال Google Chrome.', null);
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  let finalText = '';

  recognition.onstart = () => { finalText = ''; };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalText += event.results[i][0].transcript;
      }
    }
  };

  recognition.onerror = (event) => {
    const errors = {
      'not-allowed': '❌ الرجاء السماح للميكروفون في إعدادات المتصفح.',
      'no-speech': '❌ لم يتم اكتشاف أي صوت. حاول مرة أخرى.',
      'audio-capture': '❌ لا يوجد ميكروفون متاح.',
      'network': '⚠️ مشكلة في الاتصال.',
      'aborted': '⏹️ تم إيقاف التسجيل.'
    };
    callback(errors[event.error] || `❌ خطأ: ${event.error}`, null);
  };

  recognition.onend = () => {
    callback(null, finalText.trim() || null);
  };

  recognition.start();
  return recognition;
}

export function stopVoiceRecognition() {
  if (recognition) { recognition.stop(); recognition = null; }
}

export function speakText(text, options = {}) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const { rate = 0.95, pitch = 0.9, volume = 1.0, onEnd = null } = options;

  // إصلاح تسمية الكائن البرمجي هنا
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-SA';
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;

  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('ar') &&
      (v.name.includes('Majed') || v.name.includes('Naeem') || v.name.includes('Natural') || v.name.includes('Google'))
    );
    const fallback = voices.find(v => v.lang.startsWith('ar'));
    utterance.voice = preferred || fallback || voices[0];
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    setVoice();
  } else {
    window.speechSynthesis.onvoiceschanged = setVoice;
  }
}

export async function startVoiceChat(onThinking) {
  return new Promise((resolve) => {
    startVoiceRecognition(async (error, text) => {
      if (error) { resolve({ error, question: null, answer: null }); return; }
      if (!text) { resolve({ error: null, question: null, answer: null }); return; }
      if (onThinking) onThinking(true);
      const answer = await askAI(text);
      if (onThinking) onThinking(false);
      speakText(answer, {
        rate: 0.9,
        pitch: 0.85,
        onEnd: () => resolve({ error: null, question: text, answer })
      });
    });
  });
}

// ==========================================
// ٦. دوال مساعدة
// ==========================================

export function isModelReady() { return isLoaded && !!getApiKey(); }
export function isModelLoading() { return false; }
export async function unloadModel() { isLoaded = false; }

export function getModelInfo() {
  const currentKey = getApiKey();
  return {
    الاسم: 'Llama 3.2 1B Preview',
    المزود: 'Groq API',
    النوع: 'سحابي – يحتاج إنترنت',
    السرعة: '⚡ فوري',
    السعر: '🆓 مجاني',
    الحالة: (isLoaded && currentKey) ? '✅ جاهز' : '❌ غير متصل (تأكد من المفتاح)',
    إجمالي_الاستدعاءات: totalRequests,
    الاستدعاءات_الناجحة: successfulRequests
  };
}

export function getUsageStats() {
  return {
    totalRequests,
    successfulRequests,
    failedRequests: totalRequests - successfulRequests,
    successRate: totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0
  };
}
