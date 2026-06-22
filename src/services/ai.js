// src/services/ai.js – ذكاء اصطناعي محلي متقدم + صوت كامل
// النموذج: Gemma 2B (Google) – يعمل بدون إنترنت – خصوصية كاملة
import { getQuery } from './db';

// ========== حالة النظام ==========
let model = null;
let isLoaded = false;
let isLoading = false;
let recognition = null;
let audioContext = null;

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
// ١. تحميل النموذج (مع تتبع التقدم)
// ==========================================

export async function loadMobileModel(onProgress) {
  if (isLoaded) return true;
  if (isLoading) {
    // انتظر حتى ينتهي التحميل
    while (isLoading) await new Promise(r => setTimeout(r, 500));
    return isLoaded;
  }

  isLoading = true;
  if (onProgress) onProgress('جاري تحميل النموذج... (0%)');

  try {
    const { pipeline } = await import('@xenova/transformers');

    if (onProgress) onProgress('جاري تحميل النموذج... (50%)');

    model = await pipeline('text-generation', 'Xenova/gemma-2-2b-it', {
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
    console.log('✅ AI محلي جاهز');
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
    maxTokens = 250,
    temperature = 0.4,
    detailed = false
  } = options;

  const detailLevel = detailed
    ? 'قدم تحليلاً مفصلاً وعميقاً. اشرح الأسباب والنتائج.'
    : 'كن موجزاً ومباشراً. ركز على النقاط الحرجة.';

  const prompt = `[INST] ${SYSTEM_PROMPT}

${detailLevel}

[البيانات المتاحة]
${context || 'لا توجد بيانات محددة.'}

[السؤال]
${question}

[تعليمات إضافية]
- إذا كانت البيانات غير كافية، قل ذلك بوضوح
- إذا لاحظت نمطاً خطيراً، نبه بعلامة ⚠️
- إذا كانت الحالة طبيعية، اذكر ذلك بإيجابية ✓
- قدم توصيات محددة وقابلة للتنفيذ
- استعمل تنسيقاً واضحاً مع نقاط رئيسية [/INST]`;

  try {
    const result = await model(prompt, {
      max_new_tokens: maxTokens,
      temperature: temperature,
      top_p: 0.9,
      repetition_penalty: 1.1
    });

    const answer = result[0]?.generated_text?.split('[/INST]')[1]?.trim();

    if (!answer || answer.length < 10) {
      return '⚠️ لم يتمكن الذكاء الاصطناعي من تحليل البيانات بشكل كافٍ. حاول إعادة الصياغة أو توفير بيانات أكثر.';
    }

    // تنظيف الرد
    return answer
      .replace(/\[INST\].*\[\/INST\]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (e) {
    console.error('خطأ AI:', e);
    return '⚠️ حدث خطأ في معالجة السؤال. تأكد من أن النموذج محمل بشكل صحيح.';
  }
}

// ==========================================
// ٣. تحليلات متقدمة جاهزة
// ==========================================

export async function analyzeDailyAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];

  const todayData = attendance.filter(a => a.date === today);
  const present = todayData.filter(a => a.status === 'present').length;
  const absent = todayData.filter(a => a.status === 'absent').length;
  const late = todayData.filter(a => a.status === 'late').length;
  const rate = students.length > 0 ? Math.round((present / students.length) * 100) : 0;

  const context = [
    `📅 التاريخ: ${today}`,
    `👥 إجمالي الطلاب: ${students.length}`,
    `✅ حاضر: ${present} (${rate}%)`,
    `❌ غائب: ${absent}`,
    `⚠️ متأخر: ${late}`
  ].join('\n');

  return await askAI(
    'قدم تحليلاً سريعاً لحالة اليوم. ما هي النقاط الحرجة؟ من يحتاج متابعة فورية؟',
    context,
    { maxTokens: 200 }
  );
}

export async function predictAtRiskStudents() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];

  const analysis = students.map(s => {
    const sAttendance = attendance.filter(a => a.student_id === s.id);
    if (sAttendance.length === 0) return null;

    const absences = sAttendance.filter(a => a.status === 'absent').length;
    const rate = Math.round((absences / sAttendance.length) * 100);

    if (rate >= 10) {
      return {
        name: s.full_name,
        id: s.university_id,
        absenceRate: rate,
        totalDays: sAttendance.length,
        absences: absences,
        risk: rate >= 30 ? '🔴 خطر' : rate >= 20 ? '🟡 إنذار' : '🟢 مراقبة'
      };
    }
    return null;
  }).filter(Boolean).sort((a, b) => b.absenceRate - a.absenceRate);

  if (analysis.length === 0) {
    return '✅ جميع الطلاب منتظمون. لا توجد حالات تستدعي القلق. نسبة الغياب عند جميع الطلاب أقل من 10%.';
  }

  const context = JSON.stringify(analysis.slice(0, 10), null, 2);
  return await askAI(
    'حلل قائمة الطلاب المعرضين للخطر. من الأكثر إلحاحاً؟ ما الإجراءات المقترحة لكل حالة؟',
    context,
    { maxTokens: 300, detailed: true }
  );
}

export async function detectAnomalies() {
  const attendance = getQuery('attendance') || [];
  const today = new Date().toISOString().slice(0, 10);

  const todayData = attendance.filter(a => a.date === today);

  // تحليل سريع للأنماط
  const byHour = {};
  todayData.forEach(a => {
    if (a.time_in) {
      const hour = a.time_in.split(':')[0];
      byHour[hour] = (byHour[hour] || 0) + 1;
    }
  });

  const context = [
    `📊 إجمالي عمليات اليوم: ${todayData.length}`,
    `🕐 توزيع أوقات الدخول: ${JSON.stringify(byHour)}`,
    `📝 طرق التسجيل: ${JSON.stringify(todayData.reduce((acc, a) => { acc[a.method || 'غير معروف'] = (acc[a.method || 'غير معروف'] || 0) + 1; return acc; }, {}))}`
  ].join('\n');

  return await askAI(
    'افحص هذه البيانات. هل هناك أنماط غير طبيعية؟ هل هناك شك في تلاعب؟',
    context,
    { maxTokens: 200 }
  );
}

export async function getWeeklyRecommendations() {
  const attendance = getQuery('attendance') || [];
  const students = getQuery('students') || [];

  // آخر 7 أيام
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const startDate = weekStart.toISOString().slice(0, 10);

  const weekData = attendance.filter(a => a.date >= startDate);
  const totalAbsences = weekData.filter(a => a.status === 'absent').length;
  const totalLate = weekData.filter(a => a.status === 'late').length;
  const totalPresent = weekData.filter(a => a.status === 'present').length;

  const context = [
    `📊 إحصائيات الأسبوع:`,
    `✅ حضور: ${totalPresent}`,
    `❌ غياب: ${totalAbsences}`,
    `⚠️ تأخير: ${totalLate}`,
    `👥 إجمالي الطلاب: ${students.length}`
  ].join('\n');

  return await askAI(
    'بناءً على بيانات الأسبوع، قدم 5 توصيات عملية ومحددة لتحسين نسبة الحضور في الأسبوع القادم.',
    context,
    { maxTokens: 350, detailed: true }
  );
}

export async function comprehensiveAnalysis() {
  const students = getQuery('students') || [];
  const attendance = getQuery('attendance') || [];
  const devices = getQuery('devices') || [];
  const notifications = getQuery('notifications') || [];

  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter(a => a.date === today);
  const present = todayAttendance.filter(a => a.status === 'present').length;
  const absent = todayAttendance.filter(a => a.status === 'absent').length;

  // تحليل شهري
  const monthStart = today.slice(0, 7) + '-01';
  const monthData = attendance.filter(a => a.date >= monthStart);
  const monthRate = students.length > 0
    ? Math.round((monthData.filter(a => a.status === 'present').length / (students.length * new Date().getDate())) * 100)
    : 0;

  const context = [
    `🏫 جامعة القرآن الكريم والعلوم الإسلامية`,
    `📅 ${today}`,
    ``,
    `📊 الحالة العامة:`,
    `👥 الطلاب: ${students.length}`,
    `📚 الكليات: ${new Set(students.map(s => s.college_id)).size || 0}`,
    `🖐️ أجهزة البصمة: ${devices.length} (${devices.filter(d => d.status === 'online').length} متصل)`,
    ``,
    `📈 اليوم:`,
    `✅ حاضر: ${present}`,
    `❌ غائب: ${absent}`,
    `📱 إشعارات: ${notifications.filter(n => n.sent_at?.startsWith(today)).length}`,
    ``,
    `📊 الشهر:`,
    `📈 نسبة الحضور التقريبية: ${monthRate}%`
  ].join('\n');

  return await askAI(
    'قدم تقريراً شاملاً عن حالة النظام. ما هي أبرز الملاحظات؟ ما التوصيات للتحسين؟',
    context,
    { maxTokens: 400, detailed: true }
  );
}

// ==========================================
// ٤. المحادثة الصوتية المتقدمة
// ==========================================

export function startVoiceRecognition(callback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    callback('❌ متصفحك لا يدعم التعرف على الصوت. استعمل Google Chrome.', null);
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA';
  recognition.continuous = false;
  recognition.interimResults = true; // تفعيل النتائج المؤقتة
  recognition.maxAlternatives = 3; // 3 احتمالات للنص

  let finalText = '';

  recognition.onstart = () => {
    finalText = '';
    console.log('🎤 جاري الاستماع...');
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalText += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    // تحديث مباشر للنص المؤقت
    if (callback && interim) {
      callback(null, finalText + ' ' + interim, true);
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
    if (finalText.trim()) {
      callback(null, finalText.trim());
    } else {
      callback(null, null);
    }
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

export function speakText(text, options = {}) {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const {
    rate = 0.95,
    pitch = 0.9,
    volume = 1.0,
    onEnd = null
  } = options;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-SA';
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;

  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    // أفضل صوت عربي رجالي
    const preferred = voices.find(v =>
      v.lang.startsWith('ar') &&
      (v.name.includes('Majed') || v.name.includes('Naeem') || v.name.includes('Natural'))
    );
    const fallback = voices.find(v => v.lang.startsWith('ar'));
    utterance.voice = preferred || fallback || voices[0];

    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    setVoice();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      setVoice();
    };
  }
}

export async function startVoiceChat(onThinking) {
  return new Promise((resolve) => {
    startVoiceRecognition(async (error, text, isInterim) => {
      // تجاهل النتائج المؤقتة
      if (isInterim) return;

      if (error) {
        resolve({ error, question: null, answer: null });
        return;
      }

      if (!text) {
        resolve({ error: null, question: null, answer: null });
        return;
      }

      if (onThinking) onThinking(true);

      // تحليل السؤال بالذكاء المحلي
      const answer = await askAI(text);

      if (onThinking) onThinking(false);

      // نطق الرد بصوت احترافي
      speakText(answer, {
        rate: 0.9,
        pitch: 0.85,
        onEnd: () => {
          resolve({ error: null, question: text, answer });
        }
      });
    });
  });
}

// ==========================================
// ٥. دوال مساعدة
// ==========================================

export function isModelReady() {
  return isLoaded;
}

export function isModelLoading() {
  return isLoading;
}

export async function unloadModel() {
  model = null;
  isLoaded = false;
  console.log('🧹 تم إلغاء تحميل النموذج.');
}

export function getModelInfo() {
  return {
    name: 'Gemma 2B (Google)',
    type: 'محلي - بدون إنترنت',
    status: isLoaded ? '✅ جاهز' : isLoading ? '⏳ جاري التحميل' : '❌ غير محمل',
    capabilities: [
      'تحليل الحضور',
      'توقع الطلاب المعرضين للخطر',
      'كشف الأنماط غير الطبيعية',
      'توصيات أسبوعية',
      'تحليل شامل',
      'محادثة صوتية'
    ]
  };
}
