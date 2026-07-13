// src/components/Teachers.js – إدارة رصد حضور المدرسين والأكاديميين (متوافق مع بنية SQLite 4.0 وطلبات الأستاذ سعيد)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery, initDatabase } from '../services/db';

function Teachers() {
  const [tab, setTab] = useState('manage'); // 'manage' | 'live' | 'today' | 'monthly'
  const [teachers, setTeachers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [dbReady, setDbReady] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, presentToday: 0, absentToday: 0 });
  
  // لطلب المدخلات عند حضور المدرس (عنوان الدرس ونسبة الإنجاز)
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedTeacherForAttendance, setSelectedTeacherForAttendance] = useState(null);
  const [lessonForm, setLessonForm] = useState({ lesson_title: '', completion_rate: 10 });

  // رصد الحضور الفعلي لليوم
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [scanningId, setScanningId] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [monthlyReports, setMonthlyReports] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const photoInputRef = useRef(null);
  const attendanceTimeoutRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  const initialFormState = {
    teacher_id: '', full_name: '', email: '', phone: '',
    speciality: '', department_id: '', college_id: '', qualifications: '', photo: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // ========== تهيئة قاعدة البيانات وإنشاء جدول حضور المعلمين إن لم يكن موجوداً ==========
  useEffect(() => {
    let isMounted = true;
    const setup = async () => {
      try {
        await initDatabase();
        // إنشاء جدول حضور المعلمين المتوافق مع طلبات الأستاذ سعيد
        await runQuery(`
          CREATE TABLE IF NOT EXISTS teacher_attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER,
            date TEXT,
            time_in TEXT,
            time_out TEXT,
            status TEXT, -- 'present', 'absent', 'late'
            lesson_title TEXT, -- طلب الأستاذ سعيد (عنوان الدرس)
            completion_rate INTEGER, -- طلب الأستاذ سعيد (نسبة الإنجاز)
            total_hours REAL DEFAULT 0, -- طلب الأستاذ سعيد (إجمالي الساعات)
            method TEXT,
            FOREIGN KEY(teacher_id) REFERENCES teachers(id)
          )
        `);

        if (isMounted) {
          setDbReady(true);
          await loadColleges();
          await loadDepartments();
          const loadedTeachers = await loadTeachers();
          const loadedAttendance = await loadTodayAttendance();
          await calculateStats(loadedTeachers, loadedAttendance);
        }
      } catch (error) {
        console.error("خطأ أثناء تهيئة واجهة المعلمين وحضورهم:", error);
      }
    };
    setup();
    return () => {
      isMounted = false;
      if (attendanceTimeoutRef.current) clearTimeout(attendanceTimeoutRef.current);
    };
  }, []);

  // تحديث التقرير الشهري عند تفعيله
  useEffect(() => {
    if (tab === 'monthly' && dbReady) {
      loadMonthlyReports();
    }
  }, [selectedMonth, tab, dbReady]);

  // ========== تحميل الكليات ==========
  const loadColleges = useCallback(async () => {
    const data = await getQuery("SELECT * FROM colleges WHERE status = 'active' ORDER BY name");
    setColleges(data || []);
  }, []);

  // ========== تحميل الأقسام ==========
  const loadDepartments = useCallback(async (collegeId = null) => {
    if (collegeId) {
      const data = await getQuery("SELECT * FROM departments WHERE college_id = ? AND status = 'active' ORDER BY name", [collegeId]);
      setDepartments(data || []);
    } else {
      const data = await getQuery("SELECT d.*, c.name as college_name FROM departments d LEFT JOIN colleges c ON d.college_id = c.id WHERE d.status = 'active' ORDER BY d.name");
      setDepartments(data || []);
    }
  }, []);

  // ========== تحميل المعلمين ==========
  const loadTeachers = useCallback(async () => {
    const data = await getQuery(
      "SELECT t.*, d.name as department_name, c.name as college_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id LEFT JOIN colleges c ON t.college_id = c.id WHERE t.status = 'active' ORDER BY t.full_name"
    );
    setTeachers(data || []);
    return data || [];
  }, []);

  // ========== تحميل سجل حضور معلمين اليوم ==========
  const loadTodayAttendance = async () => {
    const data = await getQuery(`
      SELECT ta.*, t.full_name, t.teacher_id as doc_id, t.photo, t.speciality,
             c.name as college_name
      FROM teacher_attendance ta
      INNER JOIN teachers t ON ta.teacher_id = t.id
      LEFT JOIN colleges c ON t.college_id = c.id
      WHERE ta.date = ?
      ORDER BY ta.time_in DESC`,
      [today]
    );
    setTodayAttendance(data || []);
    return data || [];
  };

  // ========== حساب الإحصائيات الشاملة ==========
  const calculateStats = async (allTeachers = null, attToday = null) => {
    const activeTeachers = allTeachers || teachers;
    const currentAtt = attToday || todayAttendance;

    const present = currentAtt.filter(a => a.status === 'present' || a.status === 'late').length;
    const absent = currentAtt.filter(a => a.status === 'absent').length;

    setStats({
      total: activeTeachers.length,
      active: activeTeachers.filter(t => t.status === 'active').length,
      presentToday: present,
      absentToday: absent
    });
  };

  // ========== حساب إجمالي الساعات المنفذة عند تسجيل الانصراف ==========
  const calculateHours = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return 0;
    try {
      const [h1, m1] = timeIn.split(':').map(Number);
      const [h2, m2] = timeOut.split(':').map(Number);
      
      const date1 = new Date(2026, 0, 1, h1, m1);
      const date2 = new Date(2026, 0, 1, h2, m2);
      
      let diffMs = date2 - date1;
      if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // معالجة عبور منتصف الليل
      
      const diffHours = diffMs / (1000 * 60 * 60);
      return parseFloat(diffHours.toFixed(2)); // إرجاع الساعات بكسر عشري دقيق
    } catch (e) {
      return 0;
    }
  };

  // ========== فتح نافذة تسجيل الحضور لتدوين الدرس ونسبة الإنجاز ==========
  const initiateAttendance = (teacher) => {
    setSelectedTeacherForAttendance(teacher);
    setLessonForm({ lesson_title: '', completion_rate: 10 });
    setShowLessonModal(true);
  };

  // ========== حفظ حركة الحضور البيومترية مع متطلبات الدرس ==========
  const submitAttendance = async () => {
    if (!lessonForm.lesson_title.trim()) {
      return alert("❌ يرجى توثيق عنوان المحاضرة أو الدرس الحالي للأستاذ سعيد");
    }

    const teacher = selectedTeacherForAttendance;
    setShowLessonModal(false);
    setScanningId(teacher.id);

    // محاكاة الاتصال بمستشعر البصمة
    attendanceTimeoutRef.current = setTimeout(async () => {
      const now = new Date();
      const timeNow = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false });
      const status = 'present';

      // التحقق من تكرار الحركة لليوم
      const exists = await getQuery(
        "SELECT id FROM teacher_attendance WHERE teacher_id = ? AND date = ?",
        [teacher.id, today]
      );

      if (exists && exists.length > 0) {
        await runQuery(
          "UPDATE teacher_attendance SET status = ?, time_in = ?, lesson_title = ?, completion_rate = ? WHERE teacher_id = ? AND date = ?",
          [status, timeNow, lessonForm.lesson_title, lessonForm.completion_rate, teacher.id, today]
        );
      } else {
        await runQuery(
          "INSERT INTO teacher_attendance (teacher_id, date, time_in, status, lesson_title, completion_rate, method) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [teacher.id, today, timeNow, status, lessonForm.lesson_title, lessonForm.completion_rate, 'biometric']
        );
      }

      setAttendanceStatus({
        teacher: teacher.full_name,
        time: timeNow,
        status: `حضور معتمد مع الدرس: [${lessonForm.lesson_title}] بنسبة إنجاز ${lessonForm.completion_rate}%`,
        icon: '⚡',
        color: '#f472b6'
      });

      setScanningId(null);
      attendanceTimeoutRef.current = null;

      const updatedAtt = await loadTodayAttendance();
      await calculateStats(null, updatedAtt);
    }, 1000);
  };

  // ========== تسجيل غياب المعلم إدارياً ==========
  const markAbsent = async (teacher) => {
    if (window.confirm(`⚠️ هل ترغب في تسجيل غياب إداري للأستاذ/ة ${teacher.full_name} اليوم؟`)) {
      const exists = await getQuery(
        "SELECT id FROM teacher_attendance WHERE teacher_id = ? AND date = ?",
        [teacher.id, today]
      );

      if (exists && exists.length > 0) {
        await runQuery(
          "UPDATE teacher_attendance SET status = 'absent', time_in = NULL, time_out = NULL, total_hours = 0 WHERE teacher_id = ? AND date = ?",
          [teacher.id, today]
        );
      } else {
        await runQuery(
          "INSERT INTO teacher_attendance (teacher_id, date, status, method, total_hours) VALUES (?, ?, 'absent', 'manual', 0)",
          [teacher.id, today]
        );
      }

      setAttendanceStatus({
        teacher: teacher.full_name,
        time: '—',
        status: 'تم تقييد غياب رسمي للمحاضر وإشعار الشؤون الأكاديمية',
        icon: '❌',
        color: '#ef4444'
      });

      const updatedAtt = await loadTodayAttendance();
      await calculateStats(null, updatedAtt);
    }
  };

  // ========== تسجيل انصراف المعلم واحتساب الساعات تلقائياً ==========
  const markExit = async (attRecord) => {
    const now = new Date();
    const timeNow = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // حساب الساعات
    const hours = calculateHours(attRecord.time_in, timeNow);

    await runQuery(
      "UPDATE teacher_attendance SET time_out = ?, total_hours = ? WHERE id = ?",
      [timeNow, hours, attRecord.id]
    );

    alert(`🚪 تم إثبات انصراف الأستاذ بنجاح.\n⏱️ زمن الدخول: ${attRecord.time_in}\n🚪 زمن الانصراف: ${timeNow}\n📊 إجمالي الساعات المستحقة: ${hours} ساعة.`);
    
    const updatedAtt = await loadTodayAttendance();
    await calculateStats(null, updatedAtt);
  };

  // ========== استرجاع التقارير الشهرية التراكمية للمعلمين ==========
  const loadMonthlyReports = async () => {
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;

    const data = await getQuery(`
      SELECT ta.*, t.full_name, t.teacher_id as doc_id, t.speciality,
             c.name as college_name
      FROM teacher_attendance ta
      INNER JOIN teachers t ON ta.teacher_id = t.id
      LEFT JOIN colleges c ON t.college_id = c.id
      WHERE ta.date >= ? AND ta.date <= ?
      ORDER BY ta.date DESC`,
      [startDate, endDate]
    );

    if (!data || data.length === 0) {
      setMonthlyReports([]);
      return;
    }

    // تجميع الحركات لكل معلم شهرياً
    const teacherMap = {};
    data.forEach(item => {
      const tid = item.teacher_id;
      if (!teacherMap[tid]) {
        teacherMap[tid] = {
          full_name: item.full_name,
          doc_id: item.doc_id,
          college_name: item.college_name,
          speciality: item.speciality,
          days_present: 0,
          days_absent: 0,
          total_hours: 0,
          last_lesson: '—',
          last_completion_rate: 0
        };
      }

      if (item.status === 'present' || item.status === 'late') {
        teacherMap[tid].days_present++;
        teacherMap[tid].total_hours += item.total_hours || 0;
        // الاحتفاظ بآخر تدوين للمقرر
        if (item.lesson_title && teacherMap[tid].last_lesson === '—') {
          teacherMap[tid].last_lesson = item.lesson_title;
          teacherMap[tid].last_completion_rate = item.completion_rate;
        }
      } else if (item.status === 'absent') {
        teacherMap[tid].days_absent++;
      }
    });

    setMonthlyReports(Object.values(teacherMap));
  };

  // ========== إلغاء رصد حضور معلم وإعادة تفعيله ==========
  const resetAttendance = async (teacherId) => {
    await runQuery(
      "DELETE FROM teacher_attendance WHERE teacher_id = ? AND date = ?",
      [teacherId, today]
    );
    const updatedAtt = await loadTodayAttendance();
    await calculateStats(null, updatedAtt);
  };

  // ========== إدارة بيانات المدرسين (إضافة وتعديل وأرشفة) ==========
  const resetForm = () => { setFormData(initialFormState); setEditId(null); setShowForm(false); };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) return alert("❌ حجم الصورة كبير جداً. الحد الأقصى 500 كيلوبايت");
    const reader = new FileReader();
    reader.onload = (event) => setFormData({ ...formData, photo: event.target.result });
    reader.readAsDataURL(file);
  };

  const handleCollegeChange = async (collegeId) => {
    setFormData({ ...formData, college_id: collegeId, department_id: '' });
    if (collegeId) await loadDepartments(collegeId);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim() || !formData.teacher_id.trim()) {
      return alert("❌ يرجى إدخال اسم المعلم والرقم الوظيفي");
    }

    if (editId) {
      await runQuery(
        "UPDATE teachers SET teacher_id=?, full_name=?, email=?, phone=?, speciality=?, department_id=?, college_id=?, qualifications=?, photo=? WHERE id=?",
        [formData.teacher_id, formData.full_name, formData.email, formData.phone, formData.speciality, formData.department_id || null, formData.college_id || null, formData.qualifications, formData.photo, editId]
      );
    } else {
      await runQuery(
        "INSERT INTO teachers (teacher_id, full_name, email, phone, speciality, department_id, college_id, qualifications, photo, status) VALUES (?,?,?,?,?,?,?,?,?,'active')",
        [formData.teacher_id, formData.full_name, formData.email, formData.phone, formData.speciality, formData.department_id || null, formData.college_id || null, formData.qualifications, formData.photo]
      );
    }
    resetForm();
    const updatedTeachers = await loadTeachers();
    await calculateStats(updatedTeachers, null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("👨‍🏫 هل أنت متأكد من أرشفة سجل هذا المعلم؟")) {
      await runQuery("UPDATE teachers SET status = 'inactive' WHERE id = ?", [id]);
      const updatedTeachers = await loadTeachers();
      await calculateStats(updatedTeachers, null);
    }
  };

  const handleEdit = (teacher) => {
    setEditId(teacher.id);
    setFormData({
      teacher_id: teacher.teacher_id || '',
      full_name: teacher.full_name || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      speciality: teacher.speciality || '',
      department_id: teacher.department_id || '',
      college_id: teacher.college_id || '',
      qualifications: teacher.qualifications || '',
      photo: teacher.photo || ''
    });
    if (teacher.college_id) loadDepartments(teacher.college_id);
    setShowForm(true);
  };

  const printTeacherCard = (teacher) => {
    const cardWindow = window.open('', 'بطاقة معلم', 'width=480,height=680');
    cardWindow.document.write(`
      <html dir="rtl"><head><title>بطاقة عضو هيئة تدريس</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&family=Amiri:wght@700&display=swap" rel="stylesheet">
      <style>
        body{font-family:'Tajawal',sans-serif;background:#020b07;color:#fff;text-align:center;padding:0;margin:0;display:flex;align-items:center;justify-content:center;height:100vh}
        .card{border:2px dashed #f472b6;border-radius:24px;padding:30px;width:350px;background:linear-gradient(135deg,#052218,#0a3a29);position:relative;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.8);box-sizing:border-box}
        .card::before{content:"🏛️";position:absolute;font-size:16rem;opacity:0.03;top:15%;left:-15%;pointer-events:none}
        .gold-line{height:4px;background:linear-gradient(90deg,transparent,#f472b6,transparent);margin:12px 0}
        .header-title{font-family:'Amiri',serif;font-size:1.3rem;color:#f472b6;margin:0;font-weight:700}
        .sub-title{font-size:0.78rem;color:#a3b8cc;margin:2px 0 15px 0}
        .avatar-zone{width:105px;height:105px;border-radius:50%;border:2px solid #f472b6;background:rgba(255,255,255,0.03);margin:0 auto 15px;display:flex;align-items:center;justify-content:center;font-size:3rem;box-shadow:0 0 15px rgba(244,114,182,0.1);overflow:hidden}
        .avatar-zone img{width:100%;height:100%;object-fit:cover}
        .name{font-size:1.35rem;font-weight:900;color:#fff;margin:10px 0 5px 0}
        .id-badge{background:linear-gradient(135deg,#f472b6,#ec4899);color:#020b07;display:inline-block;padding:5px 20px;border-radius:50px;font-weight:900;font-size:1rem;margin-bottom:15px;box-shadow:0 4px 10px rgba(244,114,182,0.2)}
        .info-box{text-align:right;background:rgba(0,0,0,0.3);padding:14px 18px;border-radius:16px;margin-top:18px;border:1px solid rgba(244,114,182,0.12);font-size:0.88rem}
        .info-box p{margin:6px 0;color:#cbd5e1;display:flex;justify-content:space-between}
        .info-box strong{color:#f472b6}
        .footer-text{font-size:0.68rem;color:rgba(255,255,255,0.35);margin-top:18px;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px}
      </style></head><body>
      <div class="card">
        <div class="header-title">جامعة القرآن الكريم والعلوم الإسلامية</div><div class="sub-title">فرع غيل باوزير - حضرموت</div><div class="gold-line"></div>
        <div class="avatar-zone">${teacher.photo ? `<img src="${teacher.photo}" alt="صورة المعلم" />` : '👨‍🏫'}</div>
        <div class="name">${teacher.full_name}</div><div class="id-badge">رقم وظيفي: ${teacher.teacher_id}</div>
        <div class="info-box">
          <p><span><strong>🏛️ الكلية:</strong></span><span>${teacher.college_name || '—'}</span></p>
          <p><span><strong>📂 القسم:</strong></span><span>${teacher.department_name || '—'}</span></p>
          <p><span><strong>📜 التخصص:</strong></span><span>${teacher.speciality || '—'}</span></p>
          <p><span><strong>📱 الهاتف:</strong></span><span>${teacher.phone || '—'}</span></p>
          <p><span><strong>📧 البريد:</strong></span><span style="direction:ltr">${teacher.email || '—'}</span></p>
        </div>
        <div class="footer-text">بطاقة عضو هيئة تدريس - نظام الحضور الذكي</div>
      </div>
      <script>setTimeout(()=>{window.print()},500);</script>
      </body></html>`);
  };

  const filteredTeachers = teachers.filter(t =>
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.teacher_id?.includes(searchTerm) ||
    t.speciality?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.college_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
  const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 15 } } };

  return (
    <div className="teachers-module" style={{ padding: '5px 0' }}>
      {!dbReady && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#f472b6' }}>⏳ جاري تهيئة قاعدة البيانات ومستشعرات البصمة للأكاديميين...</div>
      )}

      {dbReady && (
        <>
          {/* 🧭 شريط التبويبات الفاخر */}
          <div className="tabs" style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '30px' }}>
            {[
              { id: 'manage', label: '👨‍🏫 إدارة المعلمين' },
              { id: 'live', label: '🖐️ بوابة البصمة المباشرة' },
              { id: 'today', label: '📋 بيان التحضير اليومي', action: loadTodayAttendance },
              { id: 'monthly', label: '📊 التقارير الأكاديمية التراكمية', action: loadMonthlyReports }
            ].map(t => (
              <motion.button
                key={t.id}
                className={`tab-btn ${tab === t.id ? 'active' : ''}`}
                onClick={async () => { setTab(t.id); if(t.action) await t.action(); setAttendanceStatus(null); }}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                  background: tab === t.id ? 'linear-gradient(135deg, #f472b6, #ec4899)' : 'rgba(255,255,255,0.03)',
                  color: tab === t.id ? '#041d14' : 'rgba(255,255,255,0.6)',
                  border: tab === t.id ? '1px solid #f472b644' : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: tab === t.id ? '0 8px 20px rgba(244,114,182,0.15)' : 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                {t.label}
              </motion.button>
            ))}
          </div>

          {/* 🟢 التبويب الأول: إدارة شؤون المعلمين وقيدهم */}
          {tab === 'manage' && (
            <>
              {/* 🏛️ إحصائيات سريعة */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                {[
                  { label: 'إجمالي الأكاديميين', count: stats.total, color: '#f472b6', icon: '👨‍🏫' },
                  { label: 'المدرسين النشطين', count: stats.active, color: '#34d399', icon: '✅' },
                  { label: 'حضور اليوم', count: stats.presentToday, color: '#38bdf8', icon: '⏱️' },
                  { label: 'غياب اليوم', count: stats.absentToday, color: '#ef4444', icon: '❌' }
                ].map((s, i) => (
                  <motion.div key={i} whileHover={{ y: -4 }}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(0,0,0,0.2))', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '18px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '2rem' }}>{s.icon}</span>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{s.label}</span>
                      <h3 style={{ fontSize: '1.8rem', color: s.color, margin: 0, fontWeight: 900 }}>{s.count}</h3>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* 🛠️ شريط الأدوات */}
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                  <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.7rem', color: '#f472b6', margin: 0 }}>👨‍🏫 إدارة الكادر الأكاديمي والتدريسي</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>إدارة بيانات وسجلات ومؤهلات المدرسين بالجامعة</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                    <button onClick={() => setViewMode('grid')} style={{ background: viewMode === 'grid' ? '#f472b6' : 'transparent', color: viewMode === 'grid' ? '#052218' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>🎴 كروت</button>
                    <button onClick={() => setViewMode('table')} style={{ background: viewMode === 'table' ? '#f472b6' : 'transparent', color: viewMode === 'table' ? '#052218' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>📋 جدول</button>
                  </div>
                  <input type="text" placeholder="🔍 بحث بالاسم والتخصص..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '220px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '10px 16px', borderRadius: '12px', color: '#fff' }} />
                  <motion.button onClick={() => { resetForm(); loadColleges(); setShowForm(true); }} whileHover={{ scale: 1.03 }}
                    style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 15px rgba(244,114,182,0.3)' }}>
                    ➕ قيد معلم
                  </motion.button>
                </div>
              </div>

              {/* كروت المعلمين */}
              {viewMode === 'grid' ? (
                <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
                  {filteredTeachers.map(teacher => (
                    <motion.div variants={itemVariants} key={teacher.id} whileHover={{ y: -6 }}
                      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,255,255,0.03))', backdropFilter: 'blur(10px)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '20px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div style={{ width: '70px', height: '70px', borderRadius: '50%', border: '2px solid #f472b6', background: 'rgba(244,114,182,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', overflow: 'hidden', flexShrink: 0 }}>
                          {teacher.photo ? <img src={teacher.photo} alt={teacher.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👨‍🏫'}
                        </div>
                        <div>
                          <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', display: 'block' }}>{teacher.full_name}</span>
                          <span style={{ color: '#f472b6', fontWeight: 700, fontSize: '0.85rem' }}>🆔 {teacher.teacher_id}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{teacher.speciality || 'بدون تخصص'}</span>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>🏛️ الكلية:</span><span style={{ color: 'var(--gold-light)' }}>{teacher.college_name || '—'}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>📂 القسم:</span><span style={{ color: '#fff' }}>{teacher.department_name || '—'}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>📱 الهاتف:</span><span style={{ color: '#cbd5e1' }}>{teacher.phone || '—'}</span></div>
                        {teacher.qualifications && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>🎓 المؤهلات:</span><span style={{ color: '#38bdf8' }}>{teacher.qualifications}</span></div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <motion.button onClick={() => printTeacherCard(teacher)} whileTap={{ scale: 0.95 }}
                          style={{ flex: 1, background: 'rgba(244,114,182,0.08)', color: '#f472b6', border: '1px solid rgba(244,114,182,0.2)', padding: '8px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>🖨️ بطاقة</motion.button>
                        <button className="btn-edit" onClick={() => handleEdit(teacher)} style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', cursor: 'pointer', fontWeight: 600 }}>✏️</button>
                        <button className="btn-delete" onClick={() => handleDelete(teacher.id)} style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', fontWeight: 600 }}>🗑️</button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
                  <table>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}>
                        <th>#</th><th>صورة</th><th>الرقم الوظيفي</th><th>الاسم</th><th>الكلية</th><th>القسم</th><th>التخصص</th><th>الهاتف</th><th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeachers.map((t, i) => (
                        <tr key={t.id}>
                          <td><strong>{i + 1}</strong></td>
                          <td>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(244,114,182,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {t.photo ? <img src={t.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👨‍🏫'}
                            </div>
                          </td>
                          <td style={{ color: '#f472b6', fontWeight: 700 }}>{t.teacher_id}</td>
                          <td style={{ color: '#fff', fontWeight: 600 }}>{t.full_name}</td>
                          <td style={{ color: 'var(--gold-light)' }}>{t.college_name || '—'}</td>
                          <td>{t.department_name || '—'}</td>
                          <td>{t.speciality || '—'}</td>
                          <td style={{ color: '#cbd5e1' }}>{t.phone || '—'}</td>
                          <td>
                            <button className="btn-edit" onClick={() => handleEdit(t)}>✏️</button>
                            <button className="btn-delete" onClick={() => handleDelete(t.id)}>🗑️</button>
                            <button onClick={() => printTeacherCard(t)} style={{ color: '#f472b6', background: 'none', border: 'none', cursor: 'pointer', marginRight: '5px' }}>🖨️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* 🖐️ التبويب الثاني: مسح البصمة المباشر وربط المدخلات (طلب الأستاذ سعيد) */}
          {tab === 'live' && (
            <div className="live-teachers-attendance">
              <div className="live-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
                <div>
                  <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.7rem', color: '#f472b6', margin: 0 }}>🖐️ بوابة رصد البصمة البيومترية للأكاديميين</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', margin: '5px 0 0 0', fontSize: '0.88rem' }}>انقر فوق كرت الأستاذ لتفعيل محاكاة مسح البصمة لتوثيق تفاصيل الدرس المنجز</p>
                </div>
                <input
                  type="text"
                  placeholder="🔍 ابحث بالاسم أو الرقم الوظيفي للمطابقة..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', maxWidth: '360px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 18px', borderRadius: '14px', color: '#fff' }}
                />
              </div>

              {/* إشعار بنجاح أو فشل الرصد المباشر */}
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
                      <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{attendanceStatus.teacher}</h4>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                        سجل التوقيع: <strong style={{ color: '#f472b6' }}>{attendanceStatus.time}</strong> | النتيجة الأكاديمية: <span style={{ color: attendanceStatus.color, fontWeight: 'bold' }}>{attendanceStatus.status}</span>
                      </p>
                    </div>
                    <button onClick={() => setAttendanceStatus(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.5 }}>✕</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* كروت حضور الأكاديميين المباشر */}
              <motion.div className="students-grid" variants={containerVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {teachers
                  .filter(t => t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || t.teacher_id?.includes(searchTerm))
                  .map(teacher => {
                    const todayRecord = todayAttendance.find(a => a.teacher_id === teacher.id);
                    const isPresent = todayRecord?.status === 'present';
                    const isAbsent = todayRecord?.status === 'absent';
                    const isScanning = scanningId === teacher.id;

                    let borderStyle = '1px solid rgba(255,255,255,0.05)';
                    let glowEffect = 'none';
                    if (isPresent) { borderStyle = '1px solid #34d399'; glowEffect = '0 5px 15px rgba(52,211,153,0.1)'; }
                    if (isAbsent) { borderStyle = '1px solid #ef4444'; glowEffect = '0 5px 15px rgba(239,68,68,0.1)'; }
                    if (isScanning) { borderStyle = '1px solid #f472b6'; glowEffect = '0 0 25px rgba(244,114,182,0.4)'; }

                    return (
                      <motion.div
                        key={teacher.id}
                        variants={cardVariants => cardVariants}
                        whileHover={{ y: isScanning ? 0 : -4 }}
                        style={{
                          background: 'rgba(255,255,255,0.01)',
                          backdropFilter: 'blur(10px)', border: borderStyle, borderRadius: '20px', padding: '20px',
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: glowEffect,
                          position: 'relative', overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                          <div style={{ width: '65px', height: '65px', borderRadius: '50%', border: '2px solid #f472b6', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', overflow: 'hidden', flexShrink: 0 }}>
                            {teacher.photo ? (
                              <img src={teacher.photo} alt={teacher.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              '👨‍🏫'
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>{teacher.full_name}</span>
                            <span style={{ color: '#f472b6', fontSize: '0.85rem', fontWeight: 600 }}>🔢 وظيفي: {teacher.teacher_id}</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>🎓 {teacher.speciality || 'أكاديمي'}</span>
                          </div>
                        </div>

                        {/* معلومات الدرس المحضّر مسبقاً اليوم إن وجدت */}
                        {isPresent && todayRecord && (
                          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '10px', fontSize: '0.8rem', marginBottom: '10px', border: '1px dashed rgba(52,211,153,0.2)' }}>
                            <div style={{ color: '#34d399', fontWeight: 700 }}>📖 الدرس: {todayRecord.lesson_title}</div>
                            <div style={{ color: '#38bdf8', marginTop: '3px' }}>📈 نسبة الإنجاز: {todayRecord.completion_rate}%</div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '5px' }}>
                          {!isPresent && !isAbsent ? (
                            <>
                              <motion.button
                                onClick={() => initiateAttendance(teacher)}
                                disabled={scanningId !== null}
                                whileTap={{ scale: 0.95 }}
                                style={{ flex: 2, background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#041d14', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                {isScanning ? '📶 جاري قراءة النبض الأكاديمي...' : '🖐️ مسح البصمة والتحضير'}
                              </motion.button>
                              <button
                                onClick={() => markAbsent(teacher)}
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
                                background: isPresent ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                color: isPresent ? '#34d399' : '#ef4444',
                                border: `1px solid ${isPresent ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`
                              }}>
                                {isPresent ? '✅ حاضر بالمنصة' : '❌ غياب معتمد'}
                              </span>
                              <button 
                                onClick={async () => {
                                  if(window.confirm("هل ترغب في إعادة فتح بوابة التحضير للأستاذ؟")) {
                                    await resetAttendance(teacher.id);
                                  }
                                }} 
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                🔄 إعادة رصد
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

          {/* 📋 التبويب الثالث: كشف بيان التحضير اليومي مع الساعات (طلب الأستاذ سعيد) */}
          {tab === 'today' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: '#f472b6', margin: 0 }}>📋 كشف الحضور والانصراف للأكاديميين اليوم ({today})</h3>
              </div>

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الاسم</th>
                      <th>الرقم الوظيفي</th>
                      <th>توقيت الحضور</th>
                      <th>توقيت الانصراف</th>
                      <th>📖 الدرس الملقى</th>
                      <th>📈 نسبة إنجاز المنهج</th>
                      <th>⏱️ الساعات المستحقة</th>
                      <th>الحالة</th>
                      <th>تحكم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAttendance.map((a, i) => (
                      <tr key={a.id}>
                        <td><strong>{i + 1}</strong></td>
                        <td style={{ color: '#fff', fontWeight: 600 }}>{a.full_name}</td>
                        <td style={{ color: '#f472b6', fontWeight: 700 }}>{a.doc_id}</td>
                        <td style={{ color: '#34d399', fontWeight: 700 }}>⏱️ {a.time_in || '—'}</td>
                        <td style={{ color: '#f472b6', fontWeight: 700 }}>🚪 {a.time_out || '—'}</td>
                        <td style={{ color: '#cbd5e1', fontStyle: 'italic' }}>{a.lesson_title || '—'}</td>
                        <td>
                          {a.completion_rate ? (
                            <span style={{ padding: '3px 8px', borderRadius: '8px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', fontWeight: 'bold' }}>
                              {a.completion_rate}%
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ color: '#fbbf24', fontWeight: 800 }}>
                          {a.total_hours !== null ? `${a.total_hours} ساعة` : 'قيد الاحتساب'}
                        </td>
                        <td>
                          <span style={{
                            padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 700,
                            background: a.status === 'present' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                            color: a.status === 'present' ? '#34d399' : '#ef4444'
                          }}>
                            {a.status === 'present' ? 'حاضر معتمد' : 'غائب'}
                          </span>
                        </td>
                        <td>
                          {!a.time_out && a.status !== 'absent' ? (
                            <motion.button onClick={() => markExit(a)} whileHover={{ scale: 1.05 }}
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #f472b6', color: '#f472b6', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                              🚪 إثبات انصراف وساعات
                            </motion.button>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>🔒 مغلق ومحسوب</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {todayAttendance.length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>🚫 لم يتم تسجيل حضور أي مدرس اليوم بعد.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* 📊 التبويب الرابع: مصفوفة التقارير الشهرية ومستحقات الساعات (الأستاذ سعيد) */}
          {tab === 'monthly' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="monthly-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: '#f472b6', margin: 0 }}>📊 تقرير كشوفات الأداء والساعات التراكمية لشهر ({selectedMonth})</h3>
                  <p style={{ color: 'rgba(255,255,255,0.4)', margin: '5px 0 0 0', fontSize: '0.88rem' }}>محسوب بدقة للأستاذ سعيد لمراقبة كشوفات الحضور ومستحقات المحاضرين المالية والأكاديمية</p>
                </div>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  style={{ background: '#041d14', border: '1px solid #f472b6', padding: '10px 15px', borderRadius: '12px', color: '#fff', fontWeight: 700, outline: 'none' }} />
              </div>

              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الاسم</th>
                      <th>الرقم الوظيفي</th>
                      <th>التخصص</th>
                      <th>📅 أيام الحضور</th>
                      <th>❌ أيام الغياب</th>
                      <th>⏱️ إجمالي الساعات المنفذة</th>
                      <th>📖 آخر عنوان درس تم تقديمه</th>
                      <th>📈 آخر نسبة إنجاز للمقرر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReports.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{i + 1}</strong></td>
                        <td style={{ color: '#fff', fontWeight: 600 }}>{r.full_name}</td>
                        <td style={{ color: '#f472b6', fontWeight: 700 }}>{r.doc_id}</td>
                        <td>{r.speciality || '—'}</td>
                        <td style={{ color: '#34d399', fontWeight: 700 }}>{r.days_present} محاضرة</td>
                        <td style={{ color: '#ef4444', fontWeight: 700 }}>{r.days_absent} يوم</td>
                        <td style={{ color: '#fbbf24', fontWeight: 900, fontSize: '1.05rem' }}>⏱️ {r.total_hours.toFixed(2)} ساعة</td>
                        <td style={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>{r.last_lesson}</td>
                        <td>
                          <span style={{
                            padding: '4px 12px', borderRadius: '50px', fontSize: '0.85rem', fontWeight: 800,
                            background: r.last_completion_rate >= 80 ? 'rgba(52,211,153,0.1)' : 'rgba(56,189,248,0.1)',
                            color: r.last_completion_rate >= 80 ? '#34d399' : '#38bdf8'
                          }}>
                            {r.last_completion_rate}% من المقرّر
                          </span>
                        </td>
                      </tr>
                    ))}
                    {monthlyReports.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>📭 لا توجد بيانات مسجلة لهذا الشهر للمدرسين.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* 📖 نافذة إدخال الدرس لتوثيق التحضير (طلب الأستاذ سعيد المباشر) */}
      <AnimatePresence>
        {showLessonModal && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(2, 11, 7, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyY: 'center', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ background: 'linear-gradient(135deg, #052218, #0a3a29)', border: '2px solid #f472b6', padding: '25px', borderRadius: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}>
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.4rem', color: '#f472b6', margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                📖 توثيق الدرس للمحاضر (للأستاذ سعيد)
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '15px' }}>
                يرجى تسجيل المحتوى العلمي المعطى اليوم لحفظ نسبة إنجاز مقرر الأستاذ/ة: <strong style={{ color: '#fff' }}>{selectedTeacherForAttendance?.full_name}</strong>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', display: 'block', marginBottom: '5px' }}>📖 عنوان الدرس الملقى اليوم</label>
                  <input
                    type="text"
                    value={lessonForm.lesson_title}
                    onChange={e => setLessonForm({ ...lessonForm, lesson_title: e.target.value })}
                    placeholder="مثال: مقدمة في المحاسبة الحكومية"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(244,114,182,0.3)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', display: 'block', marginBottom: '5px' }}>📈 نسبة الإنجاز في المقرر الإجمالية ({lessonForm.completion_rate}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={lessonForm.completion_rate}
                    onChange={e => setLessonForm({ ...lessonForm, completion_rate: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: '#f472b6', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button onClick={submitAttendance} style={{ background: '#f472b6', color: '#000', padding: '10px 20px', borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>💾 تأكيد الحضور وبدء البصمة</button>
                <button onClick={() => setShowLessonModal(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '10px 15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>إلغاء</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🪟 نافذة نموذج قيد / تعديل بيانات المعلمين الأساسية */}
      <AnimatePresence>
        {showForm && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(2, 11, 7, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }} transition={{ type: 'spring', stiffness: 140, damping: 18 }}
              style={{ background: 'linear-gradient(135deg, rgba(5,34,24,0.98), rgba(10,58,41,0.98))', border: '1px solid #f472b6', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
              
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: '#f472b6', marginBottom: '22px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginTop: 0 }}>
                {editId ? '📝 تحرير بيانات المعلم الأكاديمية' : '➕ قيد معلم أكاديمي جديد'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* صورة المعلم */}
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: '2px solid #f472b6', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', fontSize: '2.5rem' }}>
                    {formData.photo ? <img src={formData.photo} alt="معاينة" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👨‍🏫'}
                  </div>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  <button type="button" onClick={() => photoInputRef.current?.click()} style={{ background: 'rgba(244,114,182,0.1)', color: '#f472b6', border: '1px solid #f472b6', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    📷 {formData.photo ? 'تغيير الصورة' : 'رفع صورة'}
                  </button>
                  {formData.photo && <button type="button" onClick={() => setFormData({ ...formData, photo: '' })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', marginTop: '5px' }}>🗑️ حذف</button>}
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>🆔 الرقم الوظيفي</label>
                    <input type="text" className="glass-input" value={formData.teacher_id} onChange={e => setFormData({ ...formData, teacher_id: e.target.value })} placeholder="مثال: T2026001" style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>👤 الاسم الرباعي</label>
                    <input type="text" className="glass-input" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="الاسم الكامل" style={{ width: '100%' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>📱 رقم الهاتف</label>
                    <input type="text" className="glass-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="777000000" style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>📧 البريد الإلكتروني</label>
                    <input type="email" className="glass-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="teacher@university.edu" style={{ width: '100%', direction: 'ltr', textAlign: 'left' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>🏛️ الكلية</label>
                    <select className="glass-input" value={formData.college_id} onChange={e => handleCollegeChange(e.target.value)} style={{ width: '100%', background: '#052218' }}>
                      <option value="">-- حدد الكلية --</option>
                      {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>📂 القسم</label>
                    <select className="glass-input" value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} style={{ width: '100%', background: '#052218' }}>
                      <option value="">-- حدد القسم --</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>📜 التخصص الدقيق</label>
                    <input type="text" className="glass-input" value={formData.speciality} onChange={e => setFormData({ ...formData, speciality: e.target.value })} placeholder="مثال: المحاسبة المالية" style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>🎓 المؤهلات العلمية</label>
                    <input type="text" className="glass-input" value={formData.qualifications} onChange={e => setFormData({ ...formData, qualifications: e.target.value })} placeholder="مثال: دكتوراه في..." style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <motion.button onClick={handleSave} whileHover={{ scale: 1.02, boxShadow: '0 0 15px rgba(244,114,182,0.3)' }} whileTap={{ scale: 0.98 }}
                  style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.95rem' }}>💾 حفظ</motion.button>
                <button onClick={resetForm} style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>إلغاء</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Teachers;
