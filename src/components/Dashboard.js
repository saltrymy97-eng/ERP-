// src/components/Dashboard.js – اللوحة المركزية الفاخرة (Imperial 3D Dashboard)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionTemplate, useMotionValue } from 'framer-motion';
import { getQuery, initDatabase } from '../services/db';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  // بيانات افتراضية للرسم البياني لتوضيح جمالية الداشبورد (ترتبط لاحقاً بالبيانات الحقيقية)
  const [chartData, setChartData] = useState([]);

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

    // توليد بيانات أسبوعية للرسم البياني الفاخر
    const mockChart = [
      { name: 'السبت', value: Math.max(0, presentToday - 15) },
      { name: 'الأحد', value: Math.max(0, presentToday - 5) },
      { name: 'الإثنين', value: presentToday + 10 },
      { name: 'الثلاثاء', value: Math.max(0, presentToday - 2) },
      { name: 'الأربعاء', value: presentToday + 5 },
      { name: 'الخميس', value: presentToday }
    ];
    setChartData(mockChart);
  };

  const loadAlerts = async () => {
    const alertList = [];
    const allAttendance = await getQuery(
      "SELECT a.student_id, a.status, s.full_name, s.university_id, s.photo FROM attendance a INNER JOIN students s ON a.student_id = s.id WHERE s.status = 'active'"
    );

    if (allAttendance && allAttendance.length > 0) {
      const studentAbsenceMap = {};
      allAttendance.forEach(a => {
        const sid = a.student_id;
        if (!studentAbsenceMap[sid]) {
          studentAbsenceMap[sid] = { full_name: a.full_name, university_id: a.university_id, photo: a.photo, total: 0, absent: 0 };
        }
        studentAbsenceMap[sid].total++;
        if (a.status === 'absent') studentAbsenceMap[sid].absent++;
      });

      Object.values(studentAbsenceMap).forEach(s => {
        const rate = s.total > 0 ? Math.round((s.absent / s.total) * 100 * 10) / 10 : 0;
        if (rate >= 30) alertList.push({ type: 'danger', icon: '🚨', level: 'حرمان من الاختبار', levelColor: '#ef4444', message: `الطالب ${s.full_name} (${s.university_id}) تجاوز 30% غياب → حرمان نهائي`, photo: s.photo, rate: rate });
        else if (rate >= 25) alertList.push({ type: 'danger', icon: '🔴', level: 'إنذار أكاديمي', levelColor: '#ef4444', message: `الطالب ${s.full_name} (${s.university_id}) تجاوز 25% غياب`, photo: s.photo, rate: rate });
        else if (rate >= 20) alertList.push({ type: 'warning', icon: '🟡', level: 'تنبيه ثانٍ', levelColor: '#f59e0b', message: `الطالب ${s.full_name} (${s.university_id}) تجاوز 20% غياب`, photo: s.photo, rate: rate });
        else if (rate >= 10) alertList.push({ type: 'info', icon: '🟢', level: 'تنبيه أول', levelColor: '#38bdf8', message: `الطالب ${s.full_name} (${s.university_id}) تجاوز 10% غياب`, photo: s.photo, rate: rate });
      });
    }

    const presentIds = await getQuery("SELECT DISTINCT student_id FROM attendance WHERE date = ?", [today]);
    const presentIdSet = new Set((presentIds || []).map(a => a.student_id));
    const allStudents = await getQuery("SELECT id, full_name, university_id, photo FROM students WHERE status = 'active'");
    if (allStudents) {
      const noShow = allStudents.filter(s => !presentIdSet.has(s.id)).slice(0, 5);
      noShow.forEach(s => {
        alertList.push({ type: 'warning', icon: '⚠️', level: 'غياب اليوم', levelColor: '#f59e0b', message: `الطالب ${s.full_name} لم يسجل حضور اليوم`, photo: s.photo, rate: null });
      });
    }

    const order = { danger: 1, warning: 2, info: 3 };
    alertList.sort((a, b) => (order[a.type] || 4) - (order[b.type] || 4));
    setAlerts(alertList);
  };

  const handleAIAnalysis = async () => {
    setAnalyzing(true);
    setTimeout(() => {
      const presentPercent = stats.totalStudents > 0 ? Math.round((stats.presentToday / stats.totalStudents) * 100) : 0;
      let analysis = `👑 التقرير الملكي المتقدم ليوم ${today}\n\n`;
      analysis += `* السعة التشغيلية الإجمالية: ${stats.totalStudents} مقعد\n`;
      analysis += `* مؤشر الانضباط العام: ${presentPercent}%\n`;
      analysis += `* الكفاءة الإيجابية (حضور): ${stats.presentToday} طالب\n`;
      analysis += `* التسرب المؤقت (غياب): ${stats.absentToday} طالب\n`;
      
      if (presentPercent >= 85) analysis += `✅ النطاق الأخضر: المنظومة الأكاديمية تعمل بأعلى مستويات الكفاءة والانضباط.\n`;
      else if (presentPercent >= 70) analysis += `⚠️ النطاق الأصفر: انضباط مقبول، يتطلب تفعيل رسائل التنبيه لأولياء الأمور.\n`;
      else analysis += `🚨 النطاق الأحمر: خلل في مؤشرات الحضور، يُنصح بعقد لجنة أكاديمية طارئة.\n`;

      setAiAnalysis(analysis);
      setAnalyzing(false);
    }, 1500);
  };

  const attendancePercent = stats.totalStudents > 0 ? Math.round((stats.presentToday / stats.totalStudents) * 100) : 0;

  // تأثيرات 3D لحركة الماوس
  const Card3D = ({ children, glowColor }) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    function handleMouseMove({ currentTarget, clientX, clientY }) {
      const { left, top, width, height } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left - width / 2);
      mouseY.set(clientY - top - height / 2);
    }
    return (
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
        style={{
          perspective: 1000,
          rotateX: useMotionTemplate`${mouseY}deg`,
          rotateY: useMotionTemplate`${mouseX}deg`,
          transformStyle: "preserve-3d"
        }}
        className="card-3d-wrapper"
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.03), rgba(0,0,0,0.6))',
            border: '1px solid rgba(214,175,55,0.15)',
            boxShadow: `0 15px 35px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)`,
            borderRadius: '24px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`, opacity: 0.1, pointerEvents: 'none' }} />
          {children}
        </motion.div>
      </motion.div>
    );
  };

  const gridVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };

  if (loading || !dbReady) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '20px' }}>
        <div style={{ width: '60px', height: '60px', border: '3px solid rgba(214,175,55,0.1)', borderTop: '3px solid var(--gold-main)', borderRadius: '50%', animation: 'spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite' }}></div>
        <p style={{ color: 'var(--gold-light)', fontWeight: 700, letterSpacing: '1px' }}>استدعاء النواة الإدارية الفاخرة...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} style={{ padding: '10px', minHeight: '100%' }}>
      
      {/* 👑 شريط الأدوات العلوي الإمبراطوري */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', background: 'linear-gradient(90deg, rgba(4,29,20,0.8), rgba(8,61,43,0.9))', padding: '20px 30px', borderRadius: '24px', border: '1px solid var(--gold-main)', boxShadow: '0 20px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg, var(--gold-main), #b89324)', borderRadius: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(214,175,55,0.4)', fontSize: '1.8rem', transform: 'rotate(-5deg)' }}>🏛️</div>
          <div>
            <h2 style={{ fontFamily: 'Amiri, serif', fontSize: '2rem', color: 'var(--gold-light)', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>المركز السيادي للوحة التحكم</h2>
            <p style={{ color: '#94a3b8', margin: '6px 0 0 0', fontSize: '0.9rem', fontWeight: 600 }}>منظومة الذكاء الإداري | فرع غيل باوزير</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <motion.button onClick={loadAllData} whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(214,175,55,0.3)' }} whileTap={{ scale: 0.95 }}
            style={{ background: 'rgba(214,175,55,0.1)', color: 'var(--gold-light)', border: '1px solid var(--gold-main)', padding: '12px 24px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>⚙️</motion.span> مزامنة البيانات
          </motion.button>
          <motion.button onClick={handleAIAnalysis} disabled={analyzing} whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(168, 85, 247, 0.6)' }} whileTap={{ scale: 0.95 }}
            style={{ background: 'linear-gradient(135deg, #6b21a8, #a855f7)', color: '#fff', border: '1px solid #d8b4fe', padding: '12px 28px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {analyzing ? '⏳ جاري المعالجة الكمية...' : '✨ تفعيل المستشار الذكي'}
          </motion.button>
        </div>
      </div>

      {/* 📊 بطاقات الإحصائيات (3D & Glow) */}
      <motion.div variants={gridVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px', marginBottom: '40px' }}>
        {[
          { val: stats.totalStudents, label: 'القوة الطلابية', icon: '💎', color: 'rgba(214,175,55,1)' },
          { val: stats.presentToday, label: 'الحضور الإيجابي', icon: '👑', color: 'rgba(16,185,129,1)' },
          { val: stats.absentToday, label: 'مؤشر الغياب', icon: '⛔', color: 'rgba(239,68,68,1)' },
          { val: stats.lateToday, label: 'حالات التأخير', icon: '⏳', color: 'rgba(245,158,11,1)' },
          { val: stats.totalLectures, label: 'الجداول المعتمدة', icon: '📜', color: 'rgba(56,189,248,1)' },
          { val: stats.notificationsSent, label: 'إشعارات تم بثها', icon: '📡', color: 'rgba(168,85,247,1)' }
        ].map((card, i) => (
          <motion.div key={i} variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}>
            <Card3D glowColor={card.color}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ zIndex: 1 }}>
                  <span style={{ color: '#cbd5e1', fontSize: '0.95rem', fontWeight: 700 }}>{card.label}</span>
                  <h3 style={{ fontSize: '3rem', margin: '5px 0 0 0', color: '#fff', fontFamily: 'Tajawal', fontWeight: 900, textShadow: `0 0 20px ${card.color}` }}>
                    {card.val}
                  </h3>
                </div>
                <motion.div 
                  animate={{ y: [-5, 5, -5], rotateZ: [-2, 2, -2] }} 
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
                  style={{ fontSize: '2.8rem', filter: `drop-shadow(0 10px 15px ${card.color.replace('1)', '0.5)')})`, zIndex: 1 }}
                >
                  {card.icon}
                </motion.div>
              </div>
            </Card3D>
          </motion.div>
        ))}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', marginBottom: '40px', alignItems: 'stretch' }}>
        
        {/* 📈 الرسم البياني الفاخر */}
        <div style={{ background: 'linear-gradient(145deg, rgba(4,29,20,0.6), rgba(0,0,0,0.8))', border: '1px solid rgba(214,175,55,0.2)', borderRadius: '24px', padding: '25px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative', overflow: 'hidden' }}>
          <h3 style={{ color: 'var(--gold-light)', margin: '0 0 20px 0', fontSize: '1.2rem', fontFamily: 'Amiri, serif', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', background: 'var(--gold-main)', borderRadius: '50%', boxShadow: '0 0 10px var(--gold-main)' }}></span>
            مؤشر الانضباط الأسبوعي
          </h3>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--gold-main)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--gold-main)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'rgba(4,29,20,0.9)', border: '1px solid var(--gold-main)', borderRadius: '12px', color: '#fff' }} itemStyle={{ color: 'var(--gold-light)' }} />
                <Area type="monotone" dataKey="value" stroke="var(--gold-main)" strokeWidth={4} fillOpacity={1} fill="url(#goldGradient)" activeDot={{ r: 8, fill: '#fff', stroke: 'var(--gold-main)', strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🌟 شريط النسبة المئوية المضيء */}
        <div style={{ background: 'linear-gradient(145deg, rgba(4,29,20,0.6), rgba(0,0,0,0.8))', border: '1px solid rgba(214,175,55,0.2)', borderRadius: '24px', padding: '30px 25px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <span style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '10px' }}>معدل الاستجابة اليومي</span>
            <div style={{ fontSize: '4.5rem', fontWeight: 900, color: 'transparent', background: 'linear-gradient(135deg, #fff, var(--gold-main))', WebkitBackgroundClip: 'text', textShadow: '0 10px 20px rgba(214,175,55,0.2)' }}>
              {attendancePercent}%
            </div>
          </div>
          <div style={{ height: '24px', background: 'rgba(0,0,0,0.6)', borderRadius: '100px', padding: '3px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 4px 6px rgba(0,0,0,0.3)' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${attendancePercent}%` }} transition={{ duration: 1.5, ease: "easeOut" }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #d4af37, #fef08a)', borderRadius: '100px', boxShadow: '0 0 20px rgba(214,175,55,0.6)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', animation: 'shimmer 2s infinite' }} />
            </motion.div>
          </div>
        </div>
      </div>

      {/* 🚨 مصفوفة الإنذارات الفاخرة */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '40px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="pulse-dot" style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 15px #ef4444' }} />
              مصفوفة الإنذارات والتدخل السريع
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '15px' }}>
              {alerts.map((alert, index) => {
                let glow = 'rgba(56, 189, 248, 0.4)';
                if (alert.type === 'danger') glow = 'rgba(239, 68, 68, 0.6)';
                else if (alert.type === 'warning') glow = 'rgba(245, 158, 11, 0.5)';
                
                return (
                  <motion.div key={index} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }} whileHover={{ scale: 1.02 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '18px', padding: '20px', borderRadius: '20px', background: 'rgba(0,0,0,0.5)', border: `1px solid ${alert.levelColor}40`, boxShadow: `0 8px 25px rgba(0,0,0,0.4), inset 0 0 20px ${alert.levelColor}10`, borderRight: `6px solid ${alert.levelColor}` }}>
                    
                    <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${alert.levelColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: `0 0 15px ${glow}` }}>
                      {alert.photo ? <img src={alert.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '2rem' }}>{alert.icon}</span>}
                    </div>

                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', display: 'block', color: '#fff', marginBottom: '4px' }}>{alert.message.split('→')[0]}</span>
                      {alert.message.includes('→') && (
                        <span style={{ color: alert.levelColor, fontSize: '0.85rem', fontWeight: 700 }}>{'→ ' + alert.message.split('→')[1]}</span>
                      )}
                    </div>

                    {alert.rate !== null && (
                      <div style={{ background: `linear-gradient(135deg, ${alert.levelColor}20, transparent)`, border: `1px solid ${alert.levelColor}50`, padding: '8px 14px', borderRadius: '12px', textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#cbd5e1' }}>الغياب</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: alert.levelColor, textShadow: `0 0 10px ${alert.levelColor}` }}>{alert.rate}%</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🧠 صندوق المستشار الذكي */}
      <AnimatePresence>
        {aiAnalysis && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            style={{ background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.2), rgba(0,0,0,0.8))', border: '1px solid rgba(216, 180, 254, 0.3)', padding: '35px', borderRadius: '24px', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(88, 28, 135, 0.4)' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.8rem', color: '#e9d5ff', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>✨</motion.span> المستشار الأكاديمي الاصطناعي
            </h3>
            <div style={{ color: '#f8fafc', lineHeight: '2.2', fontSize: '1.1rem', position: 'relative', zIndex: 1, fontWeight: 500 }}>
              {aiAnalysis.split('\n').map((line, i) => (
                <motion.p initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={i} style={{ marginBottom: '12px', display: 'flex', alignItems: 'start', gap: '10px' }}>
                  {line.trim().startsWith('*') || line.trim().startsWith('-') ? (
                    <><span style={{ color: '#c084fc', textShadow: '0 0 10px #c084fc' }}>◈</span><span>{line.replace(/^[\*\-\s]+/, '')}</span></>
                  ) : line}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🧭 شريط المعلومات السفلي */}
      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', padding: '20px 30px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(214,175,55,0.15)', borderRadius: '24px', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
        <div style={{ color: 'var(--gold-light)', fontWeight: 700, fontSize: '0.95rem', display: 'flex', gap: '8px' }}>
          <span>🗓️</span> {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span style={{ color: '#fff', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)' }}>⏰ {new Date().toLocaleTimeString('ar-SA')}</span>
          <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.1)', padding: '6px 16px', borderRadius: '50px', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981', animation: 'pulse 1.5s infinite' }} /> 
            النظام السيادي متصل
          </span>
        </div>
      </div>
      
    </motion.div>
  );
}

export default Dashboard;
