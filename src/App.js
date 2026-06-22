// src/App.js – نظام الحضور والغياب بأيقونات 3D ذهبية وقوائم منسدلة (الإصدار الملكي الفاخر)
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

  // ========== بدء التشغيل والتهيئة (شاشة التحميل السينمائية) ==========
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

      // انتظار لمدة 5 ثوانٍ لإعطاء هيبة ووقار لشاشة التحميل أمام اللجنة
      await new Promise(resolve => setTimeout(resolve, 5000));

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

  // ========== مصفوفة الأيقونات ثلاثية الأبعاد والقوائم المنسدلة ==========
  const mainIcons = [
    { 
      id: 'dashboard', 
      title: 'لوحة التحكم', 
      icon: '📊', 
      color: '#D4AF37', 
      desc: 'الإحصائيات المتقدمة والتنبيهات', 
      subItems: [] 
    },
    { 
      id: 'students', 
      title: 'الطلاب والكليات', 
      icon: '🎓', 
      color: '#0d5c41', 
      desc: 'إدارة الكليات، الأقسام، والتخصصات', 
      subItems: [
        { title: '🏫 الكليات والأقسام الأكاديمية', screen: 'students' }, 
        { title: '📜 التخصصات والخطط الدراسية', screen: 'students' }, 
        { title: '👥 إدارة سجلات الطلاب وبطاقاتهم', screen: 'students' }
      ]
    },
    { 
      id: 'attendance', 
      title: 'الحضور والغياب', 
      icon: '🖐️', 
      color: '#38bdf8', 
      desc: 'رصد الحضور المباشر ببصمة الإصبع', 
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
      color: '#ff9100', 
      desc: 'تصدير كشوفات PDF و Excel ذكية', 
      subItems: [
        { title: '📈 التقارير اليومية الإجمالية', screen: 'reports' }, 
        { title: '📅 التقارير الدورية والشهرية للمواد', screen: 'reports' }, 
        { title: '👤 ملف الغياب التفصيلي للطالب', screen: 'reports' }, 
        { title: '🏆 مؤشر انضباط الكليات والأقسام', screen: 'reports' }
      ]
    },
    { 
      id: 'notifications', 
      title: 'نظام الإشعارات', 
      icon: '🔔', 
      color: '#ff4d4d', 
      desc: 'إرسال رسائل WhatsApp تلقائية لأولياء الأمور', 
      subItems: [] 
    },
    { 
      id: 'devices', 
      title: 'أجهزة البصمة', 
      icon: '🖨️', 
      color: '#a855f7', 
      desc: 'ربط ومراقبة أجهزة الحضور أوفلاين', 
      subItems: [] 
    },
    { 
      id: 'calendar', 
      title: 'التقويم الأكاديمي', 
      icon: '📅', 
      color: '#00e676', 
      desc: 'جدولة الفصول الدراسية والإجازات الرسمية', 
      subItems: [] 
    },
    { 
      id: 'settings', 
      title: 'إعدادات النظام', 
      icon: '⚙️', 
      color: '#64748b', 
      desc: 'إدارة صلاحيات المستخدمين والنسخ الاحتياطي', 
      subItems: [
        { title: '🔌 إعدادات ربط أجهزة البصمة', screen: 'settings' }, 
        { title: '💬 تهيئة بوابة الـ WhatsApp API', screen: 'settings' }, 
        { title: '👥 صلاحيات الموظفين والمستخدمين', screen: 'settings' }, 
        { title: '💾 النسخ الاحتياطي للأقراص المحلية', screen: 'settings' }
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

  // 1️⃣ الشاشة السينمائية الأولى: شاشة التحميل (Splash Screen)
  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <motion.div 
            className="splash-logo-3d"
            animate={{ scale: [0.9, 1.05, 0.9], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            🏛️
          </motion.div>
          <h1>جامعة القرآن الكريم والعلوم الإسلامية</h1>
          <h3>نظام الحضور والغياب الذكي للأقسام الأكاديمية</h3>
          <div className="splash-loader"></div>
        </div>
      </div>
    );
  }

  // 2️⃣ الشاشة الثانية: واجهة تسجيل الدخول الزجاجية الملكية
  if (!user) {
    return (
      <div className="login-screen">
        <motion.div 
          className="login-card"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 15 }}
        >
          <motion.div 
            className="login-logo-3d"
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          >
            🏛️
          </motion.div>
          <h1>بوابة تسجيل الدخول</h1>
          <p>لوحة التحكم الإدارية لنظام الحضور والغياب</p>
          
          <div className="login-input-group">
            <label>رمز المرور الأمني للمنصة</label>
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
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

  // 3️⃣ الشاشة الثالثة: سطح مكتب النظام الرئيسي وأيقونات الـ 3D الفخمة
  if (screen === 'home') {
    return (
      <div className="home-screen">
        <div className="home-bg">
          <div className="bg-orb bg-orb-1"></div>
          <div className="bg-orb bg-orb-2"></div>
          <div className="bg-orb bg-orb-3"></div>
        </div>
        
        <motion.header 
          className="home-header" 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div className="home-logo" whileHover={{ scale: 1.1, rotateY: 180 }} transition={{ duration: 0.6 }}>🏛️</motion.div>
          <h1>نظام إدارة الحضور والغياب الإلكتروني</h1>
          <p>شاشة الوصول السريع لأنظمة الكليات والخدمات الذكية</p>
        </motion.header>

        <div className="icons-grid">
          {mainIcons.map((icon, index) => (
            <motion.div 
              key={icon.id} 
              className="icon-wrapper" 
              initial={{ opacity: 0, y: 30 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: index * 0.06, type: 'spring', stiffness: 100 }}
            >
              <button
                className={`icon-card ${openMenu === icon.id ? 'active' : ''}`}
                onClick={() => handleIconClick(icon)}
              >
                <div className="icon-3d">
                  <span className="icon-main">{icon.icon}</span>
                </div>
                <h3 className="icon-title">{icon.title}</h3>
                <p className="icon-desc">{icon.desc}</p>
                {icon.subItems.length > 0 && (
                  <span className="dropdown-arrow">▼</span>
                )}
              </button>

              <AnimatePresence>
                {openMenu === icon.id && icon.subItems.length > 0 && (
                  <motion.div 
                    className="dropdown-panel" 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }} 
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    {icon.subItems.map((sub, subIndex) => (
                      <button 
                        key={`${sub.title}-${subIndex}`} 
                        className="dropdown-item" 
                        onClick={() => { setScreen(sub.screen); setOpenMenu(null); }}
                      >
                        <span>{sub.title}</span>
                        <span>←</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <motion.div 
          className="user-bar" 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.6 }}
        >
          <div className="user-info-block">
            <span>👤 المستخدم الحالي: <strong>{user?.username}</strong></span>
            <span className="user-role-badge">{user?.role === 'admin' ? 'المدير العام للنظام' : 'مسؤول النظام'}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>🚪 تسجيل الخروج الآمن</button>
        </motion.div>
      </div>
    );
  }

  // 4️⃣ الشاشة الرابعة والأخيرة: إطار تصفح الواجهات الداخلية للنظام (Sub-pages Framework)
  const getTitle = () => {
    const titles = { 
      'dashboard': '📊 لوحة التحكم والمؤشرات الإحصائية', 
      'students': '👥 إدارة سجلات الطلاب شؤون الطلاب', 
      'attendance': '🖐️ نظام رصد الحضور الإلكتروني وبصمة الإصبع', 
      'reports': '📄 مركز التقارير المتقدمة والكشوفات الرسمية', 
      'notifications': '🔔 نظام إشعارات الرسائل الفورية والتنبيهات', 
      'devices': '🖨️ إدارة ومراقبة ربط أجهزة البصمة المحلية', 
      'calendar': '📅 إدارة التقويم الدراسي والخطط الزمنية', 
      'settings': '⚙️ لوحة الإعدادات والصلاحيات العامة' 
    };
    return titles[screen] || 'النظام الأكاديمي للجامعة';
  };

  return (
    <div className="app-layout">
      <header className="top-bar">
        <button className="back-btn" onClick={() => setScreen('home')}>🏠 الشاشة الرئيسية</button>
        <h2>{getTitle()}</h2>
        
        <div className="header-status">
          <span className={`status-dot ${aiReady ? 'online' : 'offline'}`} style={{ backgroundColor: aiReady ? '#00e676' : '#ff4d4d' }}></span>
          <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>
            {aiReady ? 'محرك AI محلي نشط أوفلاين' : 'محرك الذكاء الاصطناعي معطل'}
          </span>
        </div>
        
        <button className="btn-logout-sm" onClick={handleLogout} title="تسجيل الخروج">🚪</button>
      </header>
      
      <main className="main-content">
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
