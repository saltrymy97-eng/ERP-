// components/Reports.js – واجهة التقارير والتصدير
import React, { useState, useEffect } from 'react';
import { getQuery } from '../services/db';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    generateReport();
  }, [reportType, selectedDate, selectedMonth, selectedStudent, selectedMajor]);

  // ========== تحميل الفلاتر ==========
  const loadFilters = () => {
    const studentData = getQuery("SELECT id, full_name, university_id FROM students WHERE status='active' ORDER BY full_name");
    setStudents(studentData);

    const majorData = getQuery(`
      SELECT m.id, m.name, d.name as dept_name
      FROM majors m
      JOIN departments d ON m.department_id = d.id
      WHERE m.status='active'
      ORDER BY m.name
    `);
    setMajors(majorData);
  };

  // ========== توليد التقرير ==========
  const generateReport = () => {
    setLoading(true);
    let data = [];

    switch (reportType) {
      case 'daily':
        data = getQuery(`
          SELECT a.*, s.full_name, s.university_id, s.parent_phone,
                 m.name as major_name, sc.subject, sc.time_from, sc.time_to, sc.room
          FROM attendance a
          JOIN students s ON a.student_id = s.id
          LEFT JOIN majors m ON s.major_id = m.id
          LEFT JOIN schedules sc ON a.schedule_id = sc.id
          WHERE a.date = ?
          ORDER BY a.time_in DESC
        `, [selectedDate]);
        break;

      case 'absent':
        data = getQuery(`
          SELECT s.full_name, s.university_id, s.parent_phone,
                 m.name as major_name, a.date
          FROM attendance a
          JOIN students s ON a.student_id = s.id
          LEFT JOIN majors m ON s.major_id = m.id
          WHERE a.status = 'absent' AND a.date = ?
          ORDER BY s.full_name
        `, [selectedDate]);
        break;

      case 'monthly':
        data = getQuery(`
          SELECT s.full_name, s.university_id,
                 COUNT(CASE WHEN a.status='present' THEN 1 END) as present,
                 COUNT(CASE WHEN a.status='absent' THEN 1 END) as absent,
                 COUNT(CASE WHEN a.status='late' THEN 1 END) as late,
                 ROUND(CAST(COUNT(CASE WHEN a.status='present' THEN 1 END) AS FLOAT)/COUNT(*)*100,1) as rate
          FROM students s
          JOIN attendance a ON s.id = a.student_id
          WHERE a.date LIKE '${selectedMonth}%'
          GROUP BY s.id
          ORDER BY rate ASC
        `);
        break;

      case 'student':
        if (selectedStudent) {
          data = getQuery(`
            SELECT a.date, a.time_in, a.time_out, a.status, a.late_minutes,
                   sc.subject, sc.time_from, sc.time_to
            FROM attendance a
            LEFT JOIN schedules sc ON a.schedule_id = sc.id
            WHERE a.student_id = ?
            ORDER BY a.date DESC
            LIMIT 60
          `, [selectedStudent]);
        }
        break;

      case 'major':
        if (selectedMajor) {
          data = getQuery(`
            SELECT s.full_name, s.university_id,
                   COUNT(CASE WHEN a.status='absent' THEN 1 END) as absences,
                   COUNT(*) as total
            FROM students s
            JOIN attendance a ON s.id = a.student_id
            WHERE s.major_id = ? AND a.date LIKE '${selectedMonth}%'
            GROUP BY s.id
            ORDER BY absences DESC
          `, [selectedMajor]);
        }
        break;

      case 'discipline':
        data = getQuery(`
          SELECT s.full_name, s.university_id,
                 d.attendance_score, d.punctuality_score, d.absence_score, d.discipline_score, d.total_score
          FROM discipline d
          JOIN students s ON d.student_id = s.id
          ORDER BY d.total_score DESC
        `);
        break;

      default:
        data = [];
    }

    setReportData(data);
    setLoading(false);
  };

  // ========== تصدير PDF ==========
  const exportPDF = () => {
    if (!reportData || reportData.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont('Amiri', 'normal');

    // عنوان التقرير
    doc.setFontSize(18);
    doc.text('جامعة القرآن الكريم والعلوم الإسلامية', 148, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text(getReportTitle(), 148, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, 148, 32, { align: 'center' });

    // جدول البيانات
    const headers = Object.keys(reportData[0]).map(k => translateHeader(k));
    const rows = reportData.map(row => Object.values(row));

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 40,
      styles: { font: 'Amiri', halign: 'right' },
      headStyles: { fillColor: [8, 61, 43], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`تقرير_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ========== تصدير Excel ==========
  const exportExcel = () => {
    if (!reportData || reportData.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
    XLSX.writeFile(wb, `تقرير_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ========== طباعة ==========
  const printReport = () => {
    window.print();
  };

  // ========== عنوان التقرير ==========
  const getReportTitle = () => {
    const titles = {
      daily: `تقرير الحضور اليومي - ${selectedDate}`,
      absent: `تقرير الغياب اليومي - ${selectedDate}`,
      monthly: `تقرير الحضور الشهري - ${selectedMonth}`,
      student: `تقرير طالب - ${students.find(s => s.id == selectedStudent)?.full_name || ''}`,
      major: `تقرير مادة - ${majors.find(m => m.id == selectedMajor)?.name || ''}`,
      discipline: 'تقرير تقييم الانضباط'
    };
    return titles[reportType] || 'تقرير';
  };

  // ========== ترجمة رؤوس الأعمدة ==========
  const translateHeader = (key) => {
    const translations = {
      full_name: 'الاسم',
      university_id: 'الرقم الجامعي',
      date: 'التاريخ',
      time_in: 'وقت الدخول',
      time_out: 'وقت الخروج',
      status: 'الحالة',
      present: 'حضور',
      absent: 'غياب',
      late: 'تأخير',
      rate: 'النسبة',
      major_name: 'التخصص',
      subject: 'المادة',
      room: 'القاعة',
      parent_phone: 'ولي الأمر',
      attendance_score: 'الحضور',
      punctuality_score: 'الالتزام',
      absence_score: 'عدم الغياب',
      discipline_score: 'الانضباط',
      total_score: 'المجموع'
    };
    return translations[key] || key;
  };

  // ========== ترجمة القيم ==========
  const translateValue = (value) => {
    if (value === 'present') return '✅ حاضر';
    if (value === 'absent') return '❌ غائب';
    if (value === 'late') return '⚠️ متأخر';
    return value;
  };

  return (
    <div className="reports-module">
      {/* شريط الأدوات */}
      <div className="reports-toolbar">
        <div className="report-selector">
          <select value={reportType} onChange={e => setReportType(e.target.value)}>
            <option value="daily">📋 تقرير الحضور اليومي</option>
            <option value="absent">❌ تقرير الغياب اليومي</option>
            <option value="monthly">📊 تقرير الحضور الشهري</option>
            <option value="student">👤 تقرير لكل طالب</option>
            <option value="major">📚 تقرير لكل مادة</option>
            <option value="discipline">🏆 تقرير تقييم الانضباط</option>
          </select>

          {(reportType === 'daily' || reportType === 'absent') && (
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          )}

          {reportType === 'monthly' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            />
          )}

          {reportType === 'student' && (
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
              <option value="">اختر طالباً</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name} - {s.university_id}</option>
              ))}
            </select>
          )}

          {reportType === 'major' && (
            <select value={selectedMajor} onChange={e => setSelectedMajor(e.target.value)}>
              <option value="">اختر تخصصاً</option>
              {majors.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="report-actions">
          <button className="btn-pdf" onClick={exportPDF} disabled={!reportData?.length}>
            📥 PDF
          </button>
          <button className="btn-excel" onClick={exportExcel} disabled={!reportData?.length}>
            📊 Excel
          </button>
          <button className="btn-print" onClick={printReport}>
            🖨️ طباعة
          </button>
        </div>
      </div>

      {/* عنوان التقرير */}
      <div className="report-header">
        <h3>{getReportTitle()}</h3>
        <p>{reportData?.length || 0} سجل</p>
      </div>

      {/* جدول البيانات */}
      {loading ? (
        <div className="report-loading">⏳ جاري تحميل التقرير...</div>
      ) : reportData && reportData.length > 0 ? (
        <div className="data-table report-table">
          <table>
            <thead>
              <tr>
                {Object.keys(reportData[0]).map(key => (
                  <th key={key}>{translateHeader(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <td key={j}>{translateValue(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="report-empty">
          <p>📭 لا توجد بيانات للتقرير المحدد</p>
          <p>يرجى تغيير معايير البحث أو إضافة بيانات أولاً</p>
        </div>
      )}
    </div>
  );
}

export default Reports;
