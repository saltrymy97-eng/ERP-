// src/components/Attendance.js – نظام رصد الحضور والانصراف (مصفوفات JavaScript)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery } from '../services/db';

function Attendance() {
  const [tab, setTab] = useState('live');
  const [students, setStudents] = useState([]);
  const [majors, setMajors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [scanningId, setScanningId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0 });
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab === 'monthly') loadMonthlyData();
  }, [selectedMonth, tab]);

  const loadAll = () => {
    const allStudents = getQuery("SELECT * FROM students WHERE status='active' ORDER BY full_name");
    const allMajors = getQuery("SELECT * FROM majors WHERE status='active'");
    const allDepartments = getQuery("SELECT * FROM departments WHERE status='active'");
    const allAttendance = getQuery("SELECT * FROM attendance");
    
    setStudents(allStudents);
    setMajors(allMajors);
    setDepartments(allDepartments);
    setTodayAttendance(allAttendance.filter(a => a.date === today));
    updateStats(allAttendance);
  };

  const updateStats = (att) => {
    const todayAtt = att.filter(a => a.date === today);
    const present = new Set(todayAtt.filter(a => a.status === 'present').map(a => a.student_id)).size;
    const absent = new Set(todayAtt.filter(a => a.status === 'absent').map(a => a.student_id)).size;
    const late = todayAtt.filter(a => a.status === 'late').length;
    setStats({ present, absent, late });
  };

  const getMajorName = (majorId) => {
    const major = majors.find(m => m.id === majorId);
    if (!major) return '';
    const dept = departments.find(d => d.id === major.department_id);
    return dept ? `${major.name} - ${dept.name}` : major.name;
  };

  const getStudentMajorName = (student) => {
    return getMajorName(student.major_id);
  };

  const markAttendance = (student, status = 'present') => {
    setScanningId(student.id);
    setTimeout(() => {
      const timeNow = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
      const isLate = timeNow > '08:15' && status === 'present';
      const currentStatus = isLate ? 'late' : status;

      const exists = getQuery("SELECT id FROM attendance WHERE student_id=? AND date=?", [student.id, today]);
      if (exists.length > 0) {
        runQuery("UPDATE attendance SET status=?, time_in=? WHERE student_id=? AND date=?", [currentStatus, timeNow, student.id, today]);
      } else {
        runQuery("INSERT INTO attendance (student_id, date, time_in, status, method) VALUES (?, ?, ?, ?, 'fingerprint')", [student.id, today, timeNow, currentStatus]);
      }

      setAttendanceStatus({
        student: student.full_name,
        time: timeNow,
        status: isLate ? 'متأخر' : 'حاضر',
        icon: isLate ? '⚠️' : '✅',
        color: isLate ? 'var(--gold-main)' : 'var(--green-bright)'
      });

      setScanningId(null);
      loadAll();
    }, 1200);
  };

  const markAbsent = (student) => {
    const exists = getQuery("SELECT id FROM attendance WHERE student_id=? AND date=?", [student.id, today]);
    if (exists.length > 0) {
      runQuery("UPDATE attendance SET status='absent', time_in=NULL WHERE student_id=? AND date=?", [student.id, today]);
    } else {
      runQuery("INSERT INTO attendance (student_id, date, status, method) VALUES (?, ?, 'absent', 'manual')", [student.id, today]);
    }
    setAttendanceStatus({ student: student.full_name, time: '—', status: 'غائب', icon: '❌', color: '#ef4444' });
    loadAll();
  };

  const markExit = (attendanceId) => {
    const timeNow = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    runQuery("UPDATE attendance SET time_out=? WHERE id=?", [timeNow, attendanceId]);
    loadAll();
  };

  const loadMonthlyData = () => {
    setMonthlyData([]); // ⚡ يمنع الشاشة السوداء
    
    const allStudents = getQuery("SELECT * FROM students WHERE status='active'");
    const allAttendance = getQuery("SELECT * FROM attendance");
    
    const data = allStudents.map(s => {
      const studentAttendance = allAttendance.filter(a => a.student_id === s.id && a.date && a.date.startsWith(selectedMonth));
      if (studentAttendance.length === 0) return null;
      const present = studentAttendance.filter(a => a.status === 'present').length;
      const absent = studentAttendance.filter(a => a.status === 'absent').length;
      const late = studentAttendance.filter(a => a.status === 'late').length;
      const total = studentAttendance.length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return {
        full_name: s.full_name,
        university_id: s.university_id,
        present_days: present,
        absent_days: absent,
        late_days: late,
        total_days: total,
        rate: rate
      };
    }).filter(Boolean).sort((a, b) => b.rate - a.rate);
    
    setMonthlyData(data);
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
  const cardVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } } };

  return (
    <div className="attendance-module" style={{ padding: '5px 0' }}>
      {/* Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '18px', border: '1px solid var(--glass-border)', marginBottom: '30px' }}>
        {[
          { id: 'live', label: '🖐️ نظام مسح البصمة المباشر' },
          { id: 'today', label: '📋 بيان الحضور اليومي' },
          { id: 'monthly', label: '📊 التقارير الشهرية' }
        ].map(t => (
          <motion.button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); setAttendanceStatus(null); }}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
            style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
              background: tab === t.id ? 'linear-gradient(135deg, var(--gold-main), #b89324)' : 'rgba(255,255,255,0.03)',
              color: tab === t.id ? '#062b1e' : 'var(--text-secondary)' }}>
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* ========== LIVE ========== */}
      {tab === 'live' && (
        <div className="live-attendance">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
            <div>
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.7rem', color: 'var(--gold-light)', margin: 0 }}>🖐️ بوابات رصد البصمة البيومترية الحية</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0', fontSize: '0.88rem' }}>انقر فوق كرت الطالب لمحاكاة وضع الإبهام فوق مستشعر الحضور</p>
            </div>
            <input type="text" placeholder="🔍 بحث بالاسم أو الرقم الجامعي..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', maxWidth: '360px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 18px', borderRadius: '14px', color: '#fff', outline: 'none' }} />
          </div>

          {/* Alert */}
          <AnimatePresence>
            {attendanceStatus && (
              <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                style={{ background: 'linear-gradient(135deg, #062b1e, #0c4733)', border: `1px solid ${attendanceStatus.color}`, padding: '15px 25px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
                <span style={{ fontSize: '2rem', animation: 'pulse 1.5s infinite', color: attendanceStatus.color }}>{attendanceStatus.icon}</span>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{attendanceStatus.student}</h4>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    الوقت: <strong style={{ color: 'var(--gold-light)' }}>{attendanceStatus.time}</strong> | الحالة: <span style={{ color: attendanceStatus.color, fontWeight: 'bold' }}>{attendanceStatus.status}</span>
                  </p>
                </div>
                <button onClick={() => setAttendanceStatus(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.6 }}>✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Students Grid */}
          <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {students.filter(s => s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.university_id?.includes(searchTerm)).map(student => {
                const todayRecord = todayAttendance.find(a => a.student_id === student.id);
                const isPresent = todayRecord?.status === 'present';
                const isLate = todayRecord?.status === 'late';
                const isAbsent = todayRecord?.status === 'absent';
                const isScanning = scanningId === student.id;

                let borderStyle = '1px solid var(--glass-border)';
                if (isPresent) borderStyle = '1px solid var(--emerald-light)';
                if (isLate) borderStyle = '1px solid var(--gold-main)';
                if (isAbsent) borderStyle = '1px solid #ef4444';
                if (isScanning) borderStyle = '1px solid var(--green-bright)';

                return (
                  <motion.div key={student.id} variants={cardVariants} whileHover={{ y: -5 }}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,255,255,0.03))', backdropFilter: 'blur(10px)', border: borderStyle, borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: isScanning ? '0 0 25px var(--green-bright)' : 'none' }}>
                    
                    {isScanning && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--green-bright)', animation: 'loading 1s linear infinite' }} />}

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div style={{ width: '65px', height: '65px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>🎓</div>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>{student.full_name}</div>
                        <div style={{ color: 'var(--gold-light)', fontSize: '0.85rem', fontWeight: 600 }}>🔢 {student.university_id}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>📂 {getStudentMajorName(student)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                      {!isPresent && !isLate && !isAbsent && (
                        <>
                          <motion.button onClick={() => markAttendance(student, 'present')} disabled={scanningId !== null} whileHover={{ scale: 1.03 }}
                            style={{ flex: 2, background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            {isScanning ? '📶 جاري الفحص...' : '🖐️ مسح البصمة'}
                          </motion.button>
                          <button onClick={() => markAbsent(student)} disabled={scanningId !== null}
                            style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>❌ غياب</button>
                        </>
                      )}
                      {(isPresent || isLate || isAbsent) && (
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ padding: '6px 16px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800,
                            background: isPresent ? 'rgba(16,185,129,0.1)' : isLate ? 'rgba(214,175,55,0.1)' : 'rgba(239,68,68,0.1)',
                            color: isPresent ? 'var(--green-bright)' : isLate ? 'var(--gold-main)' : '#ef4444',
                            border: `1px solid ${isPresent ? 'rgba(16,185,129,0.2)' : isLate ? 'rgba(214,175,55,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                            {isPresent ? '✅ حاضر' : isLate ? '⚠️ متأخر' : '❌ غائب'}
                          </span>
                          <button onClick={() => { if(window.confirm("هل ترغب في إعادة فتح بوابة الفحص لهذا الطالب؟")) { runQuery("DELETE FROM attendance WHERE student_id=? AND date=?", [student.id, today]); loadAll(); } }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}>🔄 إعادة ضبط</button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </motion.div>
        </div>
      )}

      {/* ========== TODAY ========== */}
      {tab === 'today' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
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

          <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', marginBottom: '20px' }}>📋 كشف بيان التوقيع الإلكتروني لليوم ({today})</h3>

          <div className="data-table"><table><thead><tr><th>#</th><th>الرقم</th><th>الاسم</th><th>دخول</th><th>خروج</th><th>الحالة</th><th>إجراء</th></tr></thead>
            <tbody>{todayAttendance.map((a, i) => (<tr key={a.id}><td>{i + 1}</td><td style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{a.university_id}</td><td style={{ color: '#fff', fontWeight: 600 }}>{a.full_name}</td><td>⏱️ {a.time_in || '—'}</td><td>🚪 {a.time_out || '—'}</td><td><span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 700,
              background: a.status === 'present' ? 'rgba(16,185,129,0.1)' : a.status === 'late' ? 'rgba(214,175,55,0.1)' : 'rgba(239,68,68,0.1)',
              color: a.status === 'present' ? 'var(--green-bright)' : a.status === 'late' ? 'var(--gold-main)' : '#ef4444' }}>
              {a.status === 'present' ? 'حاضر' : a.status === 'late' ? 'متأخر' : 'غائب'}</span></td>
              <td>{!a.time_out && a.status !== 'absent' ? <button onClick={() => markExit(a.id)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--gold-main)', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>🚪 انصراف</button> : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>🔒 مغلق</span>}</td></tr>))}
            {todayAttendance.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>🚫 لم يتم تسجيل أي حركة حضور اليوم.</td></tr>}</tbody></table></div>
        </motion.div>
      )}

      {/* ========== MONTHLY ========== */}
      {tab === 'monthly' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <div>
              <h3 style={{ fontFamily: 'Amiri', serif, fontSize: '1.6rem', color: 'var(--gold-light)', margin: 0 }}>📊 مصفوفة رصد نسب الغياب التراكمية</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0', fontSize: '0.88rem' }}>يتم تلوين السجلات بالأحمر إذا تراجعت نسبة الحضور عن <strong style={{ color: '#ef4444' }}>75%</strong></p>
            </div>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ background: '#062b1e', border: '1px solid var(--glass-border)', padding: '10px 15px', borderRadius: '12px', color: '#fff', fontWeight: 700 }} />
          </div>

          <div className="data-table"><table><thead><tr><th>#</th><th>الرقم</th><th>الاسم</th><th>حضور</th><th>غياب</th><th>تأخير</th><th>النسبة</th><th>تقييم</th></tr></thead>
            <tbody>{monthlyData.map((m, i) => {
              const isDanger = m.rate < 75;
              return (<tr key={i} style={{ background: isDanger ? 'rgba(239,68,68,0.03)' : 'none' }}><td><strong>{i + 1}</strong></td><td style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{m.university_id}</td><td style={{ color: '#fff', fontWeight: 600 }}>{m.full_name}</td><td style={{ color: 'var(--green-bright)', fontWeight: 700 }}>{m.present_days}</td><td style={{ color: '#ef4444', fontWeight: 700 }}>{m.absent_days}</td><td style={{ color: 'var(--gold-main)' }}>{m.late_days}</td><td><span style={{ padding: '4px 12px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800,
                background: m.rate >= 90 ? 'rgba(16,185,129,0.1)' : m.rate >= 75 ? 'rgba(214,175,55,0.1)' : 'rgba(239,68,68,0.1)',
                color: m.rate >= 90 ? 'var(--green-bright)' : m.rate >= 75 ? 'var(--gold-main)' : '#ef4444' }}>{m.rate}%</span></td><td style={{ fontWeight: 700 }}>{m.rate >= 90 ? '🥇 ممتاز' : m.rate >= 75 ? '🥈 جيد' : '⚠️ خطر'}</td></tr>);
            })}
            {monthlyData.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>📭 لا توجد حركات توقيع مسجلة لهذا الشهر.</td></tr>}</tbody></table></div>
        </motion.div>
      )}
    </div>
  );
}

export default Attendance;
