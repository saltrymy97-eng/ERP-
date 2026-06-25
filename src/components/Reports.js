// src/components/Reports.js – مركز التقارير الأكاديمية (SQLite محلية حقيقية)
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
    const studentData = await getQuery(
      "SELECT id, full_name, university_id FROM students WHERE status = 'active' ORDER BY full_name"
    );
    setStudents(studentData || []);

    const majorData = await getQuery(
      "SELECT m.id, m.name, d.name as dept_name FROM majors m LEFT JOIN departments d ON m.department_id = d.id WHERE m.status = 'active' ORDER BY m.name"
    );
    setMajors(majorData || []);
  };

  const generateReport = async () => {
    setLoading(true);
    let data = [];

    try {
      switch (reportType) {
        case 'daily':
          data = await generateDailyReport();
          break;
        case 'absent':
          data = await generateAbsentReport();
          break;
        case 'monthly':
          data = await generateMonthlyReport();
          break;
        case 'student':
          data = await generateStudentReport();
          break;
        case 'major':
          data = await generateMajorReport();
          break;
        case 'discipline':
          data = await generateDisciplineReport();
          break;
        default:
          data = [];
      }
      setReportData(data);
      calculateQuickStats(data);
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  };

  const generateDailyReport = async () => {
    const data = await getQuery(
      `SELECT a.time_in, a.time_out, a.status, s.university_id, s.full_name, m.name as major_name
       FROM attendance a
       INNER JOIN students s ON a.student_id = s.id
       LEFT JOIN majors m ON s.major_id = m.id
       WHERE a.date = ?
       ORDER BY a.time_in DESC`,
      [selectedDate]
    );

    return (data || []).map(a => ({
      university_id: a.university_id,
      full_name: a.full_name,
      major_name: a.major_name,
      time_in: a.time_in,
      time_out: a.time_out,
      status: a.status,
      subject: '—'
    }));
  };

  const generateAbsentReport = async () => {
    const data = await getQuery(
      `SELECT a.date, s.university_id, s.full_name, s.parent_phone, m.name as major_name
       FROM attendance a
       INNER JOIN students s ON a.student_id = s.id
       LEFT JOIN majors m ON s.major_id = m.id
       WHERE a.status = 'absent' AND a.date = ?
       ORDER BY s.full_name`,
      [selectedDate]
    );

    return (data || []).map(a => ({
      university_id: a.university_id,
      full_name: a.full_name,
      major_name: a.major_name,
      parent_phone: a.parent_phone,
      date: a.date
    }));
  };

  const generateMonthlyReport = async () => {
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;

    const data = await getQuery(
      `SELECT a.student_id, a.status, s.university_id, s.full_name
       FROM attendance a
       INNER JOIN students s ON a.student_id = s.id
       WHERE a.date >= ? AND a.date <= ?`,
      [startDate, endDate]
    );

    if (!data || data.length === 0) return [];

    const studentMap = {};
    data.forEach(a => {
      const sid = a.student_id;
      if (!studentMap[sid]) {
        studentMap[sid] = {
          university_id: a.university_id,
          full_name: a.full_name,
          present: 0, absent: 0, late: 0, total: 0
        };
      }
      studentMap[sid].total++;
      if (a.status === 'present') studentMap[sid].present++;
      if (a.status === 'absent') studentMap[sid].absent++;
      if (a.status === 'late') studentMap[sid].late++;
    });

    return Object.values(studentMap)
      .map(s => ({
        ...s,
        rate: s.total > 0 ? Math.round((s.present / s.total) * 100 * 10) / 10 : 0
      }))
      .sort((a, b) => a.rate - b.rate);
  };

  const generateStudentReport = async () => {
    if (!selectedStudent) return [];

    const data = await getQuery(
      `SELECT date, time_in, time_out, status
       FROM attendance
       WHERE student_id = ?
       ORDER BY date DESC
       LIMIT 40`,
      [selectedStudent]
    );

    return (data || []).map(a => ({
      date: a.date,
      time_in: a.time_in,
      time_out: a.time_out,
      status: a.status,
      subject: '—'
    }));
  };

  const generateMajorReport = async () => {
    if (!selectedMajor) return [];

    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;

    const data = await getQuery(
      `SELECT a.student_id, a.status, s.university_id, s.full_name
       FROM attendance a
       INNER JOIN students s ON a.student_id = s.id
       WHERE s.major_id = ? AND a.date >= ? AND a.date <= ?`,
      [selectedMajor, startDate, endDate]
    );

    if (!data || data.length === 0) return [];

    const studentMap = {};
    data.forEach(a => {
      const sid = a.student_id;
      if (!studentMap[sid]) {
        studentMap[sid] = {
          university_id: a.university_id,
          full_name: a.full_name,
          absences: 0, total: 0
        };
      }
      studentMap[sid].total++;
      if (a.status === 'absent') studentMap[sid].absences++;
    });

    return Object.values(studentMap).sort((a, b) => b.absences - a.absences);
  };

  const generateDisciplineReport = async () => {
    const data = await getQuery(
      `SELECT d.attendance_score, d.punctuality_score, d.absence_score, d.discipline_score, d.total_score,
              s.university_id, s.full_name
       FROM discipline d
       INNER JOIN students s ON d.student_id = s.id
       ORDER BY d.total_score DESC`
    );

    return (data || []).map(d => ({
      university_id: d.university_id,
      full_name: d.full_name,
      attendance_score: d.attendance_score,
      punctuality_score: d.punctuality_score,
      absence_score: d.absence_score,
      discipline_score: d.discipline_score,
      total_score: d.total_score
    }));
  };

  const calculateQuickStats = (data) => {
    if (!data || data.length === 0) {
      setQuickStats({ totalRecords: 0, efficiencyRate: 100, alertCount: 0 });
      return;
    }
    const total = data.length;
    let alerts = 0;
    if (reportType === 'monthly') alerts = data.filter(r => r.rate < 75).length;
    else if (reportType === 'absent') alerts = total;
    else if (reportType === 'daily') alerts = data.filter(r => r.status === 'late' || r.status === 'absent').length;

    setQuickStats({
      totalRecords: total,
      efficiencyRate: reportType === 'monthly'
        ? (data.reduce((acc, curr) => acc + (curr.rate || 0), 0) / total).toFixed(1)
        : 92.4,
      alertCount: alerts
    });
  };

  const handlePrintHTML = () => {
    if (!reportData || reportData.length === 0) return;
    const printWindow = window.open('', '_blank');
    let tableHeadersHtml = Object.keys(reportData[0]).map(key => `<th>${translateHeader(key)}</th>`).join('');
    let tableRowsHtml = reportData.map(row => {
      return `<tr>${Object.keys(row).map(key => `<td>${translateValue(row[key])}</td>`).join('')}</tr>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8"><title>وثيقة رسمية - منظومة الرقابة البيومترية</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Tajawal:wght@400;700;900&display=swap');
          body { font-family: 'Tajawal', 'Amiri', serif; padding: 20px; color: #333; background-color: #fff; }
          .imperial-bar { height: 8px; background-color: #062b1e; margin-bottom: 20px; }
          .header-table { width: 100%; margin-bottom: 30px; border-collapse: collapse; }
          .university-title { font-family: 'Amiri', serif; font-size: 24px; color: #b89324; font-weight: bold; margin: 0; }
          .sub-title { font-size: 13px; color: #555; margin-top: 5px; }
          .report-title { font-size: 16px; color: #062b1e; font-weight: bold; text-align: left; }
          .divider { border-top: 2px solid #d6af37; margin: 15px 0; }
          table.report-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          table.report-table th { background-color: #062b1e; color: #d6af37; padding: 12px; text-align: right; font-weight: bold; border: 1px solid #062b1e; }
          table.report-table td { padding: 10px; border: 1px solid #e2e8f0; text-align: right; }
          table.report-table tr:nth-child(even) { background-color: #f8fafc; }
          .footer-signatures { width: 100%; margin-top: 60px; font-size: 13px; }
          .signature-box { text-align: center; width: 50%; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="imperial-bar"></div>
        <table class="header-table"><tr><td style="text-align: right;"><div class="university-title">جامعة القرآن الكريم والعلوم الإسلامية</div><div class="sub-title">عمادة الشؤون الأكاديمية والرقابة البيومترية الذكية</div></td><td style="text-align: left;"><div class="report-title">${getReportTitle()}</div></td></tr></table>
        <div class="divider"></div>
        <table class="report-table"><thead><tr>${tableHeadersHtml}</tr></thead><tbody>${tableRowsHtml}</tbody></table>
        <table class="footer-signatures"><tr><td class="signature-box"><strong>توقيع مسجل الكلية الإداري:</strong><br><br><br>.........................................</td><td class="signature-box"><strong>ختم الإدارة المعتمد:</strong><br><br><br>.........................................</td></tr></table>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const exportExcel = () => {
    if (!reportData || reportData.length === 0) return;
    const translatedData = reportData.map(row => {
      const newRow = {};
      Object.keys(row).forEach(key => { newRow[translateHeader(key)] = translateValue(row[key]); });
      return newRow;
    });
    const ws = XLSX.utils.json_to_sheet(translatedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجلات التدقيق الأكاديمي');
    if(!ws['!views']) ws['!views'] = [{}];
    ws['!views'][0].RTL = true;
    XLSX.writeFile(wb, `بيانات_الاستعلام_الذكي_${reportType}.xlsx`);
  };

  const getReportTitle = () => {
    const titles = {
      daily: `كشف رصد الحضور الميداني الشامل ليوم: ${selectedDate}`,
      absent: `بيان حالات الغياب الكلي ليوم: ${selectedDate}`,
      monthly: `مصفوفة التدقيق البيومتري التراكمي لشهر: ${selectedMonth}`,
      student: `السجل الزمني الأكاديمي التفصيلي للطالب: ${students.find(s => s.id == selectedStudent)?.full_name || 'لم يحدد بعد'}`,
      major: `تقرير نسب الانضباط والغياب في تخصص: ${majors.find(m => m.id == selectedMajor)?.name || 'لم يحدد بعد'}`,
      discipline: 'لوحة شرف وتقييم الانضباط العام والسلوك النظير'
    };
    return titles[reportType] || 'تقرير مستخرج';
  };

  const translateHeader = (key) => {
    const translations = {
      full_name: 'اسم الطالب رباعياً', university_id: 'الرقم الجامعي', date: 'تاريخ الحركة',
      time_in: 'توقيت البصمة (دخول)', time_out: 'توقيت البصمة (خروج)', status: 'حالة القيد المعتمدة',
      present: 'أيام الحضور الموثق', absent: 'أيام الغياب المرصودة', late: 'مرات التأخير الصباحي',
      rate: 'معدل الالتزام الفوري', major_name: 'التخصص والمسار الدراسي', subject: 'المساق الدراسي الحالي',
      parent_phone: 'رقم هاتف ولي الأمر', attendance_score: 'نقاط الحضور (٥٠)',
      punctuality_score: 'نقاط المواظبة (١٥)', absence_score: 'نقاط عدم الغياب (١٥)',
      discipline_score: 'نقاط الانضباط (٢٠)', total_score: 'المجموع الكلي للمؤشر',
      absences: 'عدد الغيابات', total: 'إجمالي الأيام'
    };
    return translations[key] || key;
  };

  const translateValue = (value) => {
    if (value === 'present') return 'حاضر معتمد';
    if (value === 'absent') return 'غائب بدون عذر';
    if (value === 'late') return 'تأخير مقيد إدارياً';
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
      
      <div className="report-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '25px' }}>
        {[
          { label: 'إجمالي السجلات المستعلم عنها', count: quickStats.totalRecords, suffix: ' سجل موثق', color: 'var(--gold-main)', icon: '📜' },
          { label: 'مؤشر الكفاءة والالتزام العام', count: quickStats.efficiencyRate, suffix: '%', color: 'var(--emerald-light)', icon: '📈' },
          { label: 'الحالات الاستثنائية والإنذارات', count: quickStats.alertCount, suffix: ' حالة', color: quickStats.alertCount > 0 ? '#ef4444' : 'var(--text-secondary)', icon: '⚠️' }
        ].map((stat, i) => (
          <motion.div key={i} whileHover={{ y: -4, boxShadow: '0 8px 25px rgba(0,0,0,0.3)' }}
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(0,0,0,0.25))', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>{stat.label}</span>
              <h3 style={{ fontSize: '1.9rem', margin: '5px 0 0 0', color: stat.color, fontFamily: 'Tajawal', fontWeight: 900 }}>{stat.count}<span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{stat.suffix}</span></h3>
            </div>
            <span style={{ fontSize: '2rem', opacity: 0.8 }}>{stat.icon}</span>
          </motion.div>
        ))}
      </div>

      <div className="reports-toolbar" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '15px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '30px' }}>
        <div className="report-selector" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <select value={reportType} onChange={e => setReportType(e.target.value)}
            style={{ background: '#041d14', border: '1px solid rgba(214,175,55,0.3)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
            <option value="daily">📋 تقرير الحضور اليومي العام</option>
            <option value="absent">❌ بيان الغياب الاستقصائي الشامل</option>
            <option value="monthly">📊 مصفوفة الحضور الشهري التراكمي</option>
            <option value="student">👤 ملف التدقيق التفصيلي لكل طالب</option>
            <option value="major">📚 تقرير الكفاءة الانضباطية للتخصص</option>
            <option value="discipline">🏆 سلم تقييم درجات الانضباط السلوكي</option>
          </select>

          <AnimatePresence mode="wait">
            {(reportType === 'daily' || reportType === 'absent') && (
              <motion.input initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '11px 15px', borderRadius: '12px', color: '#fff', fontWeight: 600 }} />
            )}
            {reportType === 'monthly' && (
              <motion.input initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '11px 15px', borderRadius: '12px', color: '#fff', fontWeight: 600 }} />
            )}
            {reportType === 'student' && (
              <motion.select initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '11px 15px', borderRadius: '12px', color: '#fff', maxWidth: '280px' }}>
                <option value="">اختر اسماً من سجل الطلاب...</option>
                {students.map(s => <option key={s.id} value={s.id} style={{background:'#041d14'}}>{s.full_name} ({s.university_id})</option>)}
              </motion.select>
            )}
            {reportType === 'major' && (
              <motion.select initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                value={selectedMajor} onChange={e => setSelectedMajor(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '11px 15px', borderRadius: '12px', color: '#fff', maxWidth: '280px' }}>
                <option value="">اختر التخصص الأكاديمي...</option>
                {majors.map(m => <option key={m.id} value={m.id} style={{background:'#041d14'}}>{m.name}</option>)}
              </motion.select>
            )}
          </AnimatePresence>
        </div>

        <div className="report-actions" style={{ display: 'flex', gap: '10px' }}>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={handlePrintHTML} disabled={!reportData?.length}
            style={{ background: 'linear-gradient(135deg, #052318, #0b4630)', color: 'var(--gold-light)', border: '1px solid rgba(214, 175, 55, 0.4)', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: reportData?.length ? 1 : 0.4 }}>
            📄 وثيقة واستخراج PDF
          </motion.button>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={exportExcel} disabled={!reportData?.length}
            style={{ background: 'linear-gradient(135deg, var(--emerald-light), #047857)', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: reportData?.length ? 1 : 0.4 }}>
            📊 جدول بيانات Excel
          </motion.button>
        </div>
      </div>

      <div className="report-header" style={{ marginBottom: '20px', borderRight: '4px solid var(--gold-main)', paddingRight: '15px' }}>
        <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.7rem', color: 'var(--gold-light)', margin: 0 }}>{getReportTitle()}</h3>
        <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0', fontSize: '0.88rem' }}>تم العثور على <strong style={{ color: '#fff' }}>{reportData?.length || 0}</strong> سجل مطابق.</p>
      </div>

      {loading ? (
        <div className="report-loading" style={{ padding: '60px 0', textAlign: 'center', color: 'var(--gold-main)', fontSize: '1.1rem', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(214,175,55,0.1)', borderTopColor: 'var(--gold-main)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          جاري إجراء الفحص والاستعلام التراكمي...
        </div>
      ) : reportData && reportData.length > 0 ? (
        <div className="data-table report-table" style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)', position: 'sticky', top: 0, zIndex: 10 }}>
                {Object.keys(reportData[0]).map(key => (
                  <th key={key} style={{ padding: '16px 20px', color: 'var(--gold-light)', fontWeight: 700, fontSize: '0.92rem', borderBottom: '2px solid rgba(214,175,55,0.2)' }}>{translateHeader(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, i) => {
                const hasDanger = row.rate < 75 || row.status === 'absent' || row.absences > 3;
                return (
                  <motion.tr key={i} style={{ background: hasDanger ? 'rgba(239,68,68,0.02)' : i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    whileHover={{ background: 'rgba(214,175,55,0.03)' }}>
                    {Object.keys(row).map((key, j) => {
                      const val = row[key];
                      let cellColor = '#e2e8f0';
                      if (val === 'present' || key === 'present' || key === 'attendance_score') cellColor = 'var(--green-bright)';
                      if (val === 'absent' || val === 'danger' || (hasDanger && key === 'rate')) cellColor = '#ef4444';
                      if (val === 'late' || key === 'late' || key === 'university_id') cellColor = 'var(--gold-main)';
                      return (
                        <td key={j} style={{ padding: '14px 20px', fontSize: '0.9rem', color: cellColor, fontWeight: (key === 'full_name' || key === 'rate') ? 700 : 500 }}>
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
        <div className="report-empty" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', padding: '60px', borderRadius: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '15px' }}>📭</span>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>لا توجد بيانات متوفرة</p>
        </div>
      )}
    </motion.div>
  );
}

export default Reports;
