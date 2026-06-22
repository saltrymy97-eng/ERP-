// App.js – الواجهة الرئيسية لنظام الحضور والغياب
import React, { useState, useEffect } from 'react';
import { initDatabase, loadFromLocalStorage, getQuery } from './services/db';
import { login, logout, getCurrentUser, restoreSession, hasPermission } from './services/auth';
import { loadMobileModel } from './services/ai';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Attendance from './components/Attendance';
import Reports from './components/Reports';
import Settings from './components/Settings';
import './App.css';

// ========== التطبيق الرئيسي ==========
function App() {
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [dbReady, setDbReady] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  // ========== بدء التشغيل ==========
  useEffect(() => {
    async function startup() {
      // تحميل قاعدة البيانات
      const saved = await loadFromLocalStorage();
      if (!saved) {
        await initDatabase();
      }
      setDbReady(true);

      // استعادة الجلسة
      const savedUser = await restoreSession();
      if (savedUser) {
        setUser(savedUser);
        setScreen('dashboard');
      }

      // تحميل الذكاء الاصطناعي
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
      setScreen('dashboard');
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

  // ========== شاشة التحميل ==========
  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <img src="/logo.png" alt="شعار الجامعة" className="splash-logo" />
          <h1>نظام متابعة الحضور والغياب</h1>
          <p>جامعة القرآن الكريم والعلوم الإسلامية</p>
          <div className="splash-loader"></div>
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // ========== شاشة تسجيل الدخول ==========
  if (screen === 'login') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <img src="/logo.png" alt="شعار الجامعة" className="login-logo" />
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

          <button className="login-btn" onClick={handleLogin}>
            دخول
          </button>

          <p className="login-footer">
            جامعة القرآن الكريم والعلوم الإسلامية<br />
            فرع غيل باوزير - حضرموت
          </p>
        </div>
      </div>
    );
  }

  // ========== التطبيق الرئيسي ==========
  return (
    <div className="app-layout">
      {/* الشريط الجانبي */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="الشعار" className="sidebar-logo" />
          <h3>نظام الحضور</h3>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-btn ${screen === 'dashboard' ? 'active' : ''}`}
            onClick={() => setScreen('dashboard')}
          >
            <span className="nav-icon">📊</span>
            لوحة التحكم
          </button>

          <button
            className={`nav-btn ${screen === 'students' ? 'active' : ''}`}
            onClick={() => setScreen('students')}
          >
            <span className="nav-icon">👥</span>
            إدارة الطلاب
          </button>

          <button
            className={`nav-btn ${screen === 'attendance' ? 'active' : ''}`}
            onClick={() => setScreen('attendance')}
          >
            <span className="nav-icon">🖐️</span>
            الحضور والغياب
          </button>

          <button
            className={`nav-btn ${screen === 'reports' ? 'active' : ''}`}
            onClick={() => setScreen('reports')}
          >
            <span className="nav-icon">📄</span>
            التقارير
          </button>

          <button
            className={`nav-btn ${screen === 'settings' ? 'active' : ''}`}
            onClick={() => setScreen('settings')}
          >
            <span className="nav-icon">⚙️</span>
            الإعدادات
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-avatar">👤</span>
            <span className="user-name">{user?.username}</span>
            <span className="user-role">{user?.role === 'admin' ? 'مدير' : 'موظف'}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="main-content">
        <header className="main-header">
          <h2>
            {screen === 'dashboard' && '📊 لوحة التحكم'}
            {screen === 'students' && '👥 إدارة الطلاب'}
            {screen === 'attendance' && '🖐️ الحضور والغياب'}
            {screen === 'reports' && '📄 التقارير'}
            {screen === 'settings' && '⚙️ الإعدادات'}
          </h2>
          <div className="header-status">
            <span className={`status-dot ${aiReady ? 'online' : 'offline'}`}></span>
            <span>{aiReady ? 'AI جاهز' : 'AI غير متاح'}</span>
          </div>
        </header>

        <div className="main-body">
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'students' && <Students />}
          {screen === 'attendance' && <Attendance />}
          {screen === 'reports' && <Reports />}
          {screen === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

export default App;
