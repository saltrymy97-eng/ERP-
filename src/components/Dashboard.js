// src/components/Dashboard.js – لوحة التحكم الرئيسية (SQLite محلية + تنبيهات مراحل الغياب + صور)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, initDatabase } from '../services/db';

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
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const setup = async () => {
      await initDatabase();
      setDbReady(true);
      await loadAllData();
    };
    setup();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadAlerts()]);
    setLoading(false);
  };

  const loadStats = async () => {
    const totalStudentsResult = await getQuery("SELECT COUNT(*) as count FROM students WHERE status = 'active'");
    const totalStudents = totalStudentsResult?.[0]?.count || 0;

    const todayRecords = await getQuery("SELECT student_id, status FROM attendance WHERE date = ?", [today]);
    const uniqueMap = {};
    if (todayRecords) todayRecords.forEach(a => { uniqueMap[a.student_id] = a; });
    const uniqueRecords = Object.values(uniqueMap);

    const presentToday = uniqueRecords.filter(a => a.status === 'present').length;
    const absentToday = uniqueRecords.filter(a => a.status === 'absent').length;
    const lateToday = uniqueRecords.filter(a => a.status === 'late').length;

    const totalLecturesResult = await getQuery("SELECT COUNT(*) as count FROM schedules");
    const totalLectures = totalLecturesResult?.[0]?.count || 0;

    const notificationsResult = await getQuery(
      "SELECT COUNT(*) as count FROM notifications WHERE sent_at >= ? AND sent_at <= ?",
      [`${today}T00:00:00`, `${today}T23:59:59`]
    );
    const notificationsSent = notificationsResult?.[0]?.count || 0;

    setStats({ totalStudents, presentToday, absentToday, lateToday, totalLectures, notificationsSent });
  };

  const loadAlerts = async () => {
    const alertList = [];

    // ========== 1. نظام تنبيهات مراحل الغياب المتدرج ==========
    const allAttendance = await getQuery(
      "SELECT a.student_id, a.status, s.full_name, s.university_id, s.photo FROM attendance a INNER JOIN students s ON a.student_id = s.id WHERE s.status = 'active'"
    );

    if (allAttendance && allAttendance.length > 0) {
      const studentAbsenceMap = {};
      allAttendance.forEach(a => {
        const sid = a.student_id;
        if (!studentAbsenceMap[sid]) {
          studentAbsenceMap[sid] = {
            full_name: a.full_name,
            university_id: a.university_id,
            photo: a.photo,
            total: 0,
            absent: 0
          };
        }
        studentAbsenceMap[sid].total++;
        if (a.status === 'absent') studentAbsenceMap[sid].absent++;
      });

      Object.values(studentAbsenceMap).forEach(s => {
        const rate = s.total > 0 ? Math.round((s.absent / s.total) * 100 * 10) / 10 : 0;

        // 🚨 مراحل الغياب المتدرجة
        if (rate >= 30) {
          alertList.push({
            type: 'danger',
            icon: '🚨',
            level: 'حرمان من الاختبار',
            levelColor: '#ef4444',
            message: `الطالب ${s.full_name} (${s.university_id}) تجاوز 30% غياب → حرمان من الاختبار`,
            photo: s.photo,
            rate: rate
          });
        } else if (rate >= 25) {
          alertList.push({
            type: 'danger',
            icon: '🔴',
            level: 'إنذار أكاديمي نهائي',
            levelColor: '#ef4444',
            message: `الطالب ${s.full_name} (${s.university_id}) تجاوز 25% غياب → إنذار أكاديمي`,
            photo: s.photo,
            rate: rate
          });
        } else if (rate >= 20) {
          alertList.push({
            type: 'warning',
            icon: '🟡',
            level: 'تنبيه ثانٍ',
            levelColor: '#f59e0b',
            message: `الطالب ${s.full_name} (${s.university_id}) تجاوز 20% غياب → تنبيه ثانٍ`,
            photo: s.photo,
            rate: rate
          });
        } else if (rate >= 10) {
          alertList.push({
            type: 'info',
            icon: '🟢',
            level: 'تنبيه أول',
            levelColor: '#38bdf8',
            message: `الطالب ${s.full_name} (${s.university_id}) تجاوز 10% غياب → تنبيه أول`,
            photo: s.photo,
            rate: rate
          });
        }
      });
    }

    // ========== 2. طلاب لم يحضروا اليوم ==========
    const presentIds = await getQuery("SELECT DISTINCT student_id FROM attendance WHERE date = ?", [today]);
    const presentIdSet = new Set((presentIds || []).map(a => a.student_id));

    const allStudents = await getQuery("SELECT id, full_name, university_id, photo FROM students WHERE status = 'active'");
    if (allStudents) {
      const noShow = allStudents.filter(s => !presentIdSet.has(s.id)).slice(0, 5);
      noShow.forEach(s => {
        alertList.push({
          type: 'warning',
          icon: '⚠️',
          level: 'غياب اليوم',
          levelColor: '#f59e0b',
          message: `الطالب ${s.full_name} (${s.university_id}) لم يسجل حضور اليوم`,
          photo: s.photo,
          rate: null
        });
      });
    }

    // ========== 3. أجهزة غير متصلة ==========
    const offlineDevices = await getQuery("SELECT name FROM devices WHERE status = 'offline'");
    (offlineDevices || []).forEach(d => {
      alertList.push({
        type: 'info',
        icon: '🔌',
        level: 'جهاز غير متصل',
        levelColor: '#38bdf8',
        message: `جهاز (${d.name}) غير متصل بالخادم`,
        photo: null,
        rate: null
      });
    });

    // ترتيب التنبيهات: danger أولاً → warning → info
    const order = { danger: 1, warning: 2, info: 3 };
    alertList.sort((a, b) => (order[a.type] || 4) - (order[b.type] || 4));

    setAlerts(alertList);
  };

  const handleAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      const presentPercent = stats.totalStudents > 0 ? Math.round((stats.presentToday / stats.totalStudents) * 100) : 0;
      let analysis = `📊 تقرير تحليل الحضور ليوم ${today}\n\n`;
      analysis += `* إجمالي الطلاب المسجلين: ${stats.totalStudents} طالب\n`;
      analysis += `* نسبة الحضور اليوم: ${presentPercent}%\n`;
      analysis += `* عدد الحاضرين: ${stats.presentToday} طالب\n`;
      analysis += `* عدد الغائبين: ${stats.absentToday} طالب\n`;
      analysis += `* عدد المتأخرين: ${stats.lateToday} طالب\n\n`;

      if (presentPercent >= 85) analysis += `✅ الوضع العام ممتاز.\n`;
      else if (presentPercent >= 70) analysis += `⚠️ الوضع مقبول لكن يحتاج متابعة.\n`;
      else analysis += `🚨 تحذير: نسبة الحضور منخفضة جداً.\n`;

      if (stats.absentToday > stats.presentToday * 0.3) analysis += `- ملاحظة: عدد الغائبين اليوم مرتفع.\n`;

      setAiAnalysis(analysis);
    } catch (e) {
      setAiAnalysis("فشل إجراء التحليل المحلي.");
    }
    setAnalyzing(false);
  };

  const refreshData = () => loadAllData();

  const attendancePercent = stats.totalStudents > 0 ? Math.round((stats.presentToday / stats.totalStudents) * 100) : 0;

  const gridVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const cardVariants = { hidden: { opacity: 0, y: 20, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100, damping: 15 } } };

  if (loading || !dbReady) {
    return (
      <div className="dashboard-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '20px' }}>
        <div className="splash-loader" style={{ width: '50px', height: '50px', border: '3px solid rgba(214,175,55,0.1)', borderTop: '3px solid var(--gold-main)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--gold-light)', fontWeight: 600 }}>جاري استدعاء مؤشرات النواة الرقمية لوحة التحكم...</p>
      </div>
    );
  }

  return (
    <motion.div className="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} style={{ padding: '5px 0' }}>
      
      {/* 🛠️ شريط الأدوات العلوي */}
      <div className="dashboard-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'rgba(255,255,255,0.02)', padding: '15px 20px', borderRadius: '18px', border: '1px solid var(--glass-border)' }}>
        <div>
          <h2 style={{ fontFamily: 'Amiri, serif', fontSize: '1.8rem', color: 'var(--white)', margin: 0 }}>🏛️ اللوحة المركزية للنظام الإداري الذكي</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>مراقبة حية للحضور والأجهزة البيومترية ومؤشرات الحرمان لفرع غيل باوزير</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <motion.button className="btn-refresh" onClick={refreshData} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            🔄 تحديث المؤشرات
          </motion.button>
          <motion.button className="btn-ai" onClick={handleAIAnalysis} disabled={analyzing} whileHover={{ y: -2, boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' }} whileTap={{ scale: 0.98 }}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', boxShadow: '0 4px 15px rgba(124, 58, 237, 0.2)' }}>
            {analyzing ? '⏳ جاري قراءة البيانات...' : '🧠 تفعيل التحليل الذكي'}
          </motion.button>
        </div>
      </div>

      {/* 📊 بطاقات الإحصائيات */}
      <motion.div className="stats-grid" variants={gridVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '35px' }}>
        {[
          { key: 'totalStudents', val: stats.totalStudents, label: 'إجمالي الطلاب المقيدين', icon: '👥', glow: 'rgba(214,175,55,0.15)', border: 'var(--gold-main)', anim: { rotateY: [0, 360], transition: { duration: 6, repeat: Infinity, ease: "linear" } } },
          { key: 'presentToday', val: stats.presentToday, label: 'الطلاب الحاضرين اليوم', icon: '✅', glow: 'rgba(16,185,129,0.15)', border: 'var(--green-bright)', anim: { scale: [1, 1.15, 1], transition: { duration: 2, repeat: Infinity } } },
          { key: 'absentToday', val: stats.absentToday, label: 'الطلاب الغائبين اليوم', icon: '❌', glow: 'rgba(239,68,68,0.15)', border: '#ef4444', anim: { x: [-2, 2, -2], transition: { duration: 1.5, repeat: Infinity } } },
          { key: 'lateToday', val: stats.lateToday, label: 'حالات التأخير المرصودة', icon: '⚠️', glow: 'rgba(245,158,11,0.15)', border: 'var(--gold-main)', anim: { rotate: [-8, 8, -8], transition: { duration: 2, repeat: Infinity } } },
          { key: 'totalLectures', val: stats.totalLectures, label: 'الجداول والمحاضرات المفعلة', icon: '📚', glow: 'rgba(56,189,248,0.15)', border: '#38bdf8', anim: { y: [0, -4, 0], transition: { duration: 2.5, repeat: Infinity } } },
          { key: 'notificationsSent', val: stats.notificationsSent, label: 'إشعارات أولياء الأمور المرسلة', icon: '📱', glow: 'rgba(168,85,247,0.15)', border: '#a855f7', anim: { scale: [1, 1.05, 1], transition: { duration: 3, repeat: Infinity } } }
        ].map((card) => (
          <motion.div key={card.key} variants={cardVariants} whileHover={{ y: -8 }}
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,255,255,0.03))', backdropFilter: 'blur(10px)', border: '1px solid var(--glass-border)', borderRadius: '22px', padding: '22px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 10px 25px ${card.glow}, inset 0 0 0 1px ${card.border}`}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>{card.label}</span>
              <motion.div style={{ fontSize: '1.6rem' }} animate={card.anim}>{card.icon}</motion.div>
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fff', fontFamily: 'Tajawal' }}>{card.val}</div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '35%', height: '3px', background: card.border, opacity: 0.7 }} />
          </motion.div>
        ))}
      </motion.div>

      {/* 📈 شريط نسبة الحضور */}
      <div className="attendance-bar" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,255,255,0.02))', padding: '25px', borderRadius: '24px', border: '1px solid var(--glass-border)', marginBottom: '35px', boxShadow: '0 15px 35px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>📊 النسبة المئوية لحضور الطلاب اليوم</span>
          <span style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', padding: '5px 16px', borderRadius: '50px', fontWeight: 900, fontSize: '1.1rem' }}>{attendancePercent}%</span>
        </div>
        <div style={{ height: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '100px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.03)' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${attendancePercent}%` }} transition={{ duration: 1.2, ease: "cubicBezier(0.4, 0, 0.2, 1)" }}
            style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', boxShadow: '0 0 20px #10b981', borderRadius: '100px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', animation: 'shimmer 2s infinite' }} />
          </motion.div>
        </div>
      </div>

      {/* 🚨 التنبيهات مع مراحل الغياب والصور */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div className="alerts-section" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '35px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.5rem', color: 'var(--gold-light)', marginBottom: '18px' }}>🔔 مصفوفة الإنذارات الفورية ومراحل الحرمان الأكاديمي</h3>
            <div className="alerts-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alerts.map((alert, index) => {
                let cardBg = 'rgba(56, 189, 248, 0.02)', borderCol = 'rgba(56, 189, 248, 0.15)', accentCol = '#38bdf8';
                if (alert.type === 'danger') { cardBg = 'rgba(239, 68, 68, 0.03)'; borderCol = 'rgba(239, 68, 68, 0.2)'; accentCol = '#ef4444'; }
                else if (alert.type === 'warning') { cardBg = 'rgba(245, 158, 11, 0.03)'; borderCol = 'rgba(245, 158, 11, 0.2)'; accentCol = 'var(--gold-main)'; }
                return (
                  <motion.div key={index} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '16px 22px', borderRadius: '16px', background: `linear-gradient(90deg, ${cardBg}, rgba(0,0,0,0.2))`, border: `1px solid ${borderCol}`, color: '#f1f5f9', borderRight: `4px solid ${accentCol}` }}>
                    
                    {/* صورة الطالب أو الأيقونة */}
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, fontSize: '1.5rem' }}>
                      {alert.photo ? <img src={alert.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : alert.icon}
                    </div>

                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500, fontSize: '0.95rem', display: 'block' }}>{alert.message}</span>
                    </div>

                    {/* وسام المرحلة */}
                    {alert.level && (
                      <span style={{
                        padding: '4px 14px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 800,
                        background: `${alert.levelColor}15`, color: alert.levelColor,
                        border: `1px solid ${alert.levelColor}30`, whiteSpace: 'nowrap', flexShrink: 0
                      }}>
                        {alert.level}
                      </span>
                    )}

                    {/* نسبة الغياب */}
                    {alert.rate !== null && (
                      <span style={{
                        padding: '4px 12px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 900,
                        background: 'rgba(0,0,0,0.3)', color: accentCol, flexShrink: 0
                      }}>
                        {alert.rate}%
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🧠 تحليل AI */}
      <AnimatePresence>
        {aiAnalysis && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            style={{ background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.03), rgba(168, 85, 247, 0.06))', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '28px', borderRadius: '24px', marginBottom: '35px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '150px', height: '150px', background: 'rgba(168, 85, 247, 0.1)', filter: 'blur(50px)', borderRadius: '50%' }} />
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: '#d8b4fe', marginBottom: '18px', marginTop: 0 }}>🧠 تقرير التحليل الإحصائي التلقائي</h3>
            <div style={{ color: '#cbd5e1', lineHeight: '1.9', fontSize: '1rem', position: 'relative', zIndex: 1 }}>
              {aiAnalysis.split('\n').map((line, i) => (
                <p key={i} style={{ marginBottom: '10px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                  {line.trim().startsWith('*') || line.trim().startsWith('-') ? (
                    <><span style={{ color: '#a855f7' }}>✦</span><span>{line.replace(/^[\*\-\s]+/, '')}</span></>
                  ) : line}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🧭 الشريط السفلي */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', padding: '16px 25px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '18px', alignItems: 'center' }}>
        <div style={{ fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>📅 </span>
          <span style={{ color: 'var(--gold-light)', fontWeight: 600 }}>{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div style={{ fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>🕐 </span>
          <span style={{ color: 'var(--white)', fontWeight: 600 }}>{new Date().toLocaleTimeString('ar-SA')}</span>
        </div>
        <div style={{ fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>🤖 </span>
          <span style={{ color: 'var(--green-bright)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '7px', height: '7px', background: 'var(--green-bright)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} /> 
            مستقر (Local SQLite Node)
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default Dashboard;
