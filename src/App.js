// src/App.js – نظام الحضور والغياب الإمبراطوري الحركي (أجرام كريستالية حركية + زر AI الصوتي الفاخر)
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { initDatabase } from './services/db';
import { login, logout, restoreSession } from './services/auth';
import { startVoiceChat, stopVoiceRecognition } from './services/ai'; // 🔥 استيراد محرك الصوت والذكاء الاصطناعي الحقيقي
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Attendance from './components/Attendance';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Teachers from './components/Teachers';
import './App.css';

// ========== مكون الأيقونة الكريستالية السائلة الحركية الفاخرة (بديل مكعبات الأطفال) ==========
function CrystalOrbIcon({ icon, orbClass }) {
  return (
    <div className={`icon-3d-container ${orbClass}`}>
      <div className="icon-3d-aura"></div>
      <div className="icon-3d-liquid">
        <span className="icon-3d-fallback">{icon}</span>
      </div>
    </div>
  );
}

// ========== مكون زر المحادثة الصوتية الفاخر بالذكاء الاصطناعي الحقيقي المتصل بـ Groq ==========
function AIVoiceWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [aiState, setAiState] = useState('idle'); // idle, listening, processing
  const [transcript, setTranscript] = useState('');

  // 🔥 طوق النجاة: تنظيف وإيقاف المايكروفون والنطق الآلي فوراً لو أغلق المستخدم النافذة فجأة
  useEffect(() => {
    return () => {
      stopVoiceRecognition();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [isOpen]);

  // 🔥 تشغيل جلسة المحادثة الصوتية التوليدية الحقيقية المربوطة بـ Groq والنطق البشري
  const handleVoiceSession = async () => {
    if (aiState === 'listening') {
      stopVoiceRecognition();
      setAiState('idle');
      setTranscript('⏹️ تم إيقاف الاستماع بطلب منك.');
      return;
    }

    setAiState('listening');
    setTranscript('🎙️ أنا أستمع إليك الآن... تحدث بوضوح وسؤالك سيُرسل للمستشار مباشرة.');

    const result = await startVoiceChat((isThinking) => {
      if (isThinking) {
        setAiState('processing');
        setTranscript('🔮 جاري معالجة صوتك وتوليد التحليل الأكاديمي التوليدي من Groq...');
      }
    });

    // معالجة الرد الصوتي والنصي القادم من الملف السيادي للذكاء الاصطناعي
    if (result.error) {
      setAiState('idle');
      setTranscript(result.error);
    } else if (result.question && result.answer) {
      setAiState('idle');
      setTranscript(`🗣️ أنت: "${result.question}"\n\n🤖 المستشار: "${result.answer}"`);
    } else {
      setAiState('idle');
      setTranscript('🔮 انقر مجدداً على الجرم الصوتي للتحدث مع المستشار.');
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '30px', left: '30px', zIndex: 999999 }}>
      {/* نافذة المحادثة الصوتية الزجاجية الفاخرة */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50, x: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50, x: -20 }}
            style={{
              width: '330px',
              background: 'rgba(2, 11, 7, 0.98)',
              backdropFilter: 'blur(30px)',
              border: '1px solid var(--gold-main)',
              borderRadius: '24px',
              padding: '20px',
              boxShadow: '0 30px 60px rgba(0,0,0,0.8), 0 0 40px rgba(212, 175, 55, 0.2)',
              marginBottom: '20px',
              direction: 'rtl',
              textAlign: 'right'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ fontFamily: 'Amiri, serif', color: 'var(--gold-light)', fontSize: '1.2rem', margin: 0 }}>المستشار الأكاديمي الصوتي الحقيقي</h4>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                }} 
                style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '1.1rem' }}
              >✕</button>
            </div>

            {/* الجرم الصوتي النابض المتفاعل مع حالة المحرك الحقيقي */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '15px 0' }}>
              <motion.div
                onClick={handleVoiceSession}
                animate={{
                  scale: aiState === 'listening' ? [1, 1.2, 1] : aiState === 'processing' ? [1, 1.08, 1] : 1,
                  boxShadow: aiState === 'listening' 
                    ? '0 0 35px #00ff88' 
                    : aiState === 'processing' ? '0 0 35px var(--gold-main)' : '0 0 20px rgba(212,175,55,0.3)'
                }}
                transition={{ repeat: Infinity, duration: aiState === 'listening' ? 1.2 : 2 }}
                style={{
                  width: '85px',
                  height: '85px',
                  borderRadius: '50%',
                  background: aiState === 'listening' 
                    ? 'radial-gradient(circle, #047857 0%, #062b1e 100%)'
                    : aiState === 'processing'
                    ? 'radial-gradient(circle, #b89324 0%, #041d14 100%)'
                    : 'radial-gradient(circle, var(--gold-light) 0%, var(--gold-dark) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '2.4rem'
                }}
              >
                {aiState === 'listening' ? '🛑' : aiState === 'processing' ? '🔮' : '🎙️'}
              </motion.div>
            </div>

            {/* نصوص الرد والتحليل الصوتي الحي الصادر من Groq */}
            <div style={{ 
              fontSize: '0.9rem', 
              color: '#cbd5e1', 
              maxHeight: '160px', 
              overflowY: 'auto', 
              padding: '5px', 
              whiteSpace: 'pre-line',
              lineHeight: '1.6',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              marginTop: '10px'
            }}>
              {transcript || 'انقر على المايكروفون، وسيتحدث معك المستشار الأكاديمي للجامعة فوراً بصوته ويبحث في قاعدة البيانات...'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* الزر الرئيسي العائم والمبهر للذكاء الاصطناعي */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        style={{
          width: '65px',
          height: '65px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--gold-dark), var(--emerald-light))',
          border: '2px solid var(--gold-main)',
          boxShadow: '0 10px 30px rgba(212, 175, 55, 0.4), inset 0 2px 5px rgba(255,255,255,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.8rem',
          outline: 'none'
        }}
      >
        🤖
      </motion.button>
    </div>
  );
}

// ========== مكون بطاقة الأيقونة الرئيسية المطور بصرياً وهندسياً ==========
function IconCard({ icon, index, openMenu, onIconClick, setScreen, setOpenMenu }) {
  const isMenuOpen = openMenu === icon.id;

  const getOrbClass = (id) => {
    switch (id) {
      case 'dashboard': return 'student-orb';
      case 'attendance': return 'attendance-orb';
      case 'students': return 'student-orb';
      case 'teachers': return 'attendance-orb';
      case 'reports': return 'report-orb';
      case 'settings': return 'settings-orb';
      default: return 'report-orb';
    }
  };

  return (
    <motion.div
      className="icon-wrapper"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 110 }}
      style={{ zIndex: isMenuOpen ? 99999 : 10 }}
    >
      <div
        className={`icon-card ${isMenuOpen ? 'active' : ''} ${icon.id === 'settings' ? 'settings-card' : ''}`}
        onClick={() => onIconClick(icon)}
      >
        <CrystalOrbIcon icon={icon.icon} orbClass={getOrbClass(icon.id)} />

        <h3 className="icon-title">{icon.title}</h3>
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
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {icon.subItems.map((sub, subIndex) => (
                <button
                  key={`${sub.title}-${subIndex}`}
                  className="dropdown-item"
                  onClick={() => {
                    setScreen(sub.screen);
                    setOpenMenu(null);
                  }}
                >
                  <span>{sub.title}</span>
                  <span style={{ fontSize: '1.1rem' }}>←</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ========== التطبيق الرئيسي للنظام الأكاديمي السيادي ==========
function App() {
  const [screen, setScreen] = useState('home');
  const [openMenu, setOpenMenu] = useState(null);
  const [user, setUser] = useState(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);

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
    return () => { isMounted = false; };
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
      icon: '🖐️',
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
      desc: 'إدارة أعضاء هيئة التدريس والمحاضرين والكادر الأكاديمي',
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
    if (icon.subItems.length > 0) {
      setOpenMenu(openMenu === icon.id ? null : icon.id);
    } else {
      setScreen(icon.id);
      setOpenMenu(null);
    }
  };

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <motion.div className="splash-logo-3d" animate={{ scale: [1, 1.05, 1], y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>🏛️</motion.div>
          <h3 style={{ fontWeight: 500, color: '#f3e5ab', marginTop: '20px' }}>جاري تفويض الصلاحيات وتحديث الأجرام الكريستالية...</h3>
          <div className="splash-loader"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-screen">
        <motion.div className="login-card" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}>
          <div className="login-logo-3d" style={{ fontSize: '5.5rem', marginBottom: '15px' }}>🏛️</div>
          <h1 style={{ fontFamily: 'Amiri, serif', fontSize: '2.4rem', color: '#f3e5ab' }}>بوابة السيطرة المركزية</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '25px' }}>يرجى إدخال شيفرة التصديق لتفويض الدخول للمنظومة</p>
          <div className="login-input-group" style={{ marginBottom: '25px' }}>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="رمز المرور الأمني للمنصة" onKeyPress={e => e.key === 'Enter' && handleLogin()} autoFocus />
          </div>
          {loginError && <p style={{ color: '#ff4d4d', margin: '10px 0' }}>⚠️ {loginError}</p>}
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

        <header className="home-header">
          <div className="home-logo">🏛️</div>
          <h1>نظام إدارة الحضور والغياب الإلكتروني الفاخر</h1>
          <p>البوابة الأكاديمية السيادية للتوجيه الفوري والربط الذكي للكليات</p>
        </header>

        <div className="icons-grid">
          {mainIcons.map((icon, index) => (
            <IconCard key={icon.id} icon={icon} index={index} openMenu={openMenu} onIconClick={handleIconClick} setScreen={setScreen} setOpenMenu={setOpenMenu} />
          ))}
        </div>

        {/* زر الذكاء الاصطناعي الصوتي المدمج الحقيقي */}
        <AIVoiceWidget />

        <div className="user-bar">
          <div className="user-info-block">
            <span style={{ color: '#ffffff' }}>👤 السحابة الأمنية: <strong style={{ color: '#d4af37' }}>{user?.username}</strong></span>
            <span className="user-role-badge">{user?.role === 'admin' ? 'السيادة الإدارية العليا' : 'مسؤول رصد'}</span>
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
      'attendance': '🖐️ منظومة الرصد الاستراتيجي والمطابقة الفورية',
      'reports': '📄 مركز استخراج الصكوك والبيانات التحليلية للغياب',
      'settings': '⚙️ المركز السيادي لإدارة الصلاحيات والنسخ الاحتياطي'
    };
    return titles[screen] || 'المنظومة الرقمية السيادية للجامعة';
  };

  return (
    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="top-bar">
        <button className="back-btn" onClick={() => setScreen('home')}>🏠 البوابة الرئيسية</button>
        <h2 style={{ fontFamily: 'Amiri, serif', color: '#ffffff', fontSize: '1.6rem' }}>{getTitle()}</h2>
        <div className="header-status" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: dbReady ? '#00ff88' : '#ff3366', boxShadow: dbReady ? '0 0 10px #00ff88' : '0 0 10px #ff3366' }}></span>
          <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>{dbReady ? 'SQLite نشطة | الأجرام جاهزة' : 'جاري التهيئة...'}</span>
        </div>
      </header>

      <main className="main-content" style={{ flexGrow: 1, padding: '30px', position: 'relative' }}>
        {screen === 'dashboard' && <Dashboard />}
        {screen === 'students' && <Students />}
        {screen === 'teachers' && <Teachers />}
        {screen === 'attendance' && <Attendance />}
        {screen === 'reports' && <Reports />}
        {screen === 'settings' && <Settings />}
      </main>
      
      {/* إتاحة المساعد الصوتي أيضاً في الشاشات الداخلية لسهولة الاستخدام */}
      <AIVoiceWidget />
    </div>
  );
}

export default App;
