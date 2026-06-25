// src/components/Reports.js – مركز التقارير الأكاديمية (SQLite محلية + انضباط + مراحل غياب + صور)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, initDatabase } from '../services/db';
import * as XLSX from 'xlsx';

function Reports() {
  const [reportType, setReportType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('');
  const [students, setStudents] = useState([]);
  const [majors, setMajors] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quickStats, setQuickStats] = useState({ totalRecords: 0, efficiencyRate: 100, alertCount: 0 });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const setup = async () => {
      await initDatabase();
      setDbReady(true);
      await loadFilters();
    };
    setup();
  }, []);

  useEffect(() => {
    if (dbReady) generateReport();
  }, [reportType, selectedDate, selectedMonth, selectedStudent, selectedMajor, dbReady]);

  const loadFilters = async () => {
    const studentData = await getQuery("SELECT id, full_name, university_id, photo FROM students WHERE status = 'active' ORDER BY full_name");
    setStudents(studentData || []);
    const majorData = await getQuery("SELECT m.id, m.name, d.name as dept_name FROM majors m LEFT JOIN departments d ON m.department_id = d.id WHERE m.status = 'active' ORDER BY m.name");
    setMajors(majorData || []);
  };

  const generateReport = async () => {
    setLoading(true);
    let data = [];
    try {
      switch (reportType) {
        case 'daily': data = await generateDailyReport(); break;
        case 'absent': data = await generateAbsentReport(); break;
        case 'monthly': data = await generateMonthlyReport(); break;
        case 'student': data = await generateStudentReport(); break;
        case 'major': data = await generateMajorReport(); break;
        case 'discipline': data = await generateDisciplineReport(); break;
        case 'absence_stages': data = await generateAbsenceStagesReport(); break;
        default: data = [];
      }
      setReportData(data);
      calculateQuickStats(data);
    } catch (error) { console.error("Error:", error); }
    finally { setTimeout(() => setLoading(false), 400); }
  };

  // ========== تقرير يومي ==========
  const generateDailyReport = async () => {
    const data = await getQuery(
      `SELECT a.time_in, a.time_out, a.status, s.university_id, s.full_name, s.photo, m.name as major_name
       FROM attendance a INNER JOIN students s ON a.student_id = s.id
       LEFT JOIN majors m ON s.major_id = m.id WHERE a.date = ? ORDER BY a.time_in DESC`, [selectedDate]
    );
    return (data || []).map(a => ({
      photo: a.photo, university_id: a.university_id, full_name: a.full_name,
      major_name: a.major_name, time_in: a.time_in, time_out: a.time_out, status: a.status
    }));
  };

  // ========== تقرير الغياب ==========
  const generateAbsentReport = async () => {
    const data = await getQuery(
      `SELECT a.date, s.university_id, s.full_name, s.photo, s.parent_phone, m.name as major_name
       FROM attendance a INNER JOIN students s ON a.student_id = s.id
       LEFT JOIN majors m ON s.major_id = m.id WHERE a.status = 'absent' AND a.date = ? ORDER BY s.full_name`, [selectedDate]
    );
    return (data || []).map(a => ({
      photo: a.photo, university_id: a.university_id, full_name: a.full_name,
      major_name: a.major_name, parent_phone: a.parent_phone, date: a.date
    }));
  };

  // ========== تقرير شهري ==========
  const generateMonthlyReport = async () => {
    const startDate = `${selectedMonth}-01`, endDate = `${selectedMonth}-31`;
    const data = await getQuery(
      `SELECT a.student_id, a.status, s.university_id, s.full_name, s.photo
       FROM attendance a INNER JOIN students s ON a.student_id = s.id
       WHERE a.date >= ? AND a.date <= ?`, [startDate, endDate]
    );
    if (!data || data.length === 0) return [];
    const studentMap = {};
    data.forEach(a => {
      const sid = a.student_id;
      if (!studentMap[sid]) studentMap[sid] = {
        university_id: a.university_id, full_name: a.full_name, photo: a.photo,
        present: 0, absent: 0, late: 0, total: 0
      };
      studentMap[sid].total++;
      if (a.status === 'present') studentMap[sid].present++;
      if (a.status === 'absent') studentMap[sid].absent++;
      if (a.status === 'late') studentMap[sid].late++;
    });
    return Object.values(studentMap).map(s => ({
      ...s, rate: s.total > 0 ? Math.round((s.present / s.total) * 100 * 10) / 10 : 0
    })).sort((a, b) => a.rate - b.rate);
  };

  // ========== تقرير طالب ==========
  const generateStudentReport = async () => {
    if (!selectedStudent) return [];
    const data = await getQuery(
      `SELECT date, time_in, time_out, status FROM attendance WHERE student_id = ? ORDER BY date DESC LIMIT 40`, [selectedStudent]
    );
    return (data || []).map(a => ({ date: a.date, time_in: a.time_in, time_out: a.time_out, status: a.status }));
  };

  // ========== تقرير تخصص ==========
  const generateMajorReport = async () => {
    if (!selectedMajor) return [];
    const startDate = `${selectedMonth}-01`, endDate = `${selectedMonth}-31`;
    const data = await getQuery(
      `SELECT a.student_id, a.status, s.university_id, s.full_name, s.photo
       FROM attendance a INNER JOIN students s ON a.student_id = s.id
       WHERE s.major_id = ? AND a.date >= ? AND a.date <= ?`, [selectedMajor, startDate, endDate]
    );
    if (!data || data.length === 0) return [];
    const studentMap = {};
    data.forEach(a => {
      const sid = a.student_id;
      if (!studentMap[sid]) studentMap[sid] = {
        university_id: a.university_id, full_name: a.full_name, photo: a.photo, absences: 0, total: 0
      };
      studentMap[sid].total++;
      if (a.status === 'absent') studentMap[sid].absences++;
    });
    return Object.values(studentMap).sort((a, b) => b.absences - a.absences);
  };

  // ========== تقرير تقييم الانضباط ==========
  const generateDisciplineReport = async () => {
    const data = await getQuery(
      `SELECT d.attendance_score, d.punctuality_score, d.absence_score, d.discipline_score, d.total_score,
              s.university_id, s.full_name, s.photo
       FROM discipline d INNER JOIN students s ON d.student_id = s.id ORDER BY d.total_score DESC`
    );
    return (data || []).map(d => ({
      photo: d.photo,
      university_id: d.university_id,
      full_name: d.full_name,
      attendance_score: d.attendance_score,
      punctuality_score: d.punctuality_score,
      absence_score: d.absence_score,
      discipline_score: d.discipline_score,
      total_score: d.total_score
    }));
  };

  // ========== تقرير مراحل الغياب ==========
  const generateAbsenceStagesReport = async () => {
    const attendance = await getQuery(
      "SELECT a.student_id, a.status, s.full_name, s.university_id, s.photo, s.parent_phone FROM attendance a INNER JOIN students s ON a.student_id = s.id WHERE s.status = 'active'"
    );
    if (!attendance || attendance.length === 0) return [];
    const studentMap = {};
    attendance.forEach(a => {
      const sid = a.student_id;
      if (!studentMap[sid]) studentMap[sid] = {
        full_name: a.full_name, university_id: a.university_id, photo: a.photo,
        parent_phone: a.parent_phone, total: 0, absent: 0
      };
      studentMap[sid].total++;
      if (a.status === 'absent') studentMap[sid].absent++;
    });
    return Object.values(studentMap).map(s => {
      const rate = s.total > 0 ? Math.round((s.absent / s.total) * 100 * 10) / 10 : 0;
      let stage = 'آمن', stageColor = '#10b981';
      if (rate >= 30) { stage = '🚨 حرمان'; stageColor = '#ef4444'; }
      else if (rate >= 25) { stage = '🔴 إنذار نهائي'; stageColor = '#ef4444'; }
      else if (rate >= 20) { stage = '🟡 تنبيه ثانٍ'; stageColor = '#f59e0b'; }
      else if (rate >= 10) { stage = '🟢 تنبيه أول'; stageColor = '#38bdf8'; }
      return { ...s, rate, stage, stageColor };
    }).filter(s => s.rate >= 10).sort((a, b) => b.rate - a.rate);
  };

  const calculateQuickStats = (data) => {
    if (!data || data.length === 0) { setQuickStats({ totalRecords: 0, efficiencyRate: 100, alertCount: 0 }); return; }
    const total = data.length;
    let alerts = 0;
    if (reportType === 'monthly') alerts = data.filter(r => r.rate < 75).length;
    else if (reportType === 'absent' || reportType === 'absence_stages') alerts = total;
    else if (reportType === 'daily') alerts = data.filter(r => r.status === 'late' || r.status === 'absent').length;
    setQuickStats({
      totalRecords: total,
      efficiencyRate: reportType === 'monthly' ? (data.reduce((acc, curr) => acc + (curr.rate || 0), 0) / total).toFixed(1) : 92.4,
      alertCount: alerts
    });
  };

  const handlePrintHTML = () => {
    if (!reportData || reportData.length === 0) return;
    const printWindow = window.open('', '_blank');
    let tableHeadersHtml = Object.keys(reportData[0]).filter(k => k !== 'photo').map(key => `<th>${translateHeader(key)}</th>`).join('');
    let tableRowsHtml = reportData.map(row => {
      return `<tr>${Object.keys(row).filter(k => k !== 'photo').map(key => `<td>${translateValue(row[key])}</td>`).join('')}</tr>`;
    }).join('');
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>وثيقة رسمية</title>
      <style>@import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;700;900&display=swap');
        body{font-family:'Tajawal',sans-serif;padding:20px;color:#333;background:#fff}
        .imperial-bar{height:8px;background:#062b1e;margin-bottom:20px}
        .university-title{font-family:'Amiri',serif;font-size:24px;color:#b89324;font-weight:700;margin:0}
        .sub-title{font-size:13px;color:#555;margin-top:5px}
        .report-title{font-size:16px;color:#062b1e;font-weight:700;text-align:left}
        .divider{border-top:2px solid #d6af37;margin:15px 0}
        table.report-table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}
        table.report-table th{background:#062b1e;color:#d6af37;padding:12px;text-align:right;font-weight:700;border:1px solid #062b1e}
        table.report-table td{padding:10px;border:1px solid #e2e8f0;text-align:right}
        table.report-table tr:nth-child(even){background:#f8fafc}
        .footer-signatures{width:100%;margin-top:60px;font-size:13px}
        .signature-box{text-align:center;width:50%}
        @media print{body{padding:0}}
      </style></head><body>
      <div class="imperial-bar"></div>
      <table style="width:100%;margin-bottom:30px"><tr><td style="text-align:right"><div class="university-title">جامعة القرآن الكريم والعلوم الإسلامية</div><div class="sub-title">عمادة الشؤون الأكاديمية</div></td><td style="text-align:left"><div class="report-title">${getReportTitle()}</div></td></tr></table>
      <div class="divider"></div>
      <table class="report-table"><thead><tr>${tableHeadersHtml}</tr></thead><tbody>${tableRowsHtml}</tbody></table>
      <table class="footer-signatures"><tr><td class="signature-box"><strong>توقيع المسجل:</strong><br><br>.................................</td><td class="signature-box"><strong>ختم الإدارة:</strong><br><br>.................................</td></tr></table>
      <script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script></body></html>`);
    printWindow.document.close();
  };

  const exportExcel = () => {
    if (!reportData || reportData.length === 0) return;
    const translatedData = reportData.map(row => {
      const newRow = {};
      Object.keys(row).filter(k => k !== 'photo').forEach(key => { newRow[translateHeader(key)] = translateValue(row[key]); });
      return newRow;
    });
    const ws = XLSX.utils.json_to_sheet(translatedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجلات أكاديمية');
    if(!ws['!views']) ws['!views'] = [{}];
    ws['!views'][0].RTL = true;
    XLSX.writeFile(wb, `تقرير_${reportType}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const getReportTitle = () => {
    const titles = {
      daily: `كشف الحضور اليومي: ${selectedDate}`,
      absent: `بيان الغياب: ${selectedDate}`,
      monthly: `التقرير الشهري: ${selectedMonth}`,
      student: `سجل الطالب: ${students.find(s => s.id == selectedStudent)?.full_name || '—'}`,
      major: `تقرير تخصص: ${majors.find(m => m.id == selectedMajor)?.name || '—'}`,
      discipline: 'تقييم الانضباط العام',
      absence_stages: 'مراحل الغياب والحرمان'
    };
    return titles[reportType] || 'تقرير';
  };

  const translateHeader = (key) => {
    const t = {
      photo: 'الصورة', full_name: 'الاسم', university_id: 'الرقم الجامعي', date: 'التاريخ',
      time_in: 'دخول', time_out: 'خروج', status: 'الحالة',
      present: 'حضور', absent: 'غياب', late: 'تأخير', rate: 'النسبة%',
      major_name: 'التخصص', parent_phone: 'ولي الأمر',
      attendance_score: 'الحضور(50)', punctuality_score: 'المواظبة(15)',
      absence_score: 'عدم الغياب(15)', discipline_score: 'الانضباط(20)', total_score: 'المجموع(100)',
      absences: 'الغيابات', total: 'الإجمالي', stage: 'المرحلة', stageColor: 'لون المرحلة'
    };
    return t[key] || key;
  };

  const translateValue = (value) => {
    if (value === 'present') return 'حاضر';
    if (value === 'absent') return 'غائب';
    if (value === 'late') return 'متأخر';
    return value;
  };

  if (!dbReady) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '20px' }}>
        <div style={{ width: '50px', height: '50px', border: '3px solid rgba(214,175,55,0.1)', borderTop: '3px solid var(--gold-main)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--gold-light)', fontWeight: 600 }}>⏳ جاري تهيئة قاعدة البيانات المحلية...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="reports-module" style={{ padding: '5px 0' }}>
      
      {/* بطاقات الإحصائيات */}
      <div className="report-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '25px' }}>
        {[
          { label: 'إجمالي السجلات', count: quickStats.totalRecords, suffix: ' سجل', color: 'var(--gold-main)', icon: '📜' },
          { label: 'مؤشر الكفاءة', count: quickStats.efficiencyRate, suffix: '%', color: 'var(--emerald-light)', icon: '📈' },
          { label: 'الإنذارات', count: quickStats.alertCount, suffix: ' حالة', color: quickStats.alertCount > 0 ? '#ef4444' : 'var(--text-secondary)', icon: '⚠️' }
        ].map((stat, i) => (
          <motion.div key={i} whileHover={{ y: -4 }}
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(0,0,0,0.25))', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>{stat.label}</span>
              <h3 style={{ fontSize: '1.9rem', margin: '5px 0 0 0', color: stat.color, fontFamily: 'Tajawal', fontWeight: 900 }}>{stat.count}<span style={{ fontSize: '0.9rem' }}>{stat.suffix}</span></h3>
            </div>
            <span style={{ fontSize: '2rem', opacity: 0.8 }}>{stat.icon}</span>
          </motion.div>
        ))}
      </div>

      {/* شريط الأدوات */}
      <div className="reports-toolbar" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '15px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <select value={reportType} onChange={e => setReportType(e.target.value)}
            style={{ background: '#041d14', border: '1px solid rgba(214,175,55,0.3)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
            <option value="daily">📋 الحضور اليومي</option>
            <option value="absent">❌ بيان الغياب</option>
            <option value="monthly">📊 التقرير الشهري</option>
            <option value="student">👤 ملف طالب</option>
            <option value="major">📚 تقرير تخصص</option>
            <option value="discipline">🏆 تقييم الانضباط</option>
            <option value="absence_stages">🚨 مراحل الغياب</option>
          </select>

          <AnimatePresence mode="wait">
            {(reportType === 'daily' || reportType === 'absent') && (
              <motion.input initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '11px 15px', borderRadius: '12px', color: '#fff', fontWeight: 600 }} />
            )}
            {(reportType === 'monthly' || reportType === 'major') && (
              <motion.input initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '11px 15px', borderRadius: '12px', color: '#fff', fontWeight: 600 }} />
            )}
            {reportType === 'student' && (
              <motion.select initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '11px 15px', borderRadius: '12px', color: '#fff', maxWidth: '280px' }}>
                <option value="">اختر طالباً...</option>
                {students.map(s => <option key={s.id} value={s.id} style={{background:'#041d14'}}>{s.full_name} ({s.university_id})</option>)}
              </motion.select>
            )}
            {reportType === 'major' && (
              <motion.select initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                value={selectedMajor} onChange={e => setSelectedMajor(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '11px 15px', borderRadius: '12px', color: '#fff', maxWidth: '280px' }}>
                <option value="">اختر تخصصاً...</option>
                {majors.map(m => <option key={m.id} value={m.id} style={{background:'#041d14'}}>{m.name}</option>)}
              </motion.select>
            )}
          </AnimatePresence>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={handlePrintHTML} disabled={!reportData?.length}
            style={{ background: 'linear-gradient(135deg, #052318, #0b4630)', color: 'var(--gold-light)', border: '1px solid rgba(214,175,55,0.4)', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', opacity: reportData?.length ? 1 : 0.4 }}>
            📄 PDF
          </motion.button>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={exportExcel} disabled={!reportData?.length}
            style={{ background: 'linear-gradient(135deg, var(--emerald-light), #047857)', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', opacity: reportData?.length ? 1 : 0.4 }}>
            📊 Excel
          </motion.button>
        </div>
      </div>

      {/* عنوان التقرير */}
      <div style={{ marginBottom: '20px', borderRight: '4px solid var(--gold-main)', paddingRight: '15px' }}>
        <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.7rem', color: 'var(--gold-light)', margin: 0 }}>{getReportTitle()}</h3>
        <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0' }}>تم العثور على <strong style={{ color: '#fff' }}>{reportData?.length || 0}</strong> سجل.</p>
      </div>

      {/* جدول البيانات */}
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--gold-main)' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(214,175,55,0.1)', borderTopColor: 'var(--gold-main)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 15px' }} />
          جاري الفحص...
        </div>
      ) : reportData && reportData.length > 0 ? (
        <div className="data-table" style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)', position: 'sticky', top: 0, zIndex: 10 }}>
                {Object.keys(reportData[0]).filter(k => k !== 'photo').map(key => (
                  <th key={key} style={{ padding: '16px 20px', color: 'var(--gold-light)', fontWeight: 700, fontSize: '0.92rem', borderBottom: '2px solid rgba(214,175,55,0.2)' }}>{translateHeader(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, i) => {
                const hasDanger = row.rate < 75 || row.status === 'absent' || row.absences > 3 || row.stage?.includes('حرمان');
                return (
                  <motion.tr key={i} whileHover={{ background: 'rgba(214,175,55,0.03)' }}
                    style={{ background: hasDanger ? 'rgba(239,68,68,0.02)' : i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    {Object.keys(row).filter(k => k !== 'photo').map((key, j) => {
                      const val = row[key];
                      let cellColor = '#e2e8f0';
                      if (val === 'present' || key === 'present' || key === 'attendance_score') cellColor = 'var(--green-bright)';
                      if (val === 'absent' || (hasDanger && key === 'rate')) cellColor = '#ef4444';
                      if (val === 'late' || key === 'university_id') cellColor = 'var(--gold-main)';
                      if (key === 'stage') cellColor = row.stageColor || '#e2e8f0';
                      return (
                        <td key={j} style={{ padding: '14px 20px', fontSize: '0.9rem', color: cellColor, fontWeight: (key === 'full_name' || key === 'rate' || key === 'stage') ? 700 : 500 }}>
                          {key === 'rate' ? `${val}%` : translateValue(val)}
                        </td>
                      );
                    })}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', padding: '60px', borderRadius: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '15px' }}>📭</span>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>لا توجد بيانات</p>
        </div>
      )}
    </motion.div>
  );
}

export default Reports;
