// src/services/ai.js – المستشار الأكاديمي الذكي الخارق ومتعدد المهام | Qwen & Whisper | Groq API
import { getQuery } from './db';

// ========== حالة النظام ==========
let isLoaded = false;
let totalRequests = 0;
let successfulRequests = 0;

// ========== إعدادات مسجل الصوت المحلي (Whisper) ==========
let mediaRecorder = null;
let audioChunks = [];

// ========== إعدادات Groq الرسمية والمستقرة 2026 ==========
const GROQ_MODEL = 'qwen/qwen3.6-27b'; // الموديل الأساسي السريع لتحليل البيانات
const WHISPER_MODEL = 'whisper-large-v3-turbo'; // النسخة التوربو فائقة السرعة لمنع أخطاء الشبكة والتعليق
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

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

// ========== شخصية المستشار الأكاديمي الفائق ومتعدد المهام الشامل ==========
const SYSTEM_PROMPT = `أنت "المستشار الأكاديمي الذكي والنظام السيادي الخبير" المطور خصيصاً لجامعة القرآن الكريم والعلوم الإسلامية.
وظيفتك الإدارية والاستراتيجية هي تحليل جداول البيانات والإجابة على استفسارات الإدارة العليا والمشرفين بدقة متناهية وبسرعة فائقة.

[هيكلية قاعدة البيانات التي تفهمها وتحللها]
1. جدول الطلاب (students): يحتوي على (id, university_id, full_name, status, faculty, department).
2. جدول الحضور (attendance): يحتوي على (id, student_id, date, time_in, status ['present', 'absent', 'late'], method ['fingerprint', 'face', 'manual']).
3. جدول الجداول الدراسية (schedules): يحتوي على أوقات المحاضرات والمواد والأكاديميين.
4. جدول الأجهزة (devices): أجهزة البصمة والتحقق وحالتها (online/offline) ومواقعها.

[مصفوفة المهام المتطورة ومتعددة الوظائف (Multi-Tasking Mode)]
بناءً على طبيعة استفسار المشرف، حدد مسار عملك ونفذه فوراً:

- (المهمة 1: التدقيق الرقمي والإنذارات): تصنيف غياب الطلاب إلى ثلاث مستويات:
  * 🔴 خطر (غياب >= 30%) -> توصية بالفصل والحرمان النهائي.
  * 🟡 إنذار (غياب >= 20%) -> توصية بإصدار إنذار أكاديمي أول/ثاني.
  * 🟢 آمن ومراقب (غياب >= 10%).

- (المهمة 2: التحليل الإحصائي والمقارنة): تقديم نسب حضور دقيقة لكل كلية أو قسم مقارنة بالإجمالي.

- (المهمة 3: كشف الأمن والتلاعب البيومتري): التنبيه الفوري في حال وجود أنماط تسجيل حضور يدوي متكررة (Manual) لنفس الطالب أو حضور مسجل في أوقات خارج نطاق الجدول الدراسي.

- (المهمة 4: صياغة وإعداد رسائل الواتساب الذكية): إذا طلب منك المستخدم كتابة رسالة أو إنذار لعائلة الطالب، قم بصياغة نص رسالة رسمية، تربوية، ومؤثرة جداً جاهزة للإرسال الفوري عبر الواتساب لأولياء الأمور تتضمن اسم الطالب ونسبة غيابه بشكل منسق.

- (المهمة 5: صيانة ومراقبة البنية التحتية): تحليل حالة أجهزة البصمة (Devices)؛ وتقديم توصيات فورية بنقل الأجهزة أو صيانتها إذا كانت حالتها (Offline).

[محددات صارمة وقاطعة لمنع الهلوسة والأغاني]
- اعتمد بنسبة 100% على البيانات الممررة. يمنع منعاً باتاً اختراع أي معلومات أو الحديث في مواضيع خارج النطاق الأكاديمي والجامعي (مثل الفن، أو الأغاني، أو نانسي عجرم، أو غيرها).
- إذا كان النص المستلم فارغاً أو يحتوي على ضوضاء غير مفهومة، أجب بـ: "عذراً مدير النظام، لم أسمع استفسارك الأكاديمي بوضوح، يرجى تكرار السؤال."
- أجب باللغة العربية الفصحى الاحترافية والردود المقتضبة والذكية لضمان سرعة النطق التلقائي.`;

// ==========================================
// ١. تحميل النموذج
// ==========================================
export async function loadMobileModel(onProgress) {
  const apiKey = getApiKey();
  if (!apiKey) {
    isLoaded = false;
    if (onProgress) onProgress('❌ لم يتم تعيين مفتاح AI');
    return false;
  }

  isLoaded = true;
  if (onProgress) onProgress('✅ المستشار الأكاديمي جاهز');
  console.log(`✅ المستشار الأكاديمي الذكي جاهز ومفعّل باستخدام (${GROQ_MODEL})`);
  return true;
}

// ==========================================
// ٢. محرك الذكاء الاصطناعي (دقة متناهية وحرارة منخفضة)
// ==========================================
async function callGroq(messages, maxTokens = 250, temperature = 0.2) {
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
        temperature: temperature, // تم خفض الحرارة لمنع الهلوسة نهائياً والالتزام بالبرومبت
        max_tokens: maxTokens,
        top_p: 0.85,
        frequency_penalty: 0.2,
        presence_penalty: 0.1
      })
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ استجابة Groq:', response.status, errorText);
      throw new Error(`خطأ في استجابة الخادم: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;

    if (!answer || answer.length < 5) {
      return '⚠️ لم يتمكن المستشار الأكاديمي من تحليل البيانات بوضوح. يرجى المحاولة مرة أخرى.';
    }

    successfulRequests++;
    isLoaded = true;
    console.log(`✅ استجابة AI في (${elapsed}ms) باستخدام ${GROQ_MODEL}`);
    return answer.trim();
  } catch (e) {
    console.error('❌ خطأ في معالجة طلب Groq:', e);
    return '⚠️ تعذر الاتصال بالمستشار الأكاديمي. تأكد من الإنترنت ومفتاح الـ API.';
  }
}

// ==========================================
// ٣. واجهة الأسئلة العامة
// ==========================================
export async function askAI(question, context = '', options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) return '⚠️ لم يتم تعيين مفتاح AI.';

  if (!isLoaded) {
    const loaded = await loadMobileModel();
    if (!loaded) return '⚠️ تعذر الاتصال بالمستشار الأكاديمي. تحقق من مفتاحك.';
  }

  const {
    maxTokens = 250,
    temperature = 0.2,
    detailed = false,
    role = 'مشرف النظام'
  } = options;

  const detailLevel = detailed ? 'قدم تحليلاً شاملاً مع التوصيات العملية والحلول.' : 'أجب بوضوح واختصار شديد ومباشر.';

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `[المستخدم: ${role}]\n${detailLevel}\n\nالبيانات المتاحة حالياً في النظام:\n${context || 'لا توجد بيانات ممررة.'}\n\nالسؤال الحالي: ${question}` }
  ];

  return await callGroq(messages, maxTokens, temperature);
}

// ==========================================
// ٤. تحليلات جاهزة (باستخدام SQLite للجامعة)
// ==========================================
export async function analyzeDailyAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const students = await getQuery("SELECT * FROM students WHERE status = 'active'") || [];
  const todayData = await getQuery("SELECT * FROM attendance WHERE date = ?", [today]) || [];

  const present = todayData.filter(a => a.status === 'present').length;
  const absent = todayData.filter(a => a.status === 'absent').length;
  const late = todayData.filter(a => a.status === 'late').length;
  const rate = students.length > 0 ? Math.round((present / students.length) * 100) : 0;

  const context = `حاضر: ${present} (${rate}%)، غائب: ${absent}، متأخر: ${late}، إجمالي المسجلين: ${students.length}`;
  return await askAI('حلل حالة الحضور اليوم باختصار وأعطِ التوصية الأهم وفقط.', context, { maxTokens: 120 });
}

export async function predictAtRiskStudents() {
  const students = await getQuery("SELECT * FROM students WHERE status = 'active'") || [];
  const attendance = await getQuery("SELECT * FROM attendance") || [];

  const analysis = [];
  for (const s of students) {
    const sA = attendance.filter(a => a.student_id === s.id);
    if (sA.length === 0) continue;
    const absences = sA.filter(a => a.status === 'absent').length;
    const rate = Math.round((absences / sA.length) * 100);

    if (rate >= 10) {
      analysis.push({ الاسم: s.full_name, نسبة_الغياب: `${rate}%`, مستوى_الخطر: rate >= 30 ? '🔴 خطر' : '🟡 إنذار' });
    }
  }

  if (analysis.length === 0) return '✅ جميع الطلاب منتظمون ونسبة غيابهم آمنة أقل من 10%.';

  analysis.sort((a, b) => parseInt(b.نسبة_الغياب) - parseInt(a.نسبة_الغياب));
  return await askAI('اذكر الطلاب المعرضين للخطر وتوصية سريعة لهم.', JSON.stringify(analysis.slice(0, 5)), { maxTokens: 180 });
}

export async function detectAnomalies() {
  const today = new Date().toISOString().slice(0, 10);
  const todayData = await getQuery("SELECT * FROM attendance WHERE date = ?", [today]) || [];
  const context = `إجمالي العمليات اليوم: ${todayData.length}`;
  return await askAI('هل هناك أنماط غير طبيعية اليوم؟ أجب بوضوح واختصار.', context, { maxTokens: 100 });
}

export async function getWeeklyRecommendations() {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const startDate = weekStart.toISOString().slice(0, 10);
  const weekData = await getQuery("SELECT * FROM attendance WHERE date >= ?", [startDate]) || [];
  
  const absences = weekData.filter(a => a.status === 'absent').length;
  const present = weekData.filter(a => a.status === 'present').length;
  const context = `إحصائيات الأسبوع: حضور ${present} | غياب ${absences}`;

  return await askAI('أعطني 3 توصيات استراتيجية سريعة ومباشرة بناءً على الحضور الأسبوعي.', context, { maxTokens: 150 });
}

export async function comprehensiveAnalysis() {
  const today = new Date().toISOString().slice(0, 10);
  const students = await getQuery("SELECT * FROM students WHERE status = 'active'") || [];
  const context = `تقرير شامل: إجمالي الطلاب ${students.length}، تاريخ اليوم ${today}`;
  return await askAI('قدم خلاصة سريعة جداً عن حالة النظام بنقاط رصاصية.', context, { maxTokens: 150, role: 'المدير التنفيذي للتحليل' });
}

// ==========================================
// ٥. نظام معالجة الصوت المستقر والمحمي لـ Electron (Groq Whisper)
// ==========================================
export async function transcribeAudioLocal(audioBlob) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('لم يتم تعيين مفتاح الذكاء الاصطناعي.');

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    // تمرير الحزمة باسم ملف بامتداد mp3 صريح لحل مشكلة تعليق الشبكة HTTP2 في كروميوم
    formData.append('file', audioBlob, 'speech.mp3');
    formData.append('model', WHISPER_MODEL); 
    formData.append('language', 'ar');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', GROQ_WHISPER_URL, true);
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.text);
      } else {
        console.error('❌ استجابة سيرفر Whisper فشلت:', xhr.status, xhr.responseText);
        reject(new Error(`خطأ في معالج الصوت كود: ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => reject(new Error('خطأ في بروتوكولات اتصال الشبكة بالصوت'));
    xhr.send(formData);
  });
}

export async function startRecordingLocal(onDataReady, onError) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    // استخدام صيغة audio/webm المعتمدة والسيادية لنواة الـ Electron على الويندوز
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      // كبح ومنع إرسال المقاطع الصامتة أو الفارغة نهائياً لقطع دابر الهلوسة بالأغاني
      if (audioBlob.size < 2000) { 
        onError('⚠️ المقطع الصوتي قصير جداً أو صامت، يرجى التحدث بوضوح.');
        return;
      }

      try {
        const text = await transcribeAudioLocal(audioBlob);
        onDataReady(text);
      } catch (err) {
        console.error(err);
        onError('❌ فشل تحويل الإشارة الصوتية، تحقق من جودة الإنترنت أو مفتاح الـ API.');
      }
      
      // تحرير الميكروفون فوراً من نظام الويندوز لضمان عدم تعليقه
      stream.getTracks().forEach(track => track.stop());
    };

    // جمع البيانات كبث متدفق خفيف كل ثانية لتجنب الضغط المفاجئ للذاكرة
    mediaRecorder.start(1000);
  } catch (err) {
    onError('❌ لم يتم العثور على ميكروفون نشط أو تم رفض صلاحية الوصول.');
  }
}

export function stopRecordingLocal() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

export function stopVoiceRecognition() { stopRecordingLocal(); }
export function startVoiceChat(onDataReady, onError) { startRecordingLocal(onDataReady, onError); }

// دالة النطق المحلية المتزنة لسرعة الاستجابة
export function speakText(text, options = {}) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel(); 

  const { rate = 1.0, pitch = 1.0, volume = 1.0, onEnd = null } = options;
  
  // تنظيف الرد من أي إيموجي قد يربك عملية النطق التلقائي
  const cleanText = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '');
  
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'ar-SA';
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;

  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('ar') &&
      (v.name.includes('Majed') || v.name.includes('Naeem') || v.name.includes('Google') || v.name.includes('Maged'))
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

// ==========================================
// ٦. دوال مساعدة وضبط الحالة
// ==========================================
export function isModelReady() { return isLoaded && !!getApiKey(); }
export function isModelLoading() { return false; }
export async function unloadModel() { isLoaded = false; }

export function getModelInfo() {
  return {
    الاسم: GROQ_MODEL,
    المزود: 'Groq API',
    النوع: 'سحابي فائق السرعة ومتعدد المهام + معالج Whisper Turbo',
    السرعة: '⚡ طلقة فائقة الاستجابة للبيانات والصوت',
    الحالة: (isLoaded && getApiKey()) ? '✅ جاهز ومحدث ومؤمن' : '❌ غير متصل',
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
