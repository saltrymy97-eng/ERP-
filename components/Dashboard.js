// components/Dashboard.js – لوحة التحكم الرئيسية
import React, { useState, useEffect } from 'react';
import { getQuery } from '../services/db';
import { analyzeDailyAttendance, getWeeklyRecommendations, comprehensiveAnalysis } from '../services/ai';

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

  // ========== تحميل الإحصائيات ==========
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

  // ========== تحميل التنبيهات ==========
  const loadAlerts = () => {
    const alertList = [];

    // طلاب تجاوزوا 25% غياب
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
        message: `الطالب ${s.full_name} تجاوز نسبة الغياب ${s.rate}%`
      });
    });

    // طلاب لم يسجلوا دخول اليوم
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
        message: `الطالب ${s.full_name} لم يسجل حضور اليوم`
      });
    });

    // أجهزة بصمة غير متصلة
    const offlineDevices = getQuery("SELECT name FROM devices WHERE status='offline'");
    offlineDevices.forEach(d => {
      alertList.push({
        type: 'info',
        icon: '🔌',
        message: `جهاز ${d.name} غير متصل`
      });
    });

    setAlerts(alertList);
  };

  // ========== تحليل AI ==========
  const handleAIAnalysis = async () => {
    setAnalyzing(true);
    const analysis = await analyzeDailyAttendance();
    setAiAnalysis(analysis);
    setAnalyzing(false);
  };

  // ========== تحديث البيانات ==========
  const refreshData = () => {
    setLoading(true);
    loadStats();
    loadAlerts();
    setTimeout(() => setLoading(false), 500);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>جاري تحميل لوحة التحكم...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* شريط الأدوات */}
      <div className="dashboard-toolbar">
        <button className="btn-refresh" onClick={refreshData}>
          🔄 تحديث
        </button>
        <button className="btn-ai" onClick={handleAIAnalysis} disabled={analyzing}>
          {analyzing ? '⏳ جاري التحليل...' : '🧠 تحليل ذكي'}
        </button>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="stats-grid">
        <div className="stat-card gold">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{stats.totalStudents}</div>
          <div className="stat-label">إجمالي الطلاب</div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{stats.presentToday}</div>
          <div className="stat-label">حاضر اليوم</div>
        </div>

        <div className="stat-card red">
          <div className="stat-icon">❌</div>
          <div className="stat-value">{stats.absentToday}</div>
          <div className="stat-label">غائب اليوم</div>
        </div>

        <div className="stat-card orange">
          <div className="stat-icon">⚠️</div>
          <div className="stat-value">{stats.lateToday}</div>
          <div className="stat-label">متأخر اليوم</div>
        </div>

        <div className="stat-card blue">
          <div className="stat-icon">📚</div>
          <div className="stat-value">{stats.totalLectures}</div>
          <div className="stat-label">المحاضرات</div>
        </div>

        <div className="stat-card purple">
          <div className="stat-icon">📱</div>
          <div className="stat-value">{stats.notificationsSent}</div>
          <div className="stat-label">إشعارات اليوم</div>
        </div>
      </div>

      {/* نسبة الحضور */}
      <div className="attendance-bar">
        <div className="bar-header">
          <span>نسبة الحضور اليوم</span>
          <span className="bar-percent">
            {stats.totalStudents > 0
              ? Math.round((stats.presentToday / stats.totalStudents) * 100)
              : 0}%
          </span>
        </div>
        <div className="bar-track">
          <div
            className="bar-fill"
            style={{
              width: `${stats.totalStudents > 0
                ? (stats.presentToday / stats.totalStudents) * 100
                : 0}%`
            }}
          ></div>
        </div>
      </div>

      {/* التنبيهات */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <h3>🔔 تنبيهات هامة</h3>
          <div className="alerts-list">
            {alerts.map((alert, index) => (
              <div key={index} className={`alert-item alert-${alert.type}`}>
                <span className="alert-icon">{alert.icon}</span>
                <span className="alert-message">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* تحليل AI */}
      {aiAnalysis && (
        <div className="ai-analysis">
          <h3>🧠 تحليل الذكاء الاصطناعي</h3>
          <div className="analysis-content">
            {aiAnalysis.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* ملخص سريع */}
      <div className="quick-summary">
        <div className="summary-item">
          <span>📅 اليوم</span>
          <span>{new Date().toLocaleDateString('ar-SA')}</span>
        </div>
        <div className="summary-item">
          <span>🕐 آخر تحديث</span>
          <span>{new Date().toLocaleTimeString('ar-SA')}</span>
        </div>
        <div className="summary-item">
          <span>🤖 حالة AI</span>
          <span className="status-online">✅ متصل</span>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
