// src/components/Dashboard.js – لوحة التحكم الرئيسية (الإصدار الإمبراطوري الفاخر الملكي)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

    // طلاب تجاوزوا 25% غياب (حد الحرمان الأكاديمي)
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
      LIMIT 3
    `, [today]);

    noShow.forEach(s => {
      alertList.push({
        type: 'warning',
        icon: '⚠️',
        message: `الطالب ${s.full_name} لم يتم رصد أي حركة تحضير بيومنا هذا`
      });
    });

    // أجهزة البصمة غير المتصلة بالشبكة المحلية
    const offlineDevices = getQuery("SELECT name FROM devices WHERE status='offline'");
    offlineDevices.forEach(d => {
      alertList.push({
        type: 'info',
        icon: '🔌',
        message: `جهاز الفحص المحيطي (${d.name}) غير متصل بالخادم`
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
      setAiAnalysis("فشل الاتصال بمحرك التحليل المحلي. يرجى التحقق من سلامة تشغيل الملفات النواتية.");
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

  // عناصر التحريك المتتالي للبطاقات الإحصائية
  const gridVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100, damping: 15 } }
  };

  if (loading) {
    return (
      <div className="dashboard-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '20px' }}>
        <div className="splash-loader" style={{ width: '50px', height: '50px', border: '3px solid rgba(214,175,55,0.1)', borderTop: '3px solid var(--gold-main)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--gold-light)', fontWeight: 600, letterSpacing: '0.5px', fontFamily: 'Tajawal' }}>جاري استدعاء مؤشرات النواة الرقمية لوحة التحكم...</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '5px 0' }}
    >
      {/* 🛠️ شريط الأدوات العلوي الفاخر */}
      <div className="dashboard-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'rgba(255,255,255,0.02)', padding: '15px 20px', borderRadius: '18px', border: '1px solid var(--glass-border)' }}>
        <div>
          <h2 style={{ fontFamily: 'Amiri, serif', fontSize: '1.8rem', color: 'var(--white)', margin: 0, fontWeight: 400 }}>🏛️ اللوحة المركزية للنظام الإداري الذكي</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>مراقبة حية للحضور والأجهزة البيومترية ومؤشرات الحرمان لفرع غيل باوزير</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <motion.button 
            className="btn-refresh" 
            onClick={refreshData}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
          >
            🔄 تحديث المؤشرات
          </motion.button>
          
          <motion.button 
            className="btn-ai" 
            onClick={handleAIAnalysis} 
            disabled={analyzing}
            whileHover={{ y: -2, scale: 1.02, boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' }}
            whileTap={{ scale: 0.98 }}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.2)' }}
          >
            {analyzing ? '⏳ جاري قراءة البيانات...' : '🧠 تفعيل التحليل الذكي الفوري'}
          </motion.button>
        </div>
      </div>

      {/* 📊 بطاقات الإحصائيات ثلاثية الأبعاد ببريق الأيقونات المتوهجة زجاجياً */}
      <motion.div className="stats-grid" variants={gridVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '35px' }}>
        {[
          { key: 'totalStudents', val: stats.totalStudents, label: 'إجمالي الطلاب المقيدين', icon: '👥', glow: 'rgba(214,175,55,0.15)', border: 'var(--gold-main)', anim: { rotateY: [0, 360], transition: { duration: 6, repeat: Infinity, ease: "linear" } } },
          { key: 'presentToday', val: stats.presentToday, label: 'الطلاب الحاضرين اليوم', icon: '✅', glow: 'rgba(16,185,129,0.15)', border: 'var(--green-bright)', anim: { scale: [1, 1.15, 1], transition: { duration: 2, repeat: Infinity } } },
          { key: 'absentToday', val: stats.absentToday, label: 'الطلاب الغائبين اليوم', icon: '❌', glow: 'rgba(239,68,68,0.15)', border: '#ef4444', anim: { x: [-2, 2, -2], transition: { duration: 1.5, repeat: Infinity } } },
          { key: 'lateToday', val: stats.lateToday, label: 'حالات التأخير المرصودة', icon: '⚠️', glow: 'rgba(245,158,11,0.15)', border: 'var(--gold-main)', anim: { rotate: [-8, 8, -8], transition: { duration: 2, repeat: Infinity } } },
          { key: 'totalLectures', val: stats.totalLectures, label: 'الجداول والمحاضرات المفعلة', icon: '📚', glow: 'rgba(56,189,248,0.15)', border: '#38bdf8', anim: { y: [0, -4, 0], transition: { duration: 2.5, repeat: Infinity } } },
          { key: 'notificationsSent', val: stats.notificationsSent, label: 'إشعارات أولياء الأمور المرسلة', icon: '📱', glow: 'rgba(168,85,247,0.15)', border: '#a855f7', anim: { scale: [1, 1.05, 1], transition: { duration: 3, repeat: Infinity } } }
        ].map((card) => (
          <motion.div 
            key={card.key}
            variants={cardVariants}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,255,255,0.03))',
              backdropFilter: 'blur(10px)', border: '1px solid var(--glass-border)', borderRadius: '22px', padding: '22px',
              display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
              boxShadow: `inset 0 0 12px rgba(255,255,255,0.01)`
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 10px 25px ${card.glow}, inset 0 0 0 1px ${card.border}`}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = `none`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>{card.label}</span>
              <motion.div style={{ fontSize: '1.6rem' }} animate={card.anim}>{card.icon}</motion.div>
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fff', fontFamily: 'Tajawal', letterSpacing: '-1px' }}>{card.val}</div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '35%', height: '3px', background: card.border, opacity: 0.7 }} />
          </motion.div>
        ))}
      </motion.div>

      {/* 📈 شريط نسبة الحضور الإجمالي الزجاجي المضيء */}
      <div className="attendance-bar" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,255,255,0.02))', padding: '25px', borderRadius: '24px', border: '1px solid var(--glass-border)', marginBottom: '35px', boxShadow: '0 15px 35px rgba(0,0,0,0.2)' }}>
        <div className="bar-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>📊 النسبة المئوية المعتمدة لحضور الطلاب الإجمالي لهذا اليوم</span>
          <span className="bar-percent" style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', padding: '5px 16px', borderRadius: '50px', fontWeight: 900, fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(214,175,55,0.2)' }}>
            {attendancePercent}%
          </span>
        </div>
        <div className="bar-track" style={{ height: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '100px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.03)' }}>
          <motion.div
            className="bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${attendancePercent}%` }}
            transition={{ duration: 1.2, ease: "cubicBezier(0.4, 0, 0.2, 1)" }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #10b981, #34d399)',
              boxShadow: '0 0 20px #10b981',
              borderRadius: '100px',
              position: 'relative'
            }}
          >
            {/* تأثير وميض الضوء المتحرك على مسار شريط النسبة */}
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', animation: 'shimmer 2s infinite' }} />
          </motion.div>
        </div>
      </div>

      {/* 🚨 قسم التنبيهات والإنذارات الفورية الخطرة */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div 
            className="alerts-section"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: '35px' }}
          >
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.5rem', color: 'var(--gold-light)', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>🔔 مصفوفة الإنذارات الفورية وقيد الحرمان الأكاديمي</h3>
            <div className="alerts-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alerts.map((alert, index) => {
                let cardBg = 'rgba(56, 189, 248, 0.02)';
                let borderCol = 'rgba(56, 189, 248, 0.15)';
                let accentCol = '#38bdf8';
                
                if (alert.type === 'danger') {
                  cardBg = 'rgba(239, 68, 68, 0.03)';
                  borderCol = 'rgba(239, 68, 68, 0.2)';
                  accentCol = '#ef4444';
                } else if (alert.type === 'warning') {
                  cardBg = 'rgba(245, 158, 11, 0.03)';
                  borderCol = 'rgba(245, 158, 11, 0.2)';
                  accentCol = 'var(--gold-main)';
                }

                return (
                  <motion.div 
                    key={index} 
                    className={`alert-item alert-${alert.type}`}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '15px', padding: '16px 22px', borderRadius: '16px',
                      background: `linear-gradient(90deg, ${cardBg}, rgba(0,0,0,0.2))`, border: `1px solid ${borderCol}`,
                      color: '#f1f5f9', borderRight: `4px solid ${accentCol}`
                    }}
                  >
                    <span className="alert-icon" style={{ fontSize: '1.3rem' }}>{alert.icon}</span>
                    <span className="alert-message" style={{ fontWeight: 500, fontSize: '0.95rem', letterSpacing: '-0.2px' }}>{alert.message}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🧠 نافذة استعراض تحليل الذكاء الاصطناعي الفاخرة المدمجة */}
      <AnimatePresence>
        {aiAnalysis && (
          <motion.div 
            className="ai-analysis"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.03), rgba(168, 85, 247, 0.06))',
              border: '1px solid rgba(168, 85, 247, 0.25)', padding: '28px', borderRadius: '24px', marginBottom: '35px',
              boxShadow: '0 12px 40px rgba(124, 58, 237, 0.05)', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '150px', height: '150px', background: 'rgba(168, 85, 247, 0.1)', filter: 'blur(50px)', borderRadius: '50%' }} />
            
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: '#d8b4fe', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
              🧠 تقرير التحليل الإحصائي التلقائي (AI Local Core Node)
            </h3>
            <div className="analysis-content" style={{ color: '#cbd5e1', lineHeight: '1.9', fontSize: '1rem', position: 'relative', zIndex: 1 }}>
              {aiAnalysis.split('\n').map((line, i) => (
                <p key={i} style={{ marginBottom: '10px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                  {line.trim().startsWith('*') || line.trim().startsWith('-') ? (
                    <>
                      <span style={{ color: '#a855f7', marginTop: '2px' }}>✦</span>
                      <span>{line.replace(/^[\*\-\s]+/, '')}</span>
                    </>
                  ) : (
                    line
                  )}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🧭 الشريط السفلي لمعلومات المزامنة واستقرار النظام الخارجي */}
      <div className="quick-summary" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', padding: '16px 25px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '18px', alignItems: 'center' }}>
        <div className="summary-item" style={{ fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>📅 التوقيت والمزامنة:</span>
          <span style={{ color: 'var(--gold-light)', fontWeight: 600 }}>{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div className="summary-item" style={{ fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>🕐 تحديث فوري:</span>
          <span style={{ color: 'var(--white)', fontWeight: 600 }}>{new Date().toLocaleTimeString('ar-SA')}</span>
        </div>
        <div className="summary-item" style={{ fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>🤖 حالة المعالج المحلي:</span>
          <span style={{ color: 'var(--green-bright)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '7px', height: '7px', background: 'var(--green-bright)', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.5s infinite' }} /> 
            مستقر بالكامل (Offline Local Node)
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default Dashboard;
