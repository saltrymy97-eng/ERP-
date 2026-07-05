// src/App.js – نظام إدارة الحضور والغياب البيومتري الإمبراطوري المطور
// هندسة بصرية فائقة الفخامة + جناح التوجيه الاستراتيجي المحلي وعقدة الأجرام السبعة السيادية
// مطور النظام الإمبراطوري: المهندس سالم فهمي التريمي
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { initDatabase } from './services/db';
import { login, logout, restoreSession } from './services/auth';
import { askAI, speakText, subscribeToAIState, AI_STATES } from './services/ai';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Attendance from './components/Attendance';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Teachers from './components/Teachers';

// استيراد صورة شعار الجامعة المعتمدة
import universityLogo from './24664.jpg';
import './App.css';

// ========== حركات الرسوم الفاخرة الموحدة (Global Motion Variants) ==========
const FADE_IN_UP = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 80, damping: 15 } }
};

const MODAL_ANIMS = {
  hidden: { opacity: 0, scale: 0.9, y: 20, backdropFilter: 'blur(0px)' },
  visible: { opacity: 1, scale: 1, y: 0, backdropFilter: 'blur(25px)', transition: { type: 'spring', duration: 0.5 } },
  exit: { opacity: 0, scale: 0.95, y: 10, backdropFilter: 'blur(0px)', transition: { duration: 0.3 } }
};

// ========== مكون الأيقونة الكريستالية السائلة الحركية الفاخرة ==========
function CrystalOrbIcon({ icon, orbClass, aiState }) {
  const isThinking = aiState === AI_STATES.THINKING;
  const isTyping = aiState === AI_STATES.TYPING;

  return (
    <motion.div 
      className={`icon-3d-container ${orbClass}`}
      animate={{
        scale: isThinking ? [1, 1.12, 1] : isTyping ? [1, 1.04, 1] : [1, 1.03, 1],
        rotate: isThinking ? 360 : 0,
        boxShadow: isThinking 
          ? '0 0 40px rgba(214, 175, 55, 0.6), inset 0 0 20px rgba(214, 175, 55, 0.4)' 
          : isTyping ? '0 0 40px rgba(0, 255, 136, 0.5), inset 0 0 20px rgba(0, 255, 136, 0.3)' : '0 15px 30px rgba(0,0,0,0.5)'
      }}
      transition={{ 
        scale: { repeat: Infinity, duration: isThinking ? 1.5 : 3, ease: "easeInOut" },
        rotate: { repeat: Infinity, duration: 8, ease: "linear" }
      }}
    >
      <div className="icon-3d-aura" style={{
        background: isThinking ? 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 70%)' : isTyping ? 'radial-gradient(circle, rgba(0,255,136,0.3) 0%, transparent 70%)' : ''
      }}></div>
      <div className="icon-3d-liquid">
        <span className="icon-3d-fallback" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>
          {isThinking ? '🔮' : isTyping ? '✍️' : icon}
        </span>
      </div>
    </motion.div>
  );
}

// ========== مكون جناح الحوار الاستراتيجي للمستشار الأكاديمي المحلي ==========
function AIChatModal({ onClose, aiState }) {
  const [inputMessage, setInputMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', text: 'مرحباً بك في المنظومة الرقمية السيادية للمستشار الأكاديمي الذكي. اكتب استفسارك الإداري هنا وسأقوم بتحليل قاعدة البيانات فوراً ومحلياً 100% وبدون إنترنت.' }
  ]);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, aiState]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || aiState === AI_STATES.THINKING) return;

    const userQuery = inputMessage.trim();
    setChatHistory(prev => [...prev, { role: 'user', text: userQuery }]);
    setInputMessage('');

    try {
      // 🌟 التعديل الإمبراطوري لربط البيانات الحية تلقائياً 🌟
      let systemContext = "أنت المستشار الأكاديمي الذكي للمنظومة الإمبراطورية المعتمدة.";
      
      try {
        // سحب إحصائيات النظام الحالية المخزنة محلياً لتمريرها مع الطلب
        const systemStats = localStorage.getItem('dashboard_stats_summary') || 'متوفرة في الـ SQLite محلياً وجاري جردها من الكشوفات';
        systemContext += `\nمعطيات النظام الحالية المستخرجة من قاعدة البيانات الحية: ${systemStats}`;
      } catch (dbErr) {
        console.log("فشل جلب سياق قاعدة البيانات الحية:", dbErr);
      }

      // دمج سياق النظام والبيانات مع سؤالك الفعلي في حزمة واحدة
      const fullPrompt = `${systemContext}\n\nبناءً على هذه المعطيات، أجب على الاستفسار التالي بدقة إدارية: ${userQuery}`;

      const answer = await askAI(fullPrompt);
      setChatHistory(prev => [...prev, { role: 'bot', text: answer }]);
      speakText(answer);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'bot', text: '❌ واجه المستشار عارضاً تقنياً أثناء تحليل المعطيات أو الاتصال بالخادم السحابي.' }]);
    }
  };

  return (
    <motion.div 
      variants={MODAL_ANIMS}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        background: 'linear-gradient(145deg, rgba(3, 18, 11, 0.98) 0%, rgba(1, 7, 4, 0.99) 100%)',
        border: '1px solid linear-gradient(to bottom, var(--gold-main), transparent)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.9), inset 0 1px 2px rgba(255,255,255,0.1), 0 0 50px rgba(212, 175, 55, 0.1)',
        borderRadius: '32px',
        padding: '30px',
        direction: 'rtl',
        textAlign: 'right',
        display: 'flex',
        flexDirection: 'column',
        height: '620px',
        maxWidth: '750px',
        margin: '20px auto',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '300px', height: '150px', background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 80%)', pointerEvents: 'none' }}></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(212,175,55,0.15)', paddingBottom: '15px', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.7rem', filter: 'drop-shadow(0 0 10px var(--gold-main))' }}>🤖</span>
          <h3 style={{ fontFamily: 'Amiri, serif', color: 'var(--gold-light)', fontSize: '1.5rem', margin: 0, letterSpacing: '0.5px' }}>جناح التوجيه الاستراتيجي والذكاء الاصطناعي</h3>
        </div>
        <motion.button 
          whileHover={{ scale: 1.15, rotate: 90 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose} 
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.5rem', padding: '5px' }}
        >✕</motion.button>
      </div>

      <div style={{ 
        flexGrow: 1, 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px', 
        padding: '15px 10px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.02)',
        boxShadow: 'inset 0 10px 30px rgba(0,0,0,0.5)'
      }}>
        {chatHistory.map((msg, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, x: msg.role === 'user' ? -15 : 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            style={{ 
              alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
              background: msg.role === 'user' ? 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.03) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
              border: msg.role === 'user' ? '1px solid rgba(212,175,55,0.25)' : '1px solid rgba(255,255,255,0.06)',
              padding: '14px 20px',
              borderRadius: msg.role === 'user' ? '22px 22px 0px 22px' : '22px 22px 22px 0px',
              maxWidth: '80%',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              backdropFilter: 'blur(5px)'
            }}
          >
            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: msg.role === 'user' ? 'var(--gold-light)' : '#34d399', marginBottom: '6px' }}>
              {msg.role === 'user' ? '👤 الاستفسار الإداري السيادي:' : '🤖 المستشار التحليلي للمنظومة:'}
            </strong>
            <span style={{ lineHeight: '1.7', fontSize: '1rem', color: '#e2e8f0' }}>{msg.text}</span>
          </motion.div>
        ))}
        {aiState === AI_STATES.THINKING && (
          <motion.div 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{ alignSelf: 'flex-end', background: 'rgba(212,175,55,0.04)', padding: '12px 20px', borderRadius: '22px 22px 22px 0px', border: '1px solid rgba(212,175,55,0.2)' }}
          >
            <span style={{ color: 'var(--gold-light)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🤖 تفكير عميق: جاري سحب الجداول وحساب نسب الحضور والغياب محلياً عبر Llama...
            </span>
          </motion.div>
        )}
        <div ref={chatBottomRef} />
      </div>

      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', marginTop: '20px', zIndex: 2 }}>
        <input 
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={aiState === AI_STATES.THINKING ? "جاري تحليل المعطيات الإحصائية..." : "اكتب أمرك أو استفسارك الأكاديمي هنا..."}
          disabled={aiState === AI_STATES.THINKING}
          style={{ 
            flexGrow: 1, 
            background: 'rgba(1, 10, 5, 0.6)', 
            border: '1px solid rgba(212,175,55,0.3)', 
            borderRadius: '16px', 
            padding: '15px 20px', 
            color: '#ffffff', 
            outline: 'none',
            fontSize: '1rem',
            transition: 'border-color 0.3s',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--gold-main)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(212,175,55,0.3)'}
        />
        <motion.button 
          whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(212,175,55,0.4)' }}
          whileTap={{ scale: 0.97 }}
          type="submit" 
          disabled={!inputMessage.trim() || aiState === AI_STATES.THINKING} 
          style={{ 
            background: 'linear-gradient(135deg, var(--gold-dark) 0%, var(--emerald-dark) 100%)', 
            border: '1px solid var(--gold-main)', 
            borderRadius: '16px', 
            color: '#ffffff', 
            padding: '0 35px', 
            cursor: 'pointer',
            fontSize: '1.05rem',
            fontWeight: 'bold',
            fontFamily: 'Amiri, serif',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}
        >
          تحليل سيادي
        </motion.button>
      </form>
    </motion.div>
  );
}

// ========== مكون بطاقة الأيقونة الرئيسية المطور بصرياً وهندسياً ==========
function IconCard({ icon, index, openMenu, onIconClick, setScreen, setOpenMenu, aiState }) {
  const isMenuOpen = openMenu === icon.id;

  const getOrbClass = (id) => {
    switch (id) {
      case 'dashboard': return 'student-orb';
      case 'attendance': return 'attendance-orb';
      case 'students': return 'student-orb';
      case 'teachers': return 'attendance-orb';
      case 'reports': return 'report-orb';
      case 'ai_advisor': return 'ai-robot-orb'; 
      case 'settings': return 'settings-orb';
      default: return 'report-orb';
    }
  };

  return (
    <motion.div
      className="icon-wrapper"
      variants={FADE_IN_UP}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.06 }}
      style={{ zIndex: isMenuOpen ? 999999 : 10 }}
    >
      <div
        className={`icon-card ${isMenuOpen ? 'active' : ''} ${icon.id === 'settings' ? 'settings-card' : ''}`}
        onClick={() => onIconClick(icon)}
        style={{
          position: 'relative',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <CrystalOrbIcon icon={icon.icon} orbClass={getOrbClass(icon.id)} aiState={icon.id === 'ai_advisor' ? aiState : null} />

        <h3 className="icon-title" style={{ fontFamily: 'Amiri, serif', letterSpacing: '0.3px' }}>{icon.title}</h3>
        <p className="icon-desc">{icon.desc}</p>

        {icon.subItems.length > 0 && (
          <motion.span
            className="dropdown-arrow"
            style={{ display: 'inline-block', marginTop: '10px', color: icon.color }}
            animate={{ rotate: isMenuOpen ? 180 : 0 }}
          >
            ▼
          </motion.span>
        )}

        <AnimatePresence>
          {isMenuOpen && icon.subItems.length > 0 && (
            <motion.div
              className="dropdown-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'absolute', top: '102%', left: 0, right: 0 }}
            >
              {icon.subItems.map((sub, subIndex) => (
                <button
                  key={`${sub.title}-${subIndex}`}
                  className="dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScreen(sub.screen);
                    setOpenMenu(null);
                  }}
                >
                  <span>{sub.title}</span>
                  <span style={{ fontSize: '1.2rem' }} className="arrow-transition">←</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ========== التطبيق الرئيسي للنظام الأكاديمي البيومتري ==========
function App() {
  const [screen, setScreen] = useState('home');
  const [openMenu, setOpenMenu] = useState(null);
  const [user, setUser] = useState(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [aiState, setAiState] = useState(AI_STATES.IDLE);

  useEffect(() => {
    let isMounted = true;
    async function startup() {
      try {
        await initDatabase();
        if (isMounted) setDbReady(true);
      } catch (e) {
        console.error("Database initialization failed:", e);
      }
      restoreSession()
        .then(u => { if (isMounted && u) setUser(u); })
        .catch(() => {});
    }
    startup();

    const unsubscribe = subscribeToAIState((newState) => {
      setAiState(newState);
    });

    return () => { 
      isMounted = false; 
      unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    if (!password.trim()) return;
    setLoginError('');
    setLoading(true);
    const result = await login(password.trim());
    setLoading(false);
    if (result.success) {
      setUser(result.user);
      setScreen('home');
      setPassword('');
    } else {
      setLoginError(result.message);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setScreen('login');
    setPassword('');
  };

  const mainIcons = [
    {
      id: 'dashboard',
      title: 'لوحة التحكم',
      icon: '📊',
      color: '#D4AF37',
      desc: 'الإحصائيات المتقدمة والتحليلات البيومترية الحية للكليات',
      subItems: []
    },
    {
      id: 'attendance',
      title: 'الحضور والغياب',
      icon: '🧬', 
      color: '#38bdf8',
      desc: 'رصد الحضور ومطابقة البصمة السحابية الفورية وتتبع الغياب',
      subItems: [
        { title: '⚡ تسجيل الحضور المباشر الآن', screen: 'attendance' },
        { title: '📋 كشف الحضور والغياب لليوم', screen: 'attendance' },
        { title: '📊 السجل الشهري التراكمي للغياب', screen: 'attendance' }
      ]
    },
    {
      id: 'students',
      title: 'الطلاب والكليات',
      icon: '🎓',
      color: '#34d399',
      desc: 'إدارة الكليات، الأقسام، والتصنيفات الأكاديمية والطلاب',
      subItems: [
        { title: '🏫 الكليات والأقسام الأكاديمية', screen: 'students' },
        { title: '📜 التخصصات والخطط الدراسية', screen: 'students' },
        { title: '👥 سجلات الطلاب والقبض البيومتري', screen: 'students' }
      ]
    },
    {
      id: 'teachers',
      title: 'هيئة التدريس',
      icon: '👨‍🏫',
      color: '#f472b6',
      desc: 'إدارة أعضاء هيئة التدريس والمحاضرين للكادر الأكاديمي',
      subItems: [
        { title: '👨‍🏫 قائمة المعلمين والكادر', screen: 'teachers' },
        { title: '📋 إضافة معلم وأستاذ جديد', screen: 'teachers' },
        { title: '📊 إحصائيات الكادر والأنشطة', screen: 'teachers' }
      ]
    },
    {
      id: 'reports',
      title: 'مركز التقارير',
      icon: '📄',
      color: '#fb923c',
      desc: 'تصدير كشوفات وصكوك PDF و Excel ذكية بنقرة واحدة',
      subItems: [
        { title: '📈 التقارير اليومية الإجمالية للكليات', screen: 'reports' },
        { title: '📅 التقارير الدورية والشهرية للمواد', screen: 'reports' },
        { title: '👤 ملف الغياب التفصيلي للطالب', screen: 'reports' }
      ]
    },
    {
      id: 'ai_advisor', 
      title: 'المستشار الذكي',
      icon: '🤖', 
      color: '#D4AF37',
      desc: 'محرك التحليل الاستراتيجي التوليدي المحلي الفوري للمنظومة',
      subItems: []
    },
    {
      id: 'settings',
      title: 'إعدادات النظام',
      icon: '⚙️',
      color: '#94a3b8',
      desc: 'لوحة السيادة العليا وإدارة صلاحيات الموظفين والنسخ الاحتياطي',
      subItems: [
        { title: '🔌 إعدادات ربط أجهزة البصمة', screen: 'settings' },
        { title: '💬 تهيئة بوابة الـ WhatsApp API', screen: 'settings' },
        { title: '💾 النسخ الاحتياطي لقواعد البيانات', screen: 'settings' }
      ]
    }
  ];

  const handleIconClick = (icon) => {
    if (icon.id === 'ai_advisor') {
      setScreen('ai_chat_view'); 
      setOpenMenu(null);
    } else if (icon.subItems.length > 0) {
      setOpenMenu(openMenu === icon.id ? null : icon.id);
    } else {
      setScreen(icon.id);
      setOpenMenu(null);
    }
  };

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-content" style={{ textAlign: 'center' }}>
          <motion.img 
            src={universityLogo} 
            alt="University Logo"
            className="uni-logo-3d" 
            animate={{ 
              scale: [1, 1.05, 1], 
              y: [0, -10, 0]
            }} 
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} 
            style={{ width: '150px', height: '150px', borderRadius: '50%' }}
          />
          <h3 style={{ fontFamily: 'Amiri, serif', fontWeight: 500, color: '#f3e5ab', marginTop: '25px', letterSpacing: '0.5px' }}>جاري تفويض الصلاحيات وتحديث الأجرام الكريستالية...</h3>
          <div className="splash-loader" style={{ margin: '20px auto' }}></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-screen">
        <motion.div className="login-card" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 20 }}>
          <motion.img 
            src={universityLogo} 
            alt="University Logo"
            className="uni-logo-3d"
            animate={{ rotateY: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            style={{ width: '130px', height: '130px', marginBottom: '15px', borderRadius: '50%' }}
          />
          <h1 style={{ fontFamily: 'Amiri, serif', fontSize: '2.5rem', color: '#f3e5ab', margin: '0 0 10px 0' }}>بوابة السيطرة المركزية</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '30px', fontSize: '0.95rem' }}>يرجى إدخال شيفرة التصديق لتفويض الدخول للمنظومة</p>
          <div className="login-input-group" style={{ marginBottom: '25px' }}>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="رمز المرور الأمني للمنصة" onKeyPress={e => e.key === 'Enter' && handleLogin()} autoFocus />
          </div>
          {loginError && <p style={{ color: '#ff4d4d', margin: '10px 0', fontSize: '0.95rem' }}>⚠️ {loginError}</p>}
          <button className="login-btn" onClick={handleLogin} disabled={!password.trim()}>🔐 تصديق الدخول الآمن</button>
        </motion.div>
      </div>
    );
  }

  if (screen === 'home') {
    return (
      <div className="home-screen">
        <div className="home-bg">
          <div className="bg-orb bg-orb-1"></div>
          <div className="bg-orb bg-orb-2"></div>
        </div>

        <header className="home-header" style={{ padding: '40px 20px 20px 20px', position: 'relative' }}>
          <motion.img 
            src={universityLogo} 
            alt="University Logo"
            className="uni-logo-3d"
            animate={{ 
              y: [0, -12, 0],
              filter: [
                'drop-shadow(0 0 15px rgba(214, 175, 55, 0.4)) border-shadow(0 0 5px rgba(214,175,55,0.2))',
                'drop-shadow(0 0 35px rgba(214, 175, 55, 0.8)) border-shadow(0 0 15px rgba(214,175,55,0.5))',
                'drop-shadow(0 0 15px rgba(214, 175, 55, 0.4)) border-shadow(0 0 5px rgba(214,175,55,0.2))'
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '140px', height: '140px', borderRadius: '50%', objectFit: 'cover' }}
          />
          
          <h1 style={{ fontFamily: 'Amiri, serif', fontSize: '2.8rem', color: '#ffffff', margin: '15px 0 10px 0' }}>
            نظام إدارة الحضور والغياب البيومتري
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', maxWidth: '700px', margin: '0 auto 10px auto' }}>
            البوابة الأكاديمية السيادية للتوجيه الفوري والربط الذكي للكليات
          </p>

          <div className="developer-signature" style={{ fontFamily: 'Amiri, serif', color: 'var(--gold-light)', fontSize: '1.1rem', opacity: 0.9, letterSpacing: '0.5px' }}>
            مطور النظام: <span style={{ color: '#ffffff', fontWeight: 'bold', textShadow: '0 0 10px var(--gold-main)' }}>سالم فهمي التريمي</span>
          </div>
        </header>

        <div className="icons-grid">
          {mainIcons.map((icon, index) => (
            <IconCard key={icon.id} icon={icon} index={index} openMenu={openMenu} onIconClick={handleIconClick} setScreen={setScreen} setOpenMenu={setOpenMenu} aiState={aiState} />
          ))}
        </div>

        <div className="user-bar">
          <div className="user-info-block" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ color: '#ffffff', fontSize: '0.95rem' }}>👤 السحابة الأمنية: <strong style={{ color: '#d4af37' }}>{user?.username}</strong></span>
            <span className="user-role-badge">
              {user?.role === 'admin' ? 'السيادة الإدارية العليا' : 'مسؤول رصد'}
            </span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>🚪 تسجيل الخروج الآمن</button>
        </div>
      </div>
    );
  }

  const getTitle = () => {
    const titles = {
      'dashboard': '📊 لوحة التحكم والمؤشرات الإحصائية العامة',
      'students': '👥 إدارة سجلات القبض البيومتري وشؤون الطلاب',
      'teachers': '👨‍🏫 إدارة هيئة التدريس والكادر الأكاديمي',
      'attendance': '🧬 منظومة الرصد الاستراتيجي والمطابقة الفورية',
      'reports': '📄 مركز استخراج الصكوك والبيانات التحليلية للغياب',
      'settings': '⚙️ المركز السيادي لإدارة الصلاحيات والنسخ الاحتياطي'
    };
    return titles[screen] || 'المنظومة الرقمية السيادية للجامعة';
  };

  return (
    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#010704' }}>
      <header className="top-bar" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="back-btn" onClick={() => setScreen('home')}>
          🏠 البوابة الرئيسية
        </motion.button>
        <h2 style={{ fontFamily: 'Amiri, serif', color: '#ffffff', fontSize: '1.6rem', margin: 0 }}>{getTitle()}</h2>
        <div className="header-status" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: dbReady ? '#00ff88' : '#ff3366', boxShadow: dbReady ? '0 0 12px #00ff88' : '0 0 12px #ff3366' }}></span>
          <span style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: '500' }}>{dbReady ? 'SQLite نشطة | الأجرام جاهزة' : 'جاري التهيئة...'}</span>
        </div>
      </header>

      <main className="main-content" style={{ flexGrow: 1, padding: '40px 30px', position: 'relative' }}>
        <AnimatePresence mode="wait">
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'students' && <Students />}
          {screen === 'teachers' && <Teachers />}
          {screen === 'attendance' && <Attendance />}
          {screen === 'reports' && <Reports />}
          {screen === 'settings' && <Settings />}
          {screen === 'ai_chat_view' && <AIChatModal onClose={() => setScreen('home')} aiState={aiState} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
