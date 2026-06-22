// components/Attendance.js – واجهة الحضور والانصراف بالبصمة
import React, { useState, useEffect } from 'react';
import { getQuery, runQuery } from '../services/db';

function Attendance() {
  const [tab, setTab] = useState('live'); // live, today, history, monthly
  const [students, setStudents] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0 });
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    loadStudents();
    loadTodayAttendance();
    loadStats();
  }, []);

  useEffect(() => {
    if (tab === 'monthly') {
      loadMonthlyData();
    }
  }, [selectedMonth, tab]);

  // ========== تحميل الطلاب ==========
  const loadStudents = () => {
    const data = getQuery(`
      SELECT s.*, m.name as major_name
      FROM students s
      LEFT JOIN majors m ON s.major_id = m.id
      WHERE s.status='active'
      ORDER BY s.full_name
    `);
    setStudents(data);
  };

  // ========== تحميل حضور اليوم ==========
  const loadTodayAttendance = () => {
    const data = getQuery(`
      SELECT a.*, s.full_name, s.university_id, s.phone,
             m.name as major_name, sc.subject, sc.time_from, sc.time_to, sc.room
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN majors m ON s.major_id = m.id
      LEFT JOIN schedules sc ON a.schedule_id = sc.id
      WHERE a.date = ?
      ORDER BY a.time_in DESC
    `, [today]);
    setTodayAttendance(data);
  };

  // ========== إحصائيات اليوم ==========
  const loadStats = () => {
    const present = getQuery("SELECT COUNT(DISTINCT student_id) as c FROM attendance WHERE date=? AND status='present'", [today])[0]?.c || 0;
    const absent = getQuery("SELECT COUNT(DISTINCT student_id) as c FROM attendance WHERE date=? AND status='absent'", [today])[0]?.c || 0;
    const late = getQuery("SELECT COUNT(*) as c FROM attendance WHERE date=? AND status='late'", [today])[0]?.c || 0;
    setStats({ present, absent, late });
  };

  // ========== تسجيل حضور (بصمة) ==========
  const markAttendance = (student, status = 'present') => {
    setLoading(true);
    const now = new Date();
    const timeNow = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const lateThreshold = '08:15'; // يمكن تعديله حسب إعدادات الجامعة
    const isLate = timeNow > lateThreshold && status === 'present';

    runQuery(
      "INSERT INTO attendance (student_id, date, time_in, status, late_minutes, method) VALUES (?, ?, ?, ?, ?, ?)",
      [
        student.id,
        today,
        timeNow,
        isLate ? 'late' : status,
        isLate ? 10 : 0,
        'fingerprint'
      ]
    );

    setSelectedStudent(student);
    setAttendanceStatus({
      student: student.full_name,
      time: timeNow,
      status: isLate ? 'متأخر' : 'حاضر',
      icon: isLate ? '⚠️' : '✅',
      color: isLate ? 'orange' : 'green'
    });

    loadTodayAttendance();
    loadStats();
    setTimeout(() => setLoading(false), 1500);
  };

  // ========== تسجيل غياب ==========
  const markAbsent = (student) => {
    const exists = getQuery(
      "SELECT id FROM attendance WHERE student_id=? AND date=?",
      [student.id, today]
    );

    if (exists.length > 0) {
      runQuery("UPDATE attendance SET status='absent' WHERE student_id=? AND date=?", [student.id, today]);
    } else {
      runQuery(
        "INSERT INTO attendance (student_id, date, status, method) VALUES (?, ?, 'absent', 'manual')",
        [student.id, today]
      );
    }

    setSelectedStudent(student);
    setAttendanceStatus({
      student: student.full_name,
      time: '—',
      status: 'غائب',
      icon: '❌',
      color: 'red'
    });

    loadTodayAttendance();
    loadStats();
  };

  // ========== تسجيل انصراف ==========
  const markExit = (attendanceId) => {
    const now = new Date();
    const timeNow = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    runQuery("UPDATE attendance SET time_out=? WHERE id=?", [timeNow, attendanceId]);
    loadTodayAttendance();
  };

  // ========== بيانات شهرية ==========
  const loadMonthlyData = () => {
    const data = getQuery(`
      SELECT s.full_name, s.university_id,
             COUNT(CASE WHEN a.status='present' THEN 1 END) as present_days,
             COUNT(CASE WHEN a.status='absent' THEN 1 END) as absent_days,
             COUNT(CASE WHEN a.status='late' THEN 1 END) as late_days,
             COUNT(*) as total_days,
             ROUND(CAST(COUNT(CASE WHEN a.status='present' THEN 1 END) AS FLOAT) / COUNT(*)*100, 1) as rate
      FROM students s
      JOIN attendance a ON s.id = a.student_id
      WHERE a.date LIKE '${selectedMonth}%'
      GROUP BY s.id
      ORDER BY rate ASC
    `);
    setMonthlyData(data);
  };

  // ========== واجهة تسجيل الحضور المباشر ==========
  const renderLiveAttendance = () => (
    <div className="live-attendance">
      <div className="live-header">
        <h3>🖐️ تسجيل الحضور بالبصمة</h3>
        <p>اختر الطالب لتسجيل حضوره</p>
        <input
          type="text"
          placeholder="🔍 بحث سريع عن طالب..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="live-search"
        />
      </div>

      {/* رسالة الحالة */}
      {attendanceStatus && (
        <div className={`attendance-alert ${attendanceStatus.color}`}>
          <span className="alert-icon">{attendanceStatus.icon}</span>
          <div>
            <strong>{attendanceStatus.student}</strong>
            <p>الوقت: {attendanceStatus.time} | الحالة: {attendanceStatus.status}</p>
          </div>
          <button onClick={() => setAttendanceStatus(null)}>✕</button>
        </div>
      )}

      {/* قائمة الطلاب */}
      <div className="students-grid">
        {students
          .filter(s => s.full_name?.includes(searchTerm) || s.university_id?.includes(searchTerm))
          .map(student => {
            const todayRecord = todayAttendance.find(a => a.student_id === student.id);
            const isPresent = todayRecord?.status === 'present';
            const isLate = todayRecord?.status === 'late';
            const isAbsent = todayRecord?.status === 'absent';

            return (
              <div key={student.id} className={`student-card ${isPresent ? 'present' : ''} ${isLate ? 'late' : ''} ${isAbsent ? 'absent' : ''}`}>
                <div className="student-avatar">
                  {student.photo ? (
                    <img src={student.photo} alt={student.full_name} />
                  ) : (
                    <div className="avatar-placeholder">👤</div>
                  )}
                </div>
                <div className="student-info">
                  <strong>{student.full_name}</strong>
                  <small>{student.university_id}</small>
                  <small>{student.major_name}</small>
                </div>
                <div className="student-actions">
                  {!isPresent && !isAbsent && (
                    <button
                      className="btn-present"
                      onClick={() => markAttendance(student, 'present')}
                      disabled={loading}
                    >
                      ✅ حضور
                    </button>
                  )}
                  {!isAbsent && (
                    <button
                      className="btn-absent"
                      onClick={() => markAbsent(student)}
                    >
                      ❌ غياب
                    </button>
                  )}
                  {isPresent && (
                    <span className="badge-present">✅ حاضر</span>
                  )}
                  {isLate && (
                    <span className="badge-late">⚠️ متأخر</span>
                  )}
                  {isAbsent && (
                    <span className="badge-absent">❌ غائب</span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );

  // ========== واجهة حضور اليوم ==========
  const renderTodayAttendance = () => (
    <div className="today-attendance">
      <div className="today-header">
        <h3>📋 سجل حضور اليوم ({today})</h3>
        <div className="today-stats">
          <span className="stat-badge green">✅ {stats.present} حاضر</span>
          <span className="stat-badge red">❌ {stats.absent} غائب</span>
          <span className="stat-badge orange">⚠️ {stats.late} متأخر</span>
        </div>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الطالب</th>
              <th>الرقم الجامعي</th>
              <th>المادة</th>
              <th>الدخول</th>
              <th>الخروج</th>
              <th>الحالة</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {todayAttendance.map((a, i) => (
              <tr key={a.id}>
                <td>{i + 1}</td>
                <td>{a.full_name}</td>
                <td>{a.university_id}</td>
                <td>{a.subject || '—'}</td>
                <td>{a.time_in || '—'}</td>
                <td>{a.time_out || '—'}</td>
                <td>
                  <span className={`status-label ${a.status}`}>
                    {a.status === 'present' ? '✅ حاضر' : a.status === 'late' ? '⚠️ متأخر' : '❌ غائب'}
                  </span>
                </td>
                <td>
                  {!a.time_out && a.status !== 'absent' && (
                    <button className="btn-exit" onClick={() => markExit(a.id)}>
                      🚪 انصراف
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {todayAttendance.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">لا يوجد سجل حضور اليوم</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ========== واجهة شهرية ==========
  const renderMonthly = () => (
    <div className="monthly-attendance">
      <div className="monthly-header">
        <h3>📊 متابعة الحضور الشهري</h3>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="month-picker"
        />
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الطالب</th>
              <th>الرقم الجامعي</th>
              <th>حضور</th>
              <th>غياب</th>
              <th>تأخير</th>
              <th>النسبة</th>
              <th>التقييم</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((m, i) => (
              <tr key={i} className={m.rate < 75 ? 'danger-row' : ''}>
                <td>{i + 1}</td>
                <td>{m.full_name}</td>
                <td>{m.university_id}</td>
                <td>{m.present_days}</td>
                <td>{m.absent_days}</td>
                <td>{m.late_days}</td>
                <td>
                  <span className={`rate-badge ${m.rate >= 90 ? 'green' : m.rate >= 75 ? 'orange' : 'red'}`}>
                    {m.rate}%
                  </span>
                </td>
                <td>
                  {m.rate >= 90 ? '🥇 ممتاز' : m.rate >= 75 ? '🥈 جيد' : '⚠️ خطر'}
                </td>
              </tr>
            ))}
            {monthlyData.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">لا توجد بيانات للشهر المحدد</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="attendance-module">
      {/* تبويبات */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'live' ? 'active' : ''}`} onClick={() => setTab('live')}>
          🖐️ تسجيل مباشر
        </button>
        <button className={`tab-btn ${tab === 'today' ? 'active' : ''}`} onClick={() => { setTab('today'); loadTodayAttendance(); }}>
          📋 حضور اليوم
        </button>
        <button className={`tab-btn ${tab === 'monthly' ? 'active' : ''}`} onClick={() => { setTab('monthly'); loadMonthlyData(); }}>
          📊 شهري
        </button>
      </div>

      {/* المحتوى */}
      {tab === 'live' && renderLiveAttendance()}
      {tab === 'today' && renderTodayAttendance()}
      {tab === 'monthly' && renderMonthly()}
    </div>
  );
}

export default Attendance;
