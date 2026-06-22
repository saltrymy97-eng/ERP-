// src/components/Dashboard.js – لوحة التحكم الرئيسية (الإصدار الاحترافي الملكي)
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getQuery } from '../services/db';
import { analyzeDailyAttendance } from '../services/ai';

function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    totalLectures: 0,
    notificationsSent: 0
  });
  const [alerts, setAlerts] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadStats();
    loadAlerts();
  }, []);

  // ========== تحميل الإحصائيات الفورية من القاعدة المحلية ==========
  const loadStats = () => {
    const today = new Date().toISOString().slice(0, 10);

    const totalStudents = getQuery("SELECT COUNT(*) as c FROM students WHERE status='active'")[0]?.c || 0;
    const presentToday = getQuery("SELECT COUNT(DISTINCT student_id) as c FROM attendance WHERE date=? AND status='present'", [today])[0]?.c || 0;
    const absentToday = getQuery("SELECT COUNT(DISTINCT student_id) as c FROM attendance WHERE date=? AND status='absent'", [today])[0]?.c || 0;
    const lateToday = getQuery("SELECT COUNT(*) as c FROM attendance WHERE date=? AND status='late'", [today])[0]?.c || 0;
    const totalLectures = getQuery("SELECT COUNT(*) as c FROM schedules")[0]?.c || 0;
    const notificationsSent = getQuery("SELECT COUNT(*) as c FROM notifications WHERE date(sent_at)=?", [today])[0]?.c || 0;

    setStats({
      totalStudents,
      presentToday,
      absentToday,
      lateToday,
      totalLectures,
      notificationsSent
    });

    setLoading(false);
  };

  // ========== بناء قائمة التنبيهات الذكية ونسب الغياب الحرجة ==========
  const loadAlerts = () => {
    const alertList = [];

    // طلاب تجاوزوا 25% غياب (شرط الأستاذ سعيد)
    const highAbsence = getQuery(`
      SELECT s.full_name, s.university_id,
             ROUND(CAST(COUNT(CASE WHEN a.status='absent' THEN 1 END) AS FLOAT) / COUNT(*)*100,1) as rate
      FROM students s
      JOIN attendance a ON s.id = a.student_id
      GROUP BY s.id
      HAVING rate >= 25
    `);

    highAbsence.forEach(s => {
      alertList.push({
        type: 'danger',
        icon: '🚨',
        message: `الطالب ${s.full_name} تجاوز الحد الحرج للغياب الكلي بنسبة ${s.rate}%`
      });
    });

    // رصد الطلاب الغائبين عن تحضير اليوم
    const today = new Date().toISOString().slice(0, 10);
    const noShow = getQuery(`
      SELECT full_name, university_id FROM students
      WHERE status='active'
      AND id NOT IN (
        SELECT DISTINCT student_id FROM attendance WHERE date=?
      )
      LIMIT 5
    `, [today]);

    noShow.forEach(s => {
      alertList.push({
        type: 'warning',
        icon: '⚠️',
        message: `الطالب ${s.full_name} لم يتم رصد أي حركة تحضير له اليوم`
      });
    });

    // أجهزة البصمة غير المتصلة بالشبكة المحلية
    const offlineDevices = getQuery("SELECT name FROM devices WHERE status='offline'");
    offlineDevices.forEach(d => {
      alertList.push({
        type: 'info',
        icon: '🔌',
        message: `جهاز التحضير المحيطي (${d.name}) غير متصل بالخادم`
      });
    });

    setAlerts(alertList);
  };

  // ========== تشغيل معالجة التحليل الذكي للذكاء الاصطناعي ==========
  const handleAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      const analysis = await analyzeDailyAttendance();
      setAiAnalysis(analysis);
    } catch (e) {
      setAiAnalysis("فشل الاتصال بمحرك التحليل المحلي. يرجى التحقق من سلامة تشغيل الملفات.");
    }
    setAnalyzing(false);
  };

  // ========== إعادة إنعاش وتحديث البيانات ==========
  const refreshData = () => {
    setLoading(true);
    loadStats();
    loadAlerts();
    setTimeout(() => setLoading(false), 500);
  };

  const attendancePercent = stats.totalStudents > 0
    ? Math.round((stats.presentToday / stats.totalStudents) * 100)
    : 0;

  if (loading) {
    return (
      <div className="dashboard-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '15px' }}>
        <div className="splash-loader"></div>
        <p style={{ color: 'var(--gold-light)', fontWeight: 600 }}>جاري استدعاء مؤشرات لوحة التحكم الرقمية...</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="dashboard"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* شريط الأدوات العلوي الفاخر */}
      <div className="dashboard-toolbar">
        <motion.button 
          className="btn-refresh" 
          onClick={refreshData}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🔄 تحديث فوري للمؤشرات
        </motion.button>
        
        <motion.button 
          className="btn-ai" 
          onClick={handleAIAnalysis} 
          disabled={analyzing}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {analyzing ? '⏳ جاري قراءة البيانات...' : '🧠 تفعيل التحليل الذكي الفوري'}
        </motion.button>
      </div>

      {/* بطاقات الإحصائيات ثلاثية الأبعاد ببريق الأيقونات المتحركة */}
      <div className="stats-grid">
        {/* إجمالي الطلاب */}
        <motion.div className="stat-card gold" whileHover={{ y: -10, scale: 1.03 }}>
          <motion.div className="stat-icon" animate={{ rotateY: [0, 360] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>👥</motion.div>
          <div className="stat-value">{stats.totalStudents}</div>
          <div className="stat-label">إجمالي الطلاب المقيدين</div>
        </motion.div>

        {/* حاضر اليوم */}
        <motion.div className="stat-card green" whileHover={{ y: -10, scale: 1.03 }}>
          <motion.div className="stat-icon" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>✅</motion.div>
          <div className="stat-value">{stats.presentToday}</div>
          <div className="stat-label">الطلاب الحاضرين اليوم</div>
        </motion.div>

        {/* غائب اليوم */}
        <motion.div className="stat-card red" whileHover={{ y: -10, scale: 1.03 }}>
          <motion.div className="stat-icon" animate={{ x: [-2, 2, -2] }} transition={{ duration: 1.5, repeat: Infinity }}>❌</motion.div>
          <div className="stat-value">{stats.absentToday}</div>
          <div className="stat-label">الطلاب الغائبين اليوم</div>
        </motion.div>

        {/* متأخر اليوم */}
        <motion.div className="stat-card orange" whileHover={{ y: -10, scale: 1.03 }}>
          <motion.div className="stat-icon" animate={{ rotate: [-10, 10, -10] }} transition={{ duration: 2, repeat: Infinity }}>⚠️</motion.div>
          <div className="stat-value">{stats.lateToday}</div>
          <div className="stat-label">حالات التأخير المرصودة</div>
        </motion.div>

        {/* المحاضرات */}
        <motion.div className="stat-card blue" whileHover={{ y: -10, scale: 1.03 }}>
          <motion.div className="stat-icon" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>📚</motion.div>
          <div className="stat-value">{stats.totalLectures}</div>
          <div className="stat-label">الجداول والمحاضرات المفعلة</div>
        </motion.div>

        {/* إشعارات اليوم */}
        <motion.div className="stat-card purple" whileHover={{ y: -10, scale: 1.03 }}>
          <motion.div className="stat-icon" animate={{ rotateY: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity }}>📱</motion.div>
          <div className="stat-value">{stats.notificationsSent}</div>
          <div className="stat-label">إشعارات أولياء الأمور المرسلة</div>
        </motion.div>
      </div>

      {/* شريط نسبة الحضور الإجمالي الزجاجي المضيء */}
      <div className="attendance-bar" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '25px', borderRadius: '24px', border: '1px solid var(--glass-border)', marginBottom: '35px' }}>
        <div className="bar-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>📊 النسبة الإجمالية لحضور الطلاب لهذا اليوم</span>
          <span className="bar-percent" style={{ background: 'var(--gold-main)', color: 'var(--emerald-dark)', padding: '4px 12px', borderRadius: '50px', fontWeight: 900, fontSize: '1.1rem' }}>
            {attendancePercent}%
          </span>
        </div>
        <div className="bar-track" style={{ height: '14px', background: 'rgba(0,0,0,0.4)', borderRadius: '100px', overflow: 'hidden', position: 'relative' }}>
          <motion.div
            className="bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${attendancePercent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--emerald-light), var(--green-bright))',
              boxShadow: '0 0 15px var(--green-bright)',
              borderRadius: '100px'
            }}
          ></motion.div>
        </div>
      </div>

      {/* قسم التنبيهات والإنذارات الفورية الخطرة */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div 
            className="alerts-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: '35px' }}
          >
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.5rem', color: 'var(--gold-light)', marginBottom: '15px' }}>🔔 الحالات الطارئة وتنبيهات النظام</h3>
            <div className="alerts-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alerts.map((alert, index) => (
                <motion.div 
                  key={index} 
                  className={`alert-item alert-${alert.type}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    padding: '16px 20px',
                    borderRadius: '16px',
                    background: alert.type === 'danger' ? 'rgba(255, 77, 77, 0.06)' : alert.type === 'warning' ? 'rgba(255, 145, 0, 0.06)' : 'rgba(56, 189, 248, 0.06)',
                    border: `1px solid ${alert.type === 'danger' ? 'rgba(255, 77, 77, 0.2)' : alert.type === 'warning' ? 'rgba(255, 145, 0, 0.2)' : 'rgba(56, 189, 248, 0.2)'}`,
                    color: '#f8fafc'
                  }}
                >
                  <span className="alert-icon" style={{ fontSize: '1.4rem' }}>{alert.icon}</span>
                  <span className="alert-message" style={{ fontWeight: 500, fontSize: '0.95rem' }}>{alert.message}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* نافذة استعراض تحليل الذكاء الاصطناعي الفاخرة */}
      <AnimatePresence>
        {aiAnalysis && (
          <motion.div 
            className="ai-analysis"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(168, 85, 247, 0.05))',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              padding: '25px',
              borderRadius: '24px',
              marginBottom: '35px',
              boxShadow: '0 10px 30px rgba(168, 85, 247, 0.05)'
            }}
          >
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.5rem', color: '#c084fc', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🧠 تقرير التحليل الإحصائي التلقائي (AI Local Engine)
            </h3>
            <div className="analysis-content" style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '1rem' }}>
              {aiAnalysis.split('\n').map((line, i) => (
                <p key={i} style={{ marginBottom: '8px' }}>{line}</p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* الشريط السفلي لمعلومات المزامنة والوقت */}
      <div className="quick-summary" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', padding: '15px 25px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '16px' }}>
        <div className="summary-item">
          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>📅 تاريخ ومزامنة اليوم:</span>
          <span style={{ color: 'var(--gold-light)', fontWeight: 600 }}>{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div className="summary-item">
          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>🕐 توقيت آخر تحديث للبيانات:</span>
          <span style={{ color: 'var(--white)', fontWeight: 600 }}>{new Date().toLocaleTimeString('ar-SA')}</span>
        </div>
        <div className="summary-item">
          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>🤖 حالة المحرك الذكي:</span>
          <span style={{ color: 'var(--green-bright)', fontWeight: 600 }}>● متصل ومستقر (Offline Node)</span>
        </div>
      </div>
    </motion.div>
  );
}

export default Dashboard;
