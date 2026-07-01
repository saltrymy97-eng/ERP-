// src/components/Attendance.js – نظام رصد الحضور والانصراف (مصلح ومتوافق تماماً مع بنية SQLite 4.0 والربط المحلي)
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery, initDatabase } from '../services/db';
import { notifyParent } from '../services/whatsapp'; // استيراد دالة إرسال الفردي لتوثيق وبث الحالات بدقة

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
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationResult, setNotificationResult] = useState(null);

  const attendanceTimeoutRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  // ========== تهيئة قاعدة البيانات ==========
  useEffect(() => {
    let isMounted = true;
    const setup = async () => {
      try {
        await initDatabase();
        if (isMounted) {
          setDbReady(true);
          const loadedStudents = await loadStudents();
          const loadedAttendance = await loadTodayAttendance();
          await loadStats(loadedAttendance);
        }
      } catch (error) {
        console.error("خطأ أثناء تهيئة واجهة الحضور:", error);
      }
    };
    setup();
    return () => {
      isMounted = false;
      if (attendanceTimeoutRef.current) clearTimeout(attendanceTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (tab === 'monthly' && dbReady) {
      loadMonthlyData();
    }
  }, [selectedMonth, tab, dbReady]);

  // ========== تحميل الطلاب مع جلب أسماء الكليات والتخصصات بالربط الصحيح ==========
  const loadStudents = async () => {
    const data = await getQuery(`
      SELECT s.id, s.university_id, s.full_name, s.phone, s.photo, s.status,
             m.name AS major_name,
             c.name AS college_name
      FROM students s
      LEFT JOIN majors m ON s.major_id = m.id
      LEFT JOIN departments d ON m.department_id = d.id
      LEFT JOIN colleges c ON d.college_id = c.id
      WHERE s.status = 'active' OR s.status IS NULL OR s.status = ''
      ORDER BY s.full_name
    `);
    setStudents(data || []);
    return data || [];
  };

  // ========== تحميل حضور اليوم بالربط الصحيح ==========
  const loadTodayAttendance = async () => {
    const data = await getQuery(`
      SELECT a.id, a.student_id, a.date, a.time_in, a.time_out, a.status, a.method, a.late_minutes,
             s.full_name, s.university_id, s.phone, s.photo,
             m.name AS major_name,
             c.name AS college_name
      FROM attendance a
      INNER JOIN students s ON a.student_id = s.id
      LEFT JOIN majors m ON s.major_id = m.id
      LEFT JOIN departments d ON m.department_id = d.id
      LEFT JOIN colleges c ON d.college_id = c.id
      WHERE a.date = ?
      ORDER BY a.time_in DESC`,
      [today]
    );
    setTodayAttendance(data || []);
    return data || [];
  };

  // ========== إحصائيات اليوم ==========
  const loadStats = async (currentAttendance = null) => {
    const records = currentAttendance || todayAttendance;

    if (!records || records.length === 0) {
      setStats({ present: 0, absent: 0, late: 0 });
      return;
    }

    const uniqueMap = {};
    records.forEach(a => { uniqueMap[a.student_id] = a; });
    const uniqueRecords = Object.values(uniqueMap);

    const present = uniqueRecords.filter(a => a.status === 'present').length;
    const absent = uniqueRecords.filter(a => a.status === 'absent').length;
    const late = uniqueRecords.filter(a => a.status === 'late').length;

    setStats({ present: present + late, absent, late });
  };

  // ========== تسجيل الحضور ومحاكاة البصمة ==========
  const markAttendance = async (student, status = 'present') => {
    if (attendanceTimeoutRef.current) {
      clearTimeout(attendanceTimeoutRef.current);
    }

    const checkAbsent = await getQuery(
      "SELECT status FROM attendance WHERE student_id = ? AND date = ? AND status = 'absent'",
      [student.id, today]
    );

    if (checkAbsent && checkAbsent.length > 0) {
      setAttendanceStatus({
        student: student.full_name,
        time: '—',
        status: 'مرفوض! حالة غياب مقيدة إدارياً ولا يمكن تخطيها اليوم',
        icon: '❌',
        color: '#ef4444'
      });
      return;
    }

    setScanningId(student.id);

    attendanceTimeoutRef.current = setTimeout(async () => {
      const now = new Date();
      const timeNow = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false });
      const lateThreshold = '08:15';
      const isLate = timeNow > lateThreshold && status === 'present';
      const currentStatus = isLate ? 'late' : status;

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
        status: isLate ? 'تأخير غير مبرر للأنظمة' : 'حضور بيومتري معتمد بالمنصة',
        icon: isLate ? '⚠️' : '✨',
        color: isLate ? '#D4AF37' : '#34d399'
      });

      setScanningId(null);
      attendanceTimeoutRef.current = null;
      
      const updatedAttendance = await loadTodayAttendance();
      await loadStats(updatedAttendance);
    }, 1000);
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
        "UPDATE attendance SET status = 'absent', time_in = NULL, time_out = NULL WHERE student_id = ? AND date = ?",
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
      status: 'تم تقييد غياب إداري صارم للطالب عن الجلسة',
      icon: '❌',
      color: '#ef4444'
    });

    const updatedAttendance = await loadTodayAttendance();
    await loadStats(updatedAttendance);
  };

  // ========== تسجيل انصراف ==========
  const markExit = async (attendanceId) => {
    const now = new Date();
    const timeNow = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false });

    await runQuery(
      "UPDATE attendance SET time_out = ? WHERE id = ?",
      [timeNow, attendanceId]
    );

    await loadTodayAttendance();
  };

  // ========== الدالة المعدلة: إرسال إشعارات للغائبين عبر البروتوكول المحلي المتتالي ==========
  const handleNotifyAbsent = async () => {
    // جلب الطلاب المقيدين كـ غياب في جدول الحضور لليوم
    const absentRecords = todayAttendance.filter(record => record.status === 'absent');

    if (absentRecords.length === 0) {
      alert('لا يوجد طلاب غائبون لإرسال إشعارات لهم حالياً.');
      return;
    }

    setSendingNotification(true);
    setNotificationResult(null);
    
    try {
      let successCount = 0;

      // المرور التكراري على الطلاب الغائبين وفتح محادثاتهم محلياً بالترتيب وتوثيقها
      for (const record of absentRecords) {
        const result = await notifyParent(record.student_id, 'absent');
        if (result.success) {
          successCount++;
        }
      }

      if (successCount > 0) {
        setNotificationResult({ 
          type: 'success', 
          message: `✅ تم تجهيز وفتح واجهة البث لعدد (${successCount}) من أولياء الأمور بنجاح.` 
        });
      } else {
        setNotificationResult({ type: 'error', message: `❌ فشل فتح وبث الإشعارات، يرجى مراجعة سجلات الأرقام.` });
      }
    } catch (e) {
      console.error(e);
      setNotificationResult({ type: 'error', message: '❌ حدث خطأ داخلي أثناء معالجة وإطلاق بروتوكول WhatsApp' });
    }
    
    setSendingNotification(false);
    setTimeout(() => setNotificationResult(null), 5000);
  };

  // ========== التقرير الشهري ومصفوفة الحرمان ومواءمة الربط ==========
  const loadMonthlyData = async () => {
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;

    const data = await getQuery(`
      SELECT a.student_id, a.date, a.status, s.full_name, s.university_id,
             c.name AS college_name
      FROM attendance a
      INNER JOIN students s ON a.student_id = s.id
      LEFT JOIN majors m ON s.major_id = m.id
      LEFT JOIN departments d ON m.department_id = d.id
      LEFT JOIN colleges c ON d.college_id = c.id
      WHERE a.date >= ? AND a.date <= ?
      ORDER BY s.full_name`,
      [startDate, endDate]
    );

    if (!data || data.length === 0) {
      setMonthlyData([]);
      return;
    }

    const studentMap = {};
    
    data.forEach(a => {
      const sid = a.student_id;
      const dayKey = `${sid}_${a.date}`;
      
      if (!studentMap[sid]) {
        studentMap[sid] = {
          id: sid,
          full_name: a.full_name,
          university_id: a.university_id,
          college_name: a.college_name,
          present_days: 0,
          absent_days: 0,
          late_days: 0,
          countedDays: new Set()
        };
      }
      
      if (!studentMap[sid].countedDays.has(dayKey)) {
        studentMap[sid].countedDays.add(dayKey);
        
        if (a.status === 'present') studentMap[sid].present_days++;
        if (a.status === 'absent') studentMap[sid].absent_days++;
        if (a.status === 'late') studentMap[sid].late_days++;
      }
    });

    const result = Object.values(studentMap).map(s => {
      const total = s.present_days + s.absent_days + s.late_days;
      return {
        ...s,
        total_days: total,
        rate: total > 0 ? Math.round(((s.present_days + s.late_days) / total) * 100) : 100
      };
    });

    setMonthlyData(result);
  };

  const resetAttendance = async (studentId) => {
    await runQuery(
      "DELETE FROM attendance WHERE student_id = ? AND date = ?",
      [studentId, today]
    );
    const updatedAttendance = await loadTodayAttendance();
    await loadStats(updatedAttendance);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.03 } }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.97 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 120 } }
  };

  return (
    <div className="attendance-module" style={{ padding: '5px 0' }}>
      
      {!dbReady && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#D4AF37' }}>
          ⏳ جاري تهيئة ومزامنة قاعدة البيانات المحلية ومستشعرات البصمة...
        </div>
      )}

      {dbReady && (
        <>
          {/* 🧭 شريط التبويبات العلوي */}
          <div className="tabs" style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '30px' }}>
            {[
              { id: 'live', label: '🖐️ نظام مسح البصمة المباشر' },
              { id: 'today', label: '📋 بيان الحضور اليومي للمقاعد', action: async () => { const att = await loadTodayAttendance(); await loadStats(att); } },
              { id: 'monthly', label: '📊 مصفوفة التقارير الشهرية التراكمية', action: loadMonthlyData }
            ].map(t => (
              <motion.button
                key={t.id}
                className={`tab-btn ${tab === t.id ? 'active' : ''}`}
                onClick={async () => { setTab(t.id); if(t.action) await t.action(); setAttendanceStatus(null); }}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                  background: tab === t.id ? 'linear-gradient(135deg, #D4AF37, #b89324)' : 'rgba(255,255,255,0.03)',
                  color: tab === t.id ? '#041d14' : 'rgba(255,255,255,0.6)',
                  border: tab === t.id ? '1px solid #f3e5ab' : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: tab === t.id ? '0 8px 20px rgba(214,175,55,0.15)' : 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                {t.label}
              </motion.button>
            ))}
          </div>

          {/* 🟢 تبويب: الحضور المباشر */}
          {tab === 'live' && (
            <div className="live-attendance">
              <div className="live-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
                <div>
                  <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.7rem', color: '#f3e5ab', margin: 0 }}>🖐️ بوابات رصد البصمة البيومترية الحية</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', margin: '5px 0 0 0', fontSize: '0.88rem' }}>انقر فوق كرت الطالب لمحاكاة وضع إبهام الطالب فوق مستشعر الحضور</p>
                </div>
                <input
                  type="text"
                  placeholder="🔍 ابحث بالاسم أو الرقم الجامعي للمطابقة..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', maxWidth: '360px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 18px', borderRadius: '14px', color: '#fff', outline: 'none' }}
                />
              </div>

              <AnimatePresence>
                {attendanceStatus && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20, scale: 0.95 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.9 }}
                    style={{
                      background: '#041d14', border: `1px solid ${attendanceStatus.color}`,
                      padding: '15px 25px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px',
                      marginBottom: '25px', boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 15px ${attendanceStatus.color}22`
                    }}
                  >
                    <span style={{ fontSize: '2rem', color: attendanceStatus.color }}>{attendanceStatus.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{attendanceStatus.student}</h4>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                        موقع السجل الزمني: <strong style={{ color: '#f3e5ab' }}>{attendanceStatus.time}</strong> | النتيجة: <span style={{ color: attendanceStatus.color, fontWeight: 'bold' }}>{attendanceStatus.status}</span>
                      </p>
                    </div>
                    <button onClick={() => setAttendanceStatus(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.5 }}>✕</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 🔔 مساحة عرض حالة نتائج بث الواتساب وعمليات التوجيه */}
              <AnimatePresence>
                {notificationResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      padding: '15px', borderRadius: '12px', marginBottom: '20px', fontWeight: 'bold', fontSize: '0.95rem',
                      background: notificationResult.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                      color: notificationResult.type === 'success' ? '#34d399' : '#ef4444',
                      border: `1px solid ${notificationResult.type === 'success' ? '#34d39933' : '#ef444433'}`
                    }}
                  >
                    {notificationResult.message}
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

                    let borderStyle = '1px solid rgba(255,255,255,0.05)';
                    let glowEffect = 'none';
                    if (isPresent) { borderStyle = '1px solid #34d399'; glowEffect = '0 5px 15px rgba(52,211,153,0.1)'; }
                    if (isLate) { borderStyle = '1px solid #D4AF37'; glowEffect = '0 5px 15px rgba(214,175,55,0.1)'; }
                    if (isAbsent) { borderStyle = '1px solid #ef4444'; glowEffect = '0 5px 15px rgba(239,68,68,0.1)'; }
                    if (isScanning) { borderStyle = '1px solid #34d399'; glowEffect = '0 0 25px rgba(52,211,153,0.4)'; }

                    return (
                      <motion.div
                        key={student.id}
                        variants={cardVariants}
                        whileHover={{ y: isScanning ? 0 : -4 }}
                        style={{
                          background: 'rgba(255,255,255,0.01)',
                          backdropFilter: 'blur(10px)', border: borderStyle, borderRadius: '20px', padding: '20px',
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: glowEffect,
                          position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.3s, border 0.3s'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                          <div style={{ width: '65px', height: '65px', borderRadius: '50%', border: '2px solid #D4AF37', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', overflow: 'hidden', flexShrink: 0 }}>
                            {student.photo ? (
                              <img src={student.photo} alt={student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              '🎓'
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>{student.full_name}</span>
                            <span style={{ color: '#f3e5ab', fontSize: '0.85rem', fontWeight: 600 }}>🔢 {student.university_id}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>🏛️ {student.college_name || 'غير محدد'} - {student.major_name || 'بدون تخصص'}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '5px' }}>
                          {!isPresent && !isLate && !isAbsent ? (
                            <>
                              <motion.button
                                onClick={() => markAttendance(student, 'present')}
                                disabled={scanningId !== null}
                                whileTap={{ scale: 0.95 }}
                                style={{ flex: 2, background: 'linear-gradient(135deg, #34d399, #10b981)', color: '#041d14', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: scanningId !== null ? 'not-allowed' : 'pointer' }}
                              >
                                {isScanning ? '📶 جاري قراءة النبض...' : '🖐️ محاكاة مسح البصمة'}
                              </motion.button>
                              <button
                                onClick={() => markAbsent(student)}
                                disabled={scanningId !== null}
                                style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                ❌ غياب
                              </button>
                            </>
                          ) : (
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                padding: '6px 16px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800,
                                background: isPresent ? 'rgba(52,211,153,0.1)' : isLate ? 'rgba(214,175,55,0.1)' : 'rgba(239,68,68,0.1)',
                                color: isPresent ? '#34d399' : isLate ? '#D4AF37' : '#ef4444',
                                border: `1px solid ${isPresent ? 'rgba(52,211,153,0.2)' : isLate ? 'rgba(214,175,55,0.2)' : 'rgba(239,68,68,0.2)'}`
                              }}>
                                {isPresent ? '✅ حاضر بالمنصة' : isLate ? '⚠️ قيد متأخراً' : '❌ غياب معتمد'}
                              </span>
                              <button 
                                onClick={async () => {
                                  if(window.confirm("هل ترغب في إعادة فتح بوابة الفحص لهذا الطالب؟")) {
                                    await resetAttendance(student.id);
                                  }
                                }} 
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                🔄 إعادة فتح البوابة
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                {students.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px' }}>🚫 لا يوجد طلاب مضافين بالنظام حالياً أو لم يتم تنشيط حالاتهم.</div>
                )}
              </motion.div>
            </div>
          )}

          {/* 📊 تبويب: بيان الحضور اليومي */}
          {tab === 'today' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="today-attendance">
              <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                {[
                  { label: 'الطلاب الحاضرين اليوم', count: stats.present, color: '#34d399', bg: 'rgba(52,211,153,0.02)', border: 'rgba(52,211,153,0.1)' },
                  { label: 'حالات الغياب المرصودة', count: stats.absent, color: '#ef4444', bg: 'rgba(239,68,68,0.02)', border: 'rgba(239,68,68,0.1)' },
                  { label: 'إجمالي المتأخرين صباحاً', count: stats.late, color: '#D4AF37', bg: 'rgba(214,175,55,0.02)', border: 'rgba(214,175,55,0.1)' }
                ].map((s, idx) => (
                  <div key={idx} style={{ background: `linear-gradient(135deg, ${s.bg}, rgba(0,0,0,0.3))`, border: `1px solid ${s.border}`, padding: '20px', borderRadius: '18px', textAlign: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', fontWeight: 600 }}>{s.label}</span>
                    <h2 style={{ fontSize: '2.5rem', margin: '5px 0 0 0', color: s.color, fontWeight: 900 }}>{s.count}</h2>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: '#f3e5ab', margin: 0 }}>📋 كشف بيان التوقيع الإلكتروني لليوم ({today})</h3>
                
                <motion.button
                  onClick={handleNotifyAbsent}
                  disabled={sendingNotification || stats.absent === 0}
                  whileHover={{ scale: stats.absent > 0 ? 1.02 : 1 }}
                  style={{
                    background: sendingNotification ? 'rgba(255,255,255,0.05)' : stats.absent > 0 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(255,255,255,0.05)',
                    color: stats.absent > 0 ? '#fff' : 'rgba(255,255,255,0.3)',
                    border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: stats.absent > 0 && !sendingNotification ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem'
                  }}
                >
                  {sendingNotification ? '⏳ جاري بث الرسائل...' : `💬 بث إشعار WhatsApp للغائبين (${stats.absent})`}
                </motion.button>
              </div>

              {/* 🔔 مساحة عرض حالة نتائج بث الواتساب وعمليات التوجيه داخل تبويب الكشف اليومي */}
              <AnimatePresence>
                {notificationResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      padding: '12px 20px', borderRadius: '10px', marginBottom: '20px', fontWeight: 'bold', fontSize: '0.9rem',
                      background: notificationResult.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                      color: notificationResult.type === 'success' ? '#34d399' : '#ef4444',
                      border: `1px solid ${notificationResult.type === 'success' ? '#34d39933' : '#ef444433'}`
                    }}
                  >
                    {notificationResult.message}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>صورة</th><th>الرقم الجامعي</th><th>اسم الطالب</th><th>الكلية</th><th>التخصص</th><th>توقيت الدخول</th><th>توقيت الخروج</th><th>الحالة</th><th>تحكم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAttendance.map((a, i) => (
                      <tr key={a.id}>
                        <td><strong>{i + 1}</strong></td>
                        <td>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {a.photo ? <img src={a.photo} alt={a.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎓'}
                          </div>
                        </td>
                        <td style={{ color: '#f3e5ab', fontWeight: 700 }}>{a.university_id}</td>
                        <td style={{ color: '#fff', fontWeight: 600 }}>{a.full_name}</td>
                        <td style={{ color: 'rgba(255,255,255,0.5)' }}>{a.college_name || '—'}</td>
                        <td>{a.major_name || '—'}</td>
                        <td style={{ fontWeight: 700, color: '#e2e8f0' }}>⏱️ {a.time_in || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>🚪 {a.time_out || '—'}</td>
                        <td>
                          <span style={{
                            padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 700,
                            background: a.status === 'present' ? 'rgba(52,211,153,0.1)' : a.status === 'late' ? 'rgba(214,175,55,0.1)' : 'rgba(239,68,68,0.1)',
                            color: a.status === 'present' ? '#34d399' : a.status === 'late' ? '#D4AF37' : '#ef4444'
                          }}>
                            {a.status === 'present' ? 'حاضر معتمد' : a.status === 'late' ? 'متأخر صباحاً' : 'غائب إداري'}
                          </span>
                        </td>
                        <td>
                          {!a.time_out && a.status !== 'absent' ? (
                            <motion.button className="btn-exit" onClick={() => markExit(a.id)} whileHover={{ scale: 1.05 }}
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(214,175,55,0.3)', color: '#f3e5ab', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                              🚪 إثبات انصراف
                            </motion.button>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>🔒 مغلق</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {todayAttendance.length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>🚫 لم يتم تسجيل أي حركة حضور لليوم حتى الآن.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* 📊 تبويب: التقرير الشهري */}
          {tab === 'monthly' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="monthly-attendance">
              <div className="monthly-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: '#f3e5ab', margin: 0 }}>📊 مصفوفة رصد نسب الغياب والحرمان التراكمية</h3>
                  <p style={{ color: 'rgba(255,255,255,0.4)', margin: '5px 0 0 0', fontSize: '0.88rem' }}>تلوين أحمر إنذاري آلي إذا تراجعت نسبة انضباط الحضور عن <strong style={{ color: '#ef4444' }}>75%</strong></p>
                </div>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  style={{ background: '#041d14', border: '1px solid rgba(214,175,55,0.3)', padding: '10px 15px', borderRadius: '12px', color: '#fff', fontWeight: 700, outline: 'none' }} />
              </div>

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>الرقم الجامعي</th><th>اسم الطالب</th><th>الكلية</th><th>أيام الحضور</th><th>أيام الغياب</th><th>أيام التأخير</th><th>نسبة الالتزام</th><th>مؤشر الأهلية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, i) => {
                      const isDanger = m.rate < 75;
                      return (
                        <tr key={i} style={{ background: isDanger ? 'rgba(239,68,68,0.02)' : 'none' }}>
                          <td><strong>{i + 1}</strong></td>
                          <td style={{ color: '#f3e5ab', fontWeight: 700 }}>{m.university_id}</td>
                          <td style={{ color: '#fff', fontWeight: 600 }}>{m.full_name}</td>
                          <td style={{ color: 'rgba(255,255,255,0.4)' }}>{m.college_name || '—'}</td>
                          <td style={{ color: '#34d399', fontWeight: 700 }}>{m.present_days || 0} أيام</td>
                          <td style={{ color: '#ef4444', fontWeight: 700 }}>{m.absent_days || 0} أيام</td>
                          <td style={{ color: '#D4AF37' }}>{m.late_days || 0} مرة</td>
                          <td>
                            <span style={{
                              padding: '4px 12px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800,
                              background: m.rate >= 90 ? 'rgba(52,211,153,0.1)' : m.rate >= 75 ? 'rgba(214,175,55,0.1)' : 'rgba(239,68,68,0.1)',
                              color: m.rate >= 90 ? '#34d399' : m.rate >= 75 ? '#D4AF37' : '#ef4444',
                              border: `1px solid ${m.rate >= 90 ? '#34d39944' : m.rate >= 75 ? '#D4AF3744' : '#ef444444'}`
                            }}>
                              {m.rate}%
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: m.rate >= 90 ? '#34d399' : m.rate >= 75 ? '#D4AF37' : '#ef4444' }}>
                            {m.rate >= 90 ? '🥇 منضبط وممتاز' : m.rate >= 75 ? '🥈 مستقر وجيد' : '⚠️ تحت إنذار الحرمان'}
                          </td>
                        </tr>
                      );
                    })}
                    {monthlyData.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>📭 لا توجد حركات رصد أو كشوفات مسجلة لهذا الشهر المحدد.</td></tr>
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
