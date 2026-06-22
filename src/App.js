// src/App.js – نظام الحضور والغياب الإمبراطوري الحركي (أيقونات مجسمة ثلاثية الأبعاد وقوائم سيادية معزولة)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { initDatabase } from './services/db';
import { login, logout, restoreSession } from './services/auth';
import { loadMobileModel } from './services/ai';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Attendance from './components/Attendance';
import Reports from './components/Reports';
import Settings from './components/Settings';
import './App.css';

function App() {
  const [screen, setScreen] = useState('home');
  const [openMenu, setOpenMenu] = useState(null);
  const [user, setUser] = useState(null);
  const [aiReady, setAiReady] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(true);

  // ========== بدء التشغيل والتهيئة (شاشة التحميل السينمائية الإمبراطورية) ==========
  useEffect(() => {
    let isMounted = true;

    async function startup() {
      try { 
        await initDatabase(); 
      } catch(e) {
        console.error("Database initialization failed:", e);
      }
      
      restoreSession()
        .then(u => { if (isMounted && u) setUser(u); })
        .catch(() => {});
      
      loadMobileModel()
        .then(() => { if (isMounted) setAiReady(true); })
        .catch(() => {});

      // مهلة كافية لإبهار لجنة التحكيم عند الإقلاع الفاخر
      await new Promise(resolve => setTimeout(resolve, 3500));

      if (isMounted) setLoading(false);
    }

    startup();
    return () => { isMounted = false; };
  }, []);

  // ========== معالجة تسجيل الدخول الملكي ==========
  const handleLogin = async () => {
    if (!password.trim()) return;
    setLoginError('');
    const result = await login(password.trim());
    if (result.success) {
      setUser(result.user);
      setScreen('home');
      setPassword('');
    } else {
      setLoginError(result.message);
    }
  };

  // ========== تسجيل الخروج والعودة للقفل ==========
  const handleLogout = () => {
    logout();
    setUser(null);
    setScreen('login');
    setPassword('');
  };

  // ========== مصفوفة الأيقونات الضخمة ثلاثية الأبعاد والمجسمة هندسياً ==========
  const mainIcons = [
    { 
      id: 'dashboard', 
      title: 'لوحة التحكم', 
      icon: '📊', 
      color: '#D4AF37', 
      glow: 'rgba(214, 175, 55, 0.4)',
      desc: 'الإحصائيات المتقدمة والتحليلات البيومترية الحية', 
      subItems: [] 
    },
    { 
      id: 'students', 
      title: 'الطلاب والكليات', 
      icon: '🎓', 
      color: '#34d399', 
      glow: 'rgba(52, 211, 153, 0.4)',
      desc: 'إدارة الكليات، الأقسام، والتصنيفات الأكاديمية والطلاب', 
      subItems: [
        { title: '🏫 الكليات والأقسام الأكاديمية', screen: 'students' }, 
        { title: '📜 التخصصات والخطط الدراسية', screen: 'students' }, 
        { title: '👥 سجلات الطلاب والقبض البيومتري', screen: 'students' }
      ]
    },
    { 
      id: 'attendance', 
      title: 'الحضور والغياب', 
      icon: '🖐️', 
      color: '#38bdf8', 
      glow: 'rgba(56, 189, 248, 0.4)',
      desc: 'رصد حضور ومطابقة البصمة السحابية الفورية وتتبع الغياب', 
      subItems: [
        { title: '⚡ تسجيل الحضور المباشر الآن', screen: 'attendance' }, 
        { title: '📋 كشف الحضور والغياب لليوم', screen: 'attendance' }, 
        { title: '📊 السجل الشهري التراكمي للغياب', screen: 'attendance' }
      ]
    },
    { 
      id: 'reports', 
      title: 'مركز التقارير', 
      icon: '📄', 
      color: '#fb923c', 
      glow: 'rgba(251, 146, 60, 0.4)',
      desc: 'تصدير كشوفات وصكوك PDF و Excel ذكية بنقرة واحدة', 
      subItems: [
        { title: '📈 التقارير اليومية الإجمالية للكليات', screen: 'reports' }, 
        { title: '📅 التقارير الدورية والشهرية للمواد', screen: 'reports' }, 
        { title: '👤 ملف الغياب التفصيلي للطالب', screen: 'reports' }, 
        { title: '🏆 مؤشر انضباط الكليات والأقسام', screen: 'reports' }
      ]
    },
    { 
      id: 'notifications', 
      title: 'نظام الإشعارات', 
      icon: '🔔', 
      color: '#f87171', 
      glow: 'rgba(248, 113, 113, 0.4)',
      desc: 'بث رسائل WhatsApp Cloud API المؤتمتة لأولياء الأمور', 
      subItems: [] 
    },
    { 
      id: 'devices', 
      title: 'أجهزة البصمة', 
      icon: '🖨️', 
      color: '#c084fc', 
      glow: 'rgba(192, 132, 252, 0.4)',
      desc: 'ربط ومراقبة حيوية أجهزة الحضور الطرفية أوفلاين', 
      subItems: [] 
    },
    { 
      id: 'calendar', 
      title: 'التقويم الأكاديمي', 
      icon: '📅', 
      color: '#4ade80', 
      glow: 'rgba(74, 222, 128, 0.4)',
      desc: 'جدولة الفصول الدراسية والخطط الزمنية للمستويات', 
      subItems: [] 
    },
    { 
      id: 'settings', 
      title: 'إعدادات النظام', 
      icon: '⚙️', 
      color: '#94a3b8', 
      glow: 'rgba(148, 163, 184, 0.4)',
      desc: 'لوحة السيادة العليا وإدارة صلاحيات الموظفين والنسخ الاحتياطي', 
      subItems: [
        { title: '🔌 إعدادات ربط أجهزة البصمة', screen: 'settings' }, 
        { title: '💬 تهيئة بوابة الـ WhatsApp API', screen: 'settings' }, 
        { title: '👥 صلاحيات الموظفين والمستخدمين', screen: 'settings' }, 
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

  // 1️⃣ شاشة التحميل (Splash Screen)
  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <motion.div 
            className="splash-logo-3d"
            style={{ fontSize: '6rem', filter: 'drop-shadow(0 20px 40px rgba(214,175,55,0.4))' }}
            animate={{ 
              scale: [1, 1.1, 1], 
              rotateY: [0, 180, 360],
              y: [0, -15, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            🏛️
          </motion.div>
          <h1 style={{ fontFamily: 'Amiri, serif', fontSize: '2.5rem', color: '#f3e5ab', marginTop: '20px' }}>جامعة القرآن الكريم والعلوم الإسلامية</h1>
          <h3 style={{ fontWeight: 400, color: 'rgba(255,255,255,0.6)' }}>المنظومة الرقمية السيادية للحضور والغياب البيومتري</h3>
          <div className="splash-loader" style={{ borderColor: '#d4af37 transparent #d4af37 transparent' }}></div>
        </div>
      </div>
    );
  }

  // 2️⃣ واجهة تسجيل الدخول الزجاجية الملكية
  if (!user) {
    return (
      <div className="login-screen">
        <motion.div 
          className="login-card"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
        >
          <motion.div 
            className="login-logo-3d"
            style={{ fontSize: '5rem', filter: 'drop-shadow(0 15px 30px rgba(214,175,55,0.3))', marginBottom: '15px' }}
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          >
            🏛️
          </motion.div>
          <h1 style={{ fontFamily: 'Amiri, serif', fontSize: '2.2rem', color: '#f3e5ab' }}>بوابة السيطرة المركزية</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>يرجى إدخال شيفرة التصديق لتفويض الدخول للمنظومة</p>
          
          <div className="login-input-group">
            <label style={{ color: '#d4af37', fontWeight: 600 }}>رمز المرور الأمني للمنصة</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyPress={e => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
          </div>
          
          {loginError && <p className="login-error">⚠️ {loginError}</p>}
          
          <motion.button 
            className="login-btn"
            onClick={handleLogin}
            whileHover={{ scale: 1.03, boxShadow: '0 0 25px rgba(214,175,55,0.4)' }}
            whileTap={{ scale: 0.97 }}
            disabled={!password.trim()}
          >
            🔐 تصديق الدخول الآمن
          </motion.button>
          
          <p className="login-footer">
            جامعة القرآن الكريم والعلوم الإسلامية<br />
            فرع غيل باوزير - حضرموت
          </p>
        </motion.div>
      </div>
    );
  }

  // 3️⃣ سطح مكتب النظام الرئيسي (أيقونات 3D عملاقة وقوائم معزولة فوق الأبعاد)
  if (screen === 'home') {
    return (
      <div className="home-screen" style={{ overflowX: 'hidden' }}>
        <div className="home-bg">
          <div className="bg-orb bg-orb-1"></div>
          <div className="bg-orb bg-orb-2"></div>
          <div className="bg-orb bg-orb-3"></div>
        </div>
        
        <motion.header 
          className="home-header" 
          initial={{ opacity: 0, y: -30 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: 'spring' }}
        >
          <motion.div 
            className="home-logo" 
            style={{ fontSize: '5rem', filter: 'drop-shadow(0 15px 30px rgba(214,175,55,0.3))' }}
            whileHover={{ scale: 1.15, rotateY: 360 }} 
            transition={{ duration: 0.8 }}
          >
            🏛️
          </motion.div>
          <h1 style={{ fontFamily: 'Amiri, serif', fontSize: '2.6rem', color: '#f3e5ab', textShadow: '0 4px 15px rgba(0,0,0,0.6)' }}>نظام إدارة الحضور والغياب الإلكتروني</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.5px' }}>بوابة التوجيه السريع الكوانتية لأنظمة الكليات والخدمات الذكية للجامعة</p>
        </motion.header>

        <div className="icons-grid" style={{ padding: '30px 15px', position: 'relative' }}>
          {mainIcons.map((icon, index) => {
            const isMenuOpen = openMenu === icon.id;
            return (
              <motion.div 
                key={icon.id} 
                className="icon-wrapper" 
                initial={{ opacity: 0, y: 40 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 110 }}
                /* حل مشكلة التداخل السفلية: رفع الكرت المفتوح سيادياً فوق بقية العناصر */
                style={{ 
                  position: 'relative',
                  zIndex: isMenuOpen ? 9999 : 10,
                  transition: 'z-index 0.3s ease-in-out'
                }}
              >
                <button
                  className={`icon-card ${isMenuOpen ? 'active' : ''}`}
                  onClick={() => handleIconClick(icon)}
                  style={{
                    position: 'relative',
                    background: 'rgba(255, 255, 255, 0.02)',
                    backdropFilter: 'blur(15px)',
                    border: isMenuOpen ? `1px solid ${icon.color}` : '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: isMenuOpen ? `0 15px 40px ${icon.glow}` : '0 10px 30px rgba(0,0,0,0.3)'
                  }}
                >
                  {/* الأيقونة الـ 3D الضخمة والمتحركة تلقائياً وباللمس */}
                  <motion.div 
                    className="icon-3d"
                    style={{ 
                      fontSize: '4.5rem', 
                      display: 'block',
                      margin: '0 auto 15px auto',
                      filter: `drop-shadow(0 15px 20px ${icon.glow})`
                    }}
                    animate={{ 
                      y: isMenuOpen ? [0, -8, 0] : [0, -4, 0],
                      scale: isMenuOpen ? 1.12 : 1,
                      rotateY: isMenuOpen ? [0, 360] : 0
                    }}
                    transition={{ 
                      y: { repeat: Infinity, duration: isMenuOpen ? 1.5 : 3, ease: 'easeInOut' },
                      rotateY: { duration: 1.5, ease: 'easeInOut' }
                    }}
                    whileHover={{ scale: 1.2, rotate: [0, 5, -5, 0] }}
                  >
                    <span className="icon-main">{icon.icon}</span>
                  </motion.div>

                  <h3 className="icon-title" style={{ color: isMenuOpen ? icon.color : '#ffffff', fontSize: '1.4rem', fontWeight: 700 }}>{icon.title}</h3>
                  <p className="icon-desc" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>{icon.desc}</p>
                  
                  {icon.subItems.length > 0 && (
                    <motion.span 
                      className="dropdown-arrow" 
                      style={{ display: 'inline-block', marginTop: '10px', color: icon.color }}
                      animate={{ rotate: isMenuOpen ? 180 : 0 }}
                    >
                      ▼
                    </motion.span>
                  )}
                </button>

                {/* لوحة القائمة المنسدلة المرفوعة سيادياً فوق جميع الكروت */}
                <AnimatePresence>
                  {isMenuOpen && icon.subItems.length > 0 && (
                    <motion.div 
                      className="dropdown-panel" 
                      initial={{ opacity: 0, scaleY: 0, y: -10 }} 
                      animate={{ opacity: 1, scaleY: 1, y: 0 }} 
                      exit={{ opacity: 0, scaleY: 0, y: -10 }} 
                      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                      style={{ 
                        transformOrigin: 'top center',
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#041d14',
                        border: `1px solid ${icon.color}`,
                        borderRadius: '0 0 20px 20px',
                        boxShadow: `0 20px 40px rgba(0,0,0,0.6), 0 0 30px ${icon.glow}`,
                        padding: '10px',
                        marginTop: '-10px',
                        zIndex: 100000 /* لضمان ظهور القائمة بالكامل وبأمان مطلق فوق الصفوف التالية */
                      }}
                    >
                      {icon.subItems.map((sub, subIndex) => (
                        <motion.button 
                          key={`${sub.title}-${subIndex}`} 
                          className="dropdown-item" 
                          onClick={() => { setScreen(sub.screen); setOpenMenu(null); }}
                          whileHover={{ x: -8, backgroundColor: 'rgba(255,255,255,0.03)', color: icon.color }}
                          style={{
                            display: 'flex',
                            justifyContent: 'between',
                            alignItems: 'center',
                            width: '100%',
                            padding: '14px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: '#e2e8f0',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            textAlign: 'right',
                            cursor: 'pointer',
                            borderBottom: subIndex !== icon.subItems.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                            transition: 'color 0.2s ease'
                          }}
                        >
                          <span style={{ flexGrow: 1 }}>{sub.title}</span>
                          <span style={{ fontSize: '1.1rem' }}>←</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <motion.div 
          className="user-bar" 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.5 }}
        >
          <div className="user-info-block">
            <span>👤 السحابة الأمنية للمستخدم: <strong style={{ color: '#d4af37' }}>{user?.username}</strong></span>
            <span className="user-role-badge" style={{ background: 'linear-gradient(135deg, #0d5c41, #041d14)', border: '1px solid #d4af37', color: '#f3e5ab' }}>
              {user?.role === 'admin' ? 'السيادة الإدارية العليا للمنظومة' : 'مسؤول الرصد المعتمد'}
            </span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>🚪 تدمير الجلسة وتسجيل الخروج الآمن</button>
        </motion.div>
      </div>
    );
  }

  // 4️⃣ إطار تصفح الواجهات الداخلية للنظام (Sub-pages Framework)
  const getTitle = () => {
    const titles = { 
      'dashboard': '📊 لوحة التحكم والمؤشرات الإحصائية العامة', 
      'students': '👥 إدارة سجلات القبض البيومتري وشؤون الطلاب', 
      'attendance': '🖐️ منظومة الرصد الاستراتيجي والمطابقة الفورية لبصمة الإصبع', 
      'reports': '📄 مركز استخراج الصكوك والبيانات التحليلية للغياب (PDF)', 
      'notifications': '🔔 بوابة تكامل WhatsApp Cloud API للبث التلقائي', 
      'devices': '🖨️ المراقبة الحيوية لربط أجهزة البصمة المحلية', 
      'calendar': '📅 جدولة الفصول والخطط الزمنية للتقويم الأكاديمي', 
      'settings': '⚙️ المركز السيادي لإدارة الصلاحيات والنسخ الاحتياطي للنظام' 
    };
    return titles[screen] || 'المنظومة الرقمية السيادية للجامعة';
  };

  return (
    <div className="app-layout">
      <header className="top-bar" style={{ background: '#041d14', borderBottom: '1px solid rgba(214,175,55,0.2)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
        <button className="back-btn" onClick={() => setScreen('home')} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(214,175,55,0.3)', color: '#f3e5ab' }}>🏠 البوابة الرئيسية</button>
        <h2 style={{ fontFamily: 'Amiri, serif', color: '#ffffff', fontSize: '1.5rem', fontWeight: 700 }}>{getTitle()}</h2>
        
        <div className="header-status" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '50px' }}>
          <span className={`status-dot ${aiReady ? 'online' : 'offline'}`} style={{ backgroundColor: aiReady ? '#34d399' : '#f87171', boxShadow: aiReady ? '0 0 10px #34d399' : '0 0 10px #f87171' }}></span>
          <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
            {aiReady ? 'محرك الحسابات الذكي (AI) نشط أوفلاين' : 'معالجة العقل الاصطناعي قيد التهيأة'}
          </span>
        </div>
        
        <button className="btn-logout-sm" onClick={handleLogout} title="تدمير الجلسة الآمنة" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>🚪</button>
      </header>
      
      <main className="main-content" style={{ background: '#03140e' }}>
        {screen === 'dashboard' && <Dashboard />}
        {screen === 'students' && <Students />}
        {screen === 'attendance' && <Attendance />}
        {screen === 'reports' && <Reports />}
        {screen === 'settings' && <Settings />}
        {screen === 'notifications' && <Settings />}
        {screen === 'devices' && <Settings />}
        {screen === 'calendar' && <Settings />}
      </main>
    </div>
  );
}

export default App;
