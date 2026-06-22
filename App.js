// App.js – نظام الحضور والغياب بأيقونات 3D ذهبية وقوائم منسدلة
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { initDatabase, loadFromLocalStorage } from './services/db';
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
  const [dbReady, setDbReady] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(true);

  // ========== بدء التشغيل ==========
  useEffect(() => {
    async function startup() {
      const saved = await loadFromLocalStorage();
      if (!saved) await initDatabase();
      setDbReady(true);
      const savedUser = await restoreSession();
      if (savedUser) setUser(savedUser);
      loadMobileModel().then(() => setAiReady(true));
      setLoading(false);
    }
    startup();
  }, []);

  // ========== تسجيل الدخول ==========
  const handleLogin = async () => {
    setLoginError('');
    const result = await login(username, password);
    if (result.success) {
      setUser(result.user);
      setScreen('home');
    } else {
      setLoginError(result.message);
    }
  };

  // ========== تسجيل الخروج ==========
  const handleLogout = () => {
    logout();
    setUser(null);
    setScreen('login');
    setUsername('');
    setPassword('');
  };

  // ========== الأيقونات الرئيسية ==========
  const mainIcons = [
    {
      id: 'dashboard',
      title: 'لوحة التحكم',
      icon: '📊',
      color: '#D4AF37',
      gradient: 'linear-gradient(135deg, #D4AF37, #FCF6BA)',
      desc: 'الإحصائيات والتنبيهات',
      subItems: []
    },
    {
      id: 'students',
      title: 'الطلاب والكليات',
      icon: '👥',
      color: '#10B981',
      gradient: 'linear-gradient(135deg, #10B981, #34d399)',
      desc: 'إدارة الطلاب والكليات والأقسام',
      subItems: [
        { id: 'students-colleges', title: '🏫 الكليات والأقسام', screen: 'students', tab: 'colleges' },
        { id: 'students-majors', title: '🎓 التخصصات', screen: 'students', tab: 'majors' },
        { id: 'students-list', title: '👥 قائمة الطلاب', screen: 'students', tab: 'students' }
      ]
    },
    {
      id: 'attendance',
      title: 'الحضور والغياب',
      icon: '🖐️',
      color: '#3B82F6',
      gradient: 'linear-gradient(135deg, #3B82F6, #60a5fa)',
      desc: 'تسجيل حضور بالبصمة ومتابعة',
      subItems: [
        { id: 'att-live', title: '🖐️ تسجيل مباشر', screen: 'attendance', tab: 'live' },
        { id: 'att-today', title: '📋 حضور اليوم', screen: 'attendance', tab: 'today' },
        { id: 'att-month', title: '📊 شهري', screen: 'attendance', tab: 'monthly' }
      ]
    },
    {
      id: 'reports',
      title: 'التقارير',
      icon: '📄',
      color: '#F59E0B',
      gradient: 'linear-gradient(135deg, #F59E0B, #fbbf24)',
      desc: 'تقارير PDF و Excel',
      subItems: [
        { id: 'rep-daily', title: '📋 تقرير يومي', screen: 'reports', tab: 'daily' },
        { id: 'rep-monthly', title: '📊 تقرير شهري', screen: 'reports', tab: 'monthly' },
        { id: 'rep-student', title: '👤 تقرير طالب', screen: 'reports', tab: 'student' },
        { id: 'rep-discipline', title: '🏆 تقييم الانضباط', screen: 'reports', tab: 'discipline' }
      ]
    },
    {
      id: 'notifications',
      title: 'الإشعارات',
      icon: '🔔',
      color: '#EF4444',
      gradient: 'linear-gradient(135deg, #EF4444, #f87171)',
      desc: 'إشعارات واتساب لأولياء الأمور',
      subItems: []
    },
    {
      id: 'devices',
      title: 'أجهزة البصمة',
      icon: '🖨️',
      color: '#8B5CF6',
      gradient: 'linear-gradient(135deg, #8B5CF6, #a78bfa)',
      desc: 'إدارة ومراقبة الأجهزة',
      subItems: []
    },
    {
      id: 'calendar',
      title: 'التقويم',
      icon: '📅',
      color: '#06B6D4',
      gradient: 'linear-gradient(135deg, #06B6D4, #22d3ee)',
      desc: 'التقويم الأكاديمي',
      subItems: []
    },
    {
      id: 'settings',
      title: 'الإعدادات',
      icon: '⚙️',
      color: '#64748B',
      gradient: 'linear-gradient(135deg, #64748B, #94a3b8)',
      desc: 'إعدادات النظام والمستخدمين',
      subItems: [
        { id: 'set-devices', title: '🖐️ أجهزة البصمة', screen: 'settings', tab: 'devices' },
        { id: 'set-whatsapp', title: '💬 واتساب', screen: 'settings', tab: 'whatsapp' },
        { id: 'set-calendar', title: '📅 التقويم', screen: 'settings', tab: 'calendar' },
        { id: 'set-users', title: '👥 المستخدمين', screen: 'settings', tab: 'users' },
        { id: 'set-backup', title: '💾 نسخ احتياطي', screen: 'settings', tab: 'backup' }
      ]
    }
  ];

  // ========== التعامل مع الأيقونة ==========
  const handleIconClick = (icon) => {
    if (icon.subItems.length > 0) {
      setOpenMenu(openMenu === icon.id ? null : icon.id);
    } else {
      setScreen(icon.id);
      setOpenMenu(null);
    }
  };

  const handleSubItemClick = (subScreen) => {
    setScreen(subScreen);
    setOpenMenu(null);
  };

  // ========== شاشة التحميل ==========
  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <div className="splash-logo-3d">🏛️</div>
          <h1>نظام الحضور والغياب</h1>
          <p>جامعة القرآن الكريم والعلوم الإسلامية</p>
          <div className="splash-loader"></div>
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // ========== تسجيل الدخول ==========
  if (!user) {
    return (
      <div className="login-screen">
        <motion.div 
          className="login-card"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <motion.div 
            className="login-logo-3d"
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            🏛️
          </motion.div>
          <h1>تسجيل الدخول</h1>
          <p>نظام متابعة حضور وغياب الطلاب</p>

          <div className="login-input-group">
            <label>اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              onKeyPress={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div className="login-input-group">
            <label>كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              onKeyPress={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {loginError && <p className="login-error">{loginError}</p>}

          <motion.button 
            className="login-btn"
            onClick={handleLogin}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            دخول
          </motion.button>

          <p className="login-footer">
            جامعة القرآن الكريم والعلوم الإسلامية<br />
            فرع غيل باوزير - حضرموت
          </p>
        </motion.div>
      </div>
    );
  }

  // ========== الشاشة الرئيسية (الأيقونات) ==========
  if (screen === 'home') {
    return (
      <div className="home-screen">
        {/* خلفية متحركة */}
        <div className="home-bg">
          <div className="bg-orb bg-orb-1"></div>
          <div className="bg-orb bg-orb-2"></div>
          <div className="bg-orb bg-orb-3"></div>
        </div>

        {/* الهيدر */}
        <motion.header 
          className="home-header"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div 
            className="home-logo"
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            🏛️
          </motion.div>
          <h1>نظام متابعة الحضور والغياب</h1>
          <p>جامعة القرآن الكريم والعلوم الإسلامية</p>
        </motion.header>

        {/* شبكة الأيقونات */}
        <div className="icons-grid">
          {mainIcons.map((icon, index) => (
            <motion.div
              key={icon.id}
              className="icon-wrapper"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.button
                className={`icon-card ${openMenu === icon.id ? 'active' : ''}`}
                onClick={() => handleIconClick(icon)}
                whileHover={{ 
                  scale: 1.08,
                  y: -8,
                  boxShadow: `0 20px 40px ${icon.color}33`
                }}
                whileTap={{ scale: 0.95 }}
                style={{ 
                  borderColor: openMenu === icon.id ? icon.color : 'rgba(255,255,255,0.1)',
                  background: openMenu === icon.id ? `${icon.color}15` : 'rgba(255,255,255,0.03)'
                }}
              >
                {/* أيقونة 3D */}
                <motion.div 
                  className="icon-3d"
                  animate={{ 
                    rotateY: openMenu === icon.id ? [0, 10, -10, 0] : 0,
                    scale: openMenu === icon.id ? [1, 1.1, 1] : 1
                  }}
                  transition={{ duration: 2, repeat: openMenu === icon.id ? Infinity : 0 }}
                >
                  <motion.span 
                    className="icon-main"
                    style={{ 
                      background: icon.gradient,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      filter: `drop-shadow(0 0 20px ${icon.color}44)`
                    }}
                  >
                    {icon.icon}
                  </motion.span>
                </motion.div>

                {/* العنوان */}
                <h3 className="icon-title">{icon.title}</h3>
                <p className="icon-desc">{icon.desc}</p>

                {/* مؤشر القائمة المنسدلة */}
                {icon.subItems.length > 0 && (
                  <motion.span 
                    className="dropdown-arrow"
                    animate={{ rotate: openMenu === icon.id ? 180 : 0 }}
                  >
                    ▼
                  </motion.span>
                )}
              </motion.button>

              {/* القائمة المنسدلة */}
              <AnimatePresence>
                {openMenu === icon.id && icon.subItems.length > 0 && (
                  <motion.div
                    className="dropdown-panel"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    style={{ borderColor: icon.color }}
                  >
                    {icon.subItems.map((sub, subIndex) => (
                      <motion.button
                        key={sub.id}
                        className="dropdown-item"
                        onClick={() => handleSubItemClick(sub.screen)}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: subIndex * 0.05 }}
                        whileHover={{ 
                          x: -10, 
                          background: `${icon.color}15`,
                          borderRight: `3px solid ${icon.color}`
                        }}
                      >
                        {sub.title}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* معلومات المستخدم */}
        <motion.div 
          className="user-bar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <span>👤 {user?.username}</span>
          <span className="user-role-badge">{user?.role === 'admin' ? 'مدير' : 'موظف'}</span>
          <button className="btn-logout" onClick={handleLogout}>🚪 خروج</button>
        </motion.div>
      </div>
    );
  }

  // ========== الشاشات الفرعية ==========
  const getTitle = () => {
    const titles = {
      'dashboard': '📊 لوحة التحكم',
      'students': '👥 الطلاب والكليات',
      'attendance': '🖐️ الحضور والغياب',
      'reports': '📄 التقارير',
      'notifications': '🔔 الإشعارات',
      'devices': '🖨️ أجهزة البصمة',
      'calendar': '📅 التقويم الأكاديمي',
      'settings': '⚙️ الإعدادات'
    };
    return titles[screen] || '';
  };

  return (
    <div className="app-layout">
      {/* شريط علوي */}
      <header className="top-bar">
        <button className="back-btn" onClick={() => setScreen('home')}>
          🏠 الرئيسية
        </button>
        <h2>{getTitle()}</h2>
        <div className="header-status">
          <span className={`status-dot ${aiReady ? 'online' : 'offline'}`}></span>
          <span>{aiReady ? 'AI جاهز' : 'AI غير متاح'}</span>
        </div>
        <button className="btn-logout-sm" onClick={handleLogout}>🚪</button>
      </header>

      {/* المحتوى */}
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
