// src/components/Attendance.js – نظام رصد الحضور والانصراف (SQLite محلية + صورة الطالب)
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery, initDatabase } from '../services/db';

function Attendance() {
  const [tab, setTab] = useState('live');
  const [students, setStudents] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [scanningId, setScanningId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0 });
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dbReady, setDbReady] = useState(false);

  const attendanceTimeoutRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  // ========== تهيئة قاعدة البيانات ==========
  useEffect(() => {
    const setup = async () => {
      await initDatabase();
      setDbReady(true);
      await loadStudents();
      await loadTodayAttendance();
      await loadStats();
    };
    setup();
    return () => {
      if (attendanceTimeoutRef.current) clearTimeout(attendanceTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (tab === 'monthly' && dbReady) {
      loadMonthlyData();
    }
  }, [selectedMonth, tab, dbReady]);

  // ========== تحميل الطلاب النشطين ==========
  const loadStudents = async () => {
    const data = await getQuery(
      "SELECT id, university_id, full_name, phone, photo, major_name, department_name, college_name FROM students WHERE status = 'active' ORDER BY full_name"
    );
    setStudents(data || []);
  };

  // ========== تحميل حضور اليوم ==========
  const loadTodayAttendance = async () => {
    const data = await getQuery(
      `SELECT a.id, a.student_id, a.date, a.time_in, a.time_out, a.status, a.method, a.late_minutes,
              s.full_name, s.university_id, s.phone, s.photo, s.major_name, s.college_name
       FROM attendance a
       INNER JOIN students s ON a.student_id = s.id
       WHERE a.date = ?
       ORDER BY a.time_in DESC`,
      [today]
    );
    setTodayAttendance(data || []);
  };

  // ========== إحصائيات اليوم ==========
  const loadStats = async () => {
    const data = await getQuery(
      "SELECT student_id, status FROM attendance WHERE date = ?",
      [today]
    );

    if (!data || data.length === 0) {
      return setStats({ present: 0, absent: 0, late: 0 });
    }

    // تجميع فريد حسب الطالب
    const uniqueMap = {};
    data.forEach(a => { uniqueMap[a.student_id] = a; });
    const uniqueRecords = Object.values(uniqueMap);

    const present = uniqueRecords.filter(a => a.status === 'present').length;
    const absent = uniqueRecords.filter(a => a.status === 'absent').length;
    const late = uniqueRecords.filter(a => a.status === 'late').length;

    setStats({ present: present + late, absent, late });
  };

  // ========== تسجيل الحضور ==========
  const markAttendance = async (student, status = 'present') => {
    if (attendanceTimeoutRef.current) {
      clearTimeout(attendanceTimeoutRef.current);
    }

    // التحقق من غياب إداري مسبق
    const checkAbsent = await getQuery(
      "SELECT status FROM attendance WHERE student_id = ? AND date = ? AND status = 'absent'",
      [student.id, today]
    );

    if (checkAbsent && checkAbsent.length > 0) {
      setAttendanceStatus({
        student: student.full_name,
        time: '—',
        status: 'مرفوض! حالة غياب مقيدة الإدارة ولا يمكن تخطيها',
        icon: '❌',
        color: '#ef4444'
      });
      return;
    }

    setScanningId(student.id);

    attendanceTimeoutRef.current = setTimeout(async () => {
      const now = new Date();
      const timeNow = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const lateThreshold = '08:15';
      const isLate = timeNow > lateThreshold && status === 'present';
      const currentStatus = isLate ? 'late' : status;

      // فحص وجود سجل سابق
      const exists = await getQuery(
        "SELECT id FROM attendance WHERE student_id = ? AND date = ?",
        [student.id, today]
      );

      if (exists && exists.length > 0) {
        await runQuery(
          "UPDATE attendance SET status = ?, time_in = ? WHERE student_id = ? AND date = ?",
          [currentStatus, timeNow, student.id, today]
        );
      } else {
        await runQuery(
          "INSERT INTO attendance (student_id, date, time_in, status, late_minutes, method) VALUES (?, ?, ?, ?, ?, ?)",
          [student.id, today, timeNow, currentStatus, isLate ? 15 : 0, 'fingerprint']
        );
      }

      setAttendanceStatus({
        student: student.full_name,
        time: timeNow,
        status: isLate ? 'تأخير غير مبرر' : 'حضور معتمد',
        icon: isLate ? '⚠️' : '✨',
        color: isLate ? 'var(--gold-main)' : 'var(--green-bright)'
      });

      setScanningId(null);
      attendanceTimeoutRef.current = null;
      await loadTodayAttendance();
      await loadStats();
    }, 1200);
  };

  // ========== تسجيل غياب يدوي ==========
  const markAbsent = async (student) => {
    if (scanningId === student.id && attendanceTimeoutRef.current) {
      clearTimeout(attendanceTimeoutRef.current);
      attendanceTimeoutRef.current = null;
      setScanningId(null);
    }

    const exists = await getQuery(
      "SELECT id FROM attendance WHERE student_id = ? AND date = ?",
      [student.id, today]
    );

    if (exists && exists.length > 0) {
      await runQuery(
        "UPDATE attendance SET status = 'absent', time_in = NULL WHERE student_id = ? AND date = ?",
        [student.id, today]
      );
    } else {
      await runQuery(
        "INSERT INTO attendance (student_id, date, status, method) VALUES (?, ?, 'absent', 'manual')",
        [student.id, today]
      );
    }

    setAttendanceStatus({
      student: student.full_name,
      time: '—',
      status: 'حالة غياب مقيدة الإدارة',
      icon: '❌',
      color: '#ef4444'
    });

    await loadTodayAttendance();
    await loadStats();
  };

  // ========== تسجيل انصراف ==========
  const markExit = async (attendanceId) => {
    const now = new Date();
    const timeNow = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    await runQuery(
      "UPDATE attendance SET time_out = ? WHERE id = ?",
      [timeNow, attendanceId]
    );

    await loadTodayAttendance();
  };

  // ========== التقرير الشهري ==========
  const loadMonthlyData = async () => {
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;

    const data = await getQuery(
      `SELECT a.student_id, a.status, s.full_name, s.university_id, s.college_name
       FROM attendance a
       INNER JOIN students s ON a.student_id = s.id
       WHERE a.date >= ? AND a.date <= ?
       ORDER BY s.full_name`,
      [startDate, endDate]
    );

    if (!data || data.length === 0) {
      setMonthlyData([]);
      return;
    }

    // تجميع حسب الطالب
    const studentMap = {};
    data.forEach(a => {
      const sid = a.student_id;
      if (!studentMap[sid]) {
        studentMap[sid] = {
          id: sid,
          full_name: a.full_name,
          university_id: a.university_id,
          college_name: a.college_name,
          present_days: 0,
          absent_days: 0,
          late_days: 0,
          total_days: 0,
          rate: 0
        };
      }
      studentMap[sid].total_days++;
      if (a.status === 'present') studentMap[sid].present_days++;
      if (a.status === 'absent') studentMap[sid].absent_days++;
      if (a.status === 'late') studentMap[sid].late_days++;
    });

    const result = Object.values(studentMap).map(s => ({
      ...s,
      rate: s.total_days > 0 ? Math.round((s.present_days + s.late_days) / s.total_days * 100) : 0
    }));

    setMonthlyData(result);
  };

  // ========== إعادة ضبط حضور طالب ==========
  const resetAttendance = async (studentId) => {
    await runQuery(
      "DELETE FROM attendance WHERE student_id = ? AND date = ?",
      [studentId, today]
    );
    await loadTodayAttendance();
    await loadStats();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.96 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100 } }
  };

  // ========== واجهة المستخدم ==========
  return (
    <div className="attendance-module" style={{ padding: '5px 0' }}>
      
      {!dbReady && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gold-light)' }}>
          ⏳ جاري تهيئة قاعدة البيانات المحلية...
        </div>
      )}

      {dbReady && (
        <>
          {/* 🧭 شريط التنقل */}
          <div className="tabs" style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '18px', border: '1px solid var(--glass-border)', marginBottom: '30px' }}>
            {[
              { id: 'live', label: '🖐️ نظام مسح البصمة المباشر' },
              { id: 'today', label: '📋 بيان الحضور اليومي للمقاعد', action: () => { loadTodayAttendance(); loadStats(); } },
              { id: 'monthly', label: '📊 مصفوفة التقارير الشهرية التراكمية', action: loadMonthlyData }
            ].map(t => (
              <motion.button
                key={t.id}
                className={`tab-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => { setTab(t.id); if(t.action) t.action(); setAttendanceStatus(null); }}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                  background: tab === t.id ? 'linear-gradient(135deg, var(--gold-main), #b89324)' : 'rgba(255,255,255,0.03)',
                  color: tab === t.id ? '#062b1e' : 'var(--text-secondary)',
                  border: tab === t.id ? '1px solid var(--gold-light)' : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: tab === t.id ? '0 8px 20px rgba(214,175,55,0.15)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {t.label}
              </motion.button>
            ))}
          </div>

          {/* 🟢 تسجيل الحضور المباشر */}
          {tab === 'live' && (
            <div className="live-attendance">
              <div className="live-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
                <div>
                  <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.7rem', color: 'var(--gold-light)', margin: 0 }}>🖐️ بوابات رصد البصمة البيومترية الحية</h3>
                  <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0', fontSize: '0.88rem' }}>انقر فوق كرت الطالب لمحاكاة وضع إبهام الطالب فوق مستشعر الحضور</p>
                </div>
                <input
                  type="text"
                  placeholder="🔍 ابحث بالاسم أو الرقم الجامعي..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', maxWidth: '360px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 18px', borderRadius: '14px', color: '#fff', outline: 'none' }}
                />
              </div>

              <AnimatePresence>
                {attendanceStatus && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20, scale: 0.9 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.8 }}
                    style={{
                      background: 'linear-gradient(135deg, #062b1e, #0c4733)', border: `1px solid ${attendanceStatus.color}`,
                      padding: '15px 25px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px',
                      marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
                    }}
                  >
                    <span style={{ fontSize: '2rem', animation: 'pulse 1.5s infinite', color: attendanceStatus.color }}>{attendanceStatus.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{attendanceStatus.student}</h4>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        موقع السجل الزمني: <strong style={{ color: 'var(--gold-light)' }}>{attendanceStatus.time}</strong> | الحالة: <span style={{ color: attendanceStatus.color, fontWeight: 'bold' }}>{attendanceStatus.status}</span>
                      </p>
                    </div>
                    <button onClick={() => setAttendanceStatus(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.6 }}>✕</button>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div className="students-grid" variants={containerVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {students
                  .filter(s => s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.university_id?.includes(searchTerm))
                  .map(student => {
                    const todayRecord = todayAttendance.find(a => a.student_id === student.id);
                    const isPresent = todayRecord?.status === 'present';
                    const isLate = todayRecord?.status === 'late';
                    const isAbsent = todayRecord?.status === 'absent';
                    const isScanning = scanningId === student.id;

                    let borderStyle = '1px solid var(--glass-border)';
                    let glowEffect = 'none';
                    if (isPresent) { borderStyle = '1px solid var(--emerald-light)'; glowEffect = '0 5px 15px rgba(16,185,129,0.1)'; }
                    if (isLate) { borderStyle = '1px solid var(--gold-main)'; glowEffect = '0 5px 15px rgba(214,175,55,0.1)'; }
                    if (isAbsent) { borderStyle = '1px solid #ef4444'; glowEffect = '0 5px 15px rgba(239,68,68,0.1)'; }
                    if (isScanning) { borderStyle = '1px solid var(--green-bright)'; glowEffect = '0 0 25px var(--green-bright)'; }

                    return (
                      <motion.div
                        key={student.id}
                        variants={cardVariants}
                        whileHover={{ y: isScanning ? 0 : -5 }}
                        style={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,255,255,0.03))',
                          backdropFilter: 'blur(10px)', border: borderStyle, borderRadius: '20px', padding: '20px',
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: glowEffect,
                          position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.3s, border 0.3s'
                        }}
                      >
                        {isScanning && (
                          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--green-bright)', animation: 'loading 1s linear infinite' }} />
                        )}

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                          <div style={{ width: '65px', height: '65px', borderRadius: '50%', border: '2px solid var(--gold-main)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', overflow: 'hidden', flexShrink: 0 }}>
                            {student.photo ? (
                              <img src={student.photo} alt={student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              '🎓'
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>{student.full_name}</span>
                            <span style={{ color: 'var(--gold-light)', fontSize: '0.85rem', fontWeight: 600 }}>🔢 {student.university_id}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>🏛️ {student.college_name || 'بدون كلية'} - {student.major_name}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '5px' }}>
                          {!isPresent && !isLate && !isAbsent && (
                            <>
                              <motion.button
                                onClick={() => markAttendance(student, 'present')}
                                disabled={scanningId !== null}
                                whileHover={{ scale: scanningId !== null ? 1 : 1.03 }}
                                style={{ flex: 2, background: scanningId !== null ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: scanningId !== null ? 'var(--text-secondary)' : '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: scanningId !== null ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                              >
                                {isScanning ? '📶 جاري الفحص...' : '🖐️ مسح البصمة'}
                              </motion.button>
                              <button
                                onClick={() => markAbsent(student)}
                                disabled={scanningId !== null && scanningId !== student.id}
                                style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                ❌ غياب
                              </button>
                            </>
                          )}

                          {(isPresent || isLate || isAbsent) && (
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                padding: '6px 16px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800,
                                background: isPresent ? 'rgba(16,185,129,0.1)' : isLate ? 'rgba(214,175,55,0.1)' : 'rgba(239,68,68,0.1)',
                                color: isPresent ? 'var(--green-bright)' : isLate ? 'var(--gold-main)' : '#ef4444',
                                border: `1px solid ${isPresent ? 'rgba(16,185,129,0.2)' : isLate ? 'rgba(214,175,55,0.2)' : 'rgba(239,68,68,0.2)'}`
                              }}>
                                {isPresent ? '✅ حاضر بالمنصة' : isLate ? '⚠️ قيد متأخراً' : '❌ غياب معتمد'}
                              </span>
                              <button 
                                disabled={scanningId !== null}
                                onClick={async () => {
                                  if(window.confirm("هل ترغب في إعادة فتح بوابة الفحص لهذا الطالب؟")) {
                                    await resetAttendance(student.id);
                                  }
                                }} 
                                style={{ background: 'none', border: 'none', color: scanningId !== null ? 'rgba(255,255,255,0.1)' : 'var(--text-secondary)', cursor: scanningId !== null ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                              >
                                🔄 إعادة ضبط
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
              </motion.div>
            </div>
          )}

          {/* 📊 بيان الحضور اليومي */}
          {tab === 'today' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="today-attendance">
              <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                {[
                  { label: 'الطلاب الحاضرين اليوم', count: stats.present, color: 'var(--green-bright)', bg: 'rgba(16,185,129,0.03)', border: 'rgba(16,185,129,0.15)' },
                  { label: 'حالات الغياب المرصودة', count: stats.absent, color: '#ef4444', bg: 'rgba(239,68,68,0.03)', border: 'rgba(239,68,68,0.15)' },
                  { label: 'إجمالي المتأخرين صباحاً', count: stats.late, color: 'var(--gold-main)', bg: 'rgba(214,175,55,0.03)', border: 'rgba(214,175,55,0.15)' }
                ].map((s, idx) => (
                  <div key={idx} style={{ background: `linear-gradient(135deg, ${s.bg}, rgba(0,0,0,0.2))`, border: `1px solid ${s.border}`, padding: '20px', borderRadius: '18px', textAlign: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>{s.label}</span>
                    <h2 style={{ fontSize: '2.5rem', margin: '5px 0 0 0', color: s.color, fontFamily: 'Tajawal', fontWeight: 900 }}>{s.count}</h2>
                  </div>
                ))}
              </div>

              <div className="tab-header" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>📋 كشف بيان التوقيع الإلكتروني لليوم ({today})</h3>
              </div>

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>صورة</th>
                      <th>الرقم الجامعي</th>
                      <th>اسم الطالب</th>
                      <th>الكلية</th>
                      <th>التخصص</th>
                      <th>توقيت الدخول</th>
                      <th>توقيت الخروج</th>
                      <th>الحالة</th>
                      <th>تحكم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAttendance.map((a, i) => (
                      <tr key={a.id}>
                        <td><strong>{i + 1}</strong></td>
                        <td>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: '1.2rem' }}>
                            {a.photo ? (
                              <img src={a.photo} alt={a.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              '🎓'
                            )}
                          </div>
                        </td>
                        <td style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{a.university_id}</td>
                        <td style={{ color: 'var(--white)', fontWeight: 600 }}>{a.full_name}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{a.college_name || '—'}</td>
                        <td>{a.major_name}</td>
                        <td style={{ fontWeight: 700, color: '#e2e8f0' }}>⏱️ {a.time_in || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>🚪 {a.time_out || '—'}</td>
                        <td>
                          <span style={{
                            padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 700,
                            background: a.status === 'present' ? 'rgba(16,185,129,0.1)' : a.status === 'late' ? 'rgba(214,175,55,0.1)' : 'rgba(239,68,68,0.1)',
                            color: a.status === 'present' ? 'var(--green-bright)' : a.status === 'late' ? 'var(--gold-main)' : '#ef4444'
                          }}>
                            {a.status === 'present' ? 'حاضر معتمد' : a.status === 'late' ? 'متأخر صباحاً' : 'غائب إداري'}
                          </span>
                        </td>
                        <td>
                          {!a.time_out && a.status !== 'absent' ? (
                            <motion.button className="btn-exit" onClick={() => markExit(a.id)} whileHover={{ scale: 1.05 }}
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--gold-main)', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                              🚪 إثبات انصراف
                            </motion.button>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>🔒 مغلق</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {todayAttendance.length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>🚫 لم يتم تسجيل أي حركة حضور اليوم.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* 📊 التقارير الشهرية */}
          {tab === 'monthly' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="monthly-attendance">
              <div className="monthly-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: 0 }}>📊 مصفوفة رصد نسب الغياب والحرمان التراكمية</h3>
                  <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0', fontSize: '0.88rem' }}>تلوين أحمر آلي إذا تراجعت نسبة الحضور عن <strong style={{ color: '#ef4444' }}>75%</strong></p>
                </div>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  style={{ background: '#062b1e', border: '1px solid var(--glass-border)', padding: '10px 15px', borderRadius: '12px', color: '#fff', fontWeight: 700 }} />
              </div>

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>الرقم الجامعي</th><th>اسم الطالب</th><th>الكلية</th><th>أيام الحضور</th><th>أيام الغياب</th><th>أيام التأخير</th><th>نسبة الالتزام</th><th>التقييم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, i) => {
                      const isDanger = m.rate < 75;
                      return (
                        <tr key={i} style={{ background: isDanger ? 'rgba(239,68,68,0.03)' : 'none' }}>
                          <td><strong>{i + 1}</strong></td>
                          <td style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{m.university_id}</td>
                          <td style={{ color: 'var(--white)', fontWeight: 600 }}>{m.full_name}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{m.college_name || '—'}</td>
                          <td style={{ color: 'var(--green-bright)', fontWeight: 700 }}>{m.present_days || 0} أيام</td>
                          <td style={{ color: '#ef4444', fontWeight: 700 }}>{m.absent_days || 0} أيام</td>
                          <td style={{ color: 'var(--gold-main)' }}>{m.late_days || 0} مـرة</td>
                          <td>
                            <span style={{
                              padding: '4px 12px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800,
                              background: (m.rate || 0) >= 90 ? 'rgba(16,185,129,0.1)' : (m.rate || 0) >= 75 ? 'rgba(214,175,55,0.1)' : 'rgba(239,68,68,0.1)',
                              color: (m.rate || 0) >= 90 ? 'var(--green-bright)' : (m.rate || 0) >= 75 ? 'var(--gold-main)' : '#ef4444'
                            }}>
                              {m.rate || 0}%
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {(m.rate || 0) >= 90 ? '🥇 منضبط وممتاز' : (m.rate || 0) >= 75 ? '🥈 مستقر وجيد' : '⚠️ تحت إنذار الحرمان'}
                          </td>
                        </tr>
                      );
                    })}
                    {monthlyData.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>📭 لا توجد حركات توقيع مسجلة لهذا الشهر.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

export default Attendance;
