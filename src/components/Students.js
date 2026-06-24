// src/components/Students.js – إدارة شؤون الطلاب والكليات (Supabase Direct API)
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

// ========== اتصال Supabase المباشر ==========
const supabase = createClient(
  'https://dboornlxohzwltylqceu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRib29ybmx4b2h6d2x0eWxxY2V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI2MjA3MiwiZXhwIjoyMDk3ODM4MDcyfQ.lqqPioK_vWqJlfUnxDcmhBZqksKONIyuWA8dgDNwu1w'
);

function Students() {
  const [tab, setTab] = useState('students');
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [majors, setMajors] = useState([]);
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const initialFormState = {
    name: '',
    college_id: '',
    department_id: '',
    major_id: '',
    university_id: '',
    full_name: '',
    phone: '',
    parent_phone: '',
    national_id: '',
    level: '',
    group_name: '',
    fees: '',
    duration: '4 سنوات'
  };

  const [formData, setFormData] = useState(initialFormState);

  // ========== تحميل البيانات من Supabase مباشرة ==========
  const loadColleges = useCallback(async () => {
    const { data, error } = await supabase
      .from('colleges')
      .select('*')
      .eq('status', 'active')
      .order('name');
    if (!error) setColleges(data || []);
  }, []);

  const loadDepartments = useCallback(async (collegeId = null) => {
    if (collegeId) {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('college_id', collegeId)
        .eq('status', 'active')
        .order('name');
      setDepartments(data || []);
    } else {
      const { data } = await supabase
        .from('departments')
        .select('*, colleges!inner(name)')
        .eq('status', 'active')
        .order('name');
      const mapped = (data || []).map(d => ({
        ...d,
        college_name: d.colleges?.name || null
      }));
      setDepartments(mapped);
    }
  }, []);

  const loadMajors = useCallback(async (deptId = null) => {
    if (deptId) {
      const { data } = await supabase
        .from('majors')
        .select('*')
        .eq('department_id', deptId)
        .eq('status', 'active')
        .order('name');
      setMajors(data || []);
    } else {
      const { data } = await supabase
        .from('majors')
        .select('*, departments!inner(name, colleges!inner(name))')
        .eq('status', 'active')
        .order('name');
      const mapped = (data || []).map(m => ({
        ...m,
        department_name: m.departments?.name || null,
        college_name: m.departments?.colleges?.name || null
      }));
      setMajors(mapped);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    // جلب الطلاب مع التخصصات والكليات
    const { data: studentsData, error } = await supabase
      .from('students')
      .select('*, majors!inner(name, departments!inner(name, colleges!inner(name)))')
      .eq('status', 'active')
      .order('full_name');

    if (error || !studentsData) {
      setStudents([]);
      return;
    }

    // جلب إحصائيات الغياب لكل طالب
    const studentIds = studentsData.map(s => s.id);
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('student_id, status')
      .in('student_id', studentIds);

    // تجميع الغياب يدوياً بJavaScript
    const absenceMap = {};
    const totalMap = {};
    (attendanceData || []).forEach(a => {
      totalMap[a.student_id] = (totalMap[a.student_id] || 0) + 1;
      if (a.status === 'absent') {
        absenceMap[a.student_id] = (absenceMap[a.student_id] || 0) + 1;
      }
    });

    const mapped = studentsData.map(s => ({
      id: s.id,
      university_id: s.university_id,
      full_name: s.full_name,
      phone: s.phone,
      parent_phone: s.parent_phone,
      national_id: s.national_id,
      level: s.level,
      group_name: s.group_name,
      major_id: s.major_id,
      major_name: s.majors?.name || null,
      department_name: s.majors?.departments?.name || null,
      college_name: s.majors?.departments?.colleges?.name || null,
      absence_rate: totalMap[s.id]
        ? Math.round((absenceMap[s.id] || 0) / totalMap[s.id] * 100 * 10) / 10
        : 0
    }));

    setStudents(mapped);
  }, []);

  useEffect(() => {
    loadColleges();
    loadDepartments();
    loadMajors();
    loadStudents();
  }, [loadColleges, loadDepartments, loadMajors, loadStudents]);

  const resetForm = () => {
    setFormData(initialFormState);
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (tab === 'colleges' && !formData.name.trim()) return alert("يرجى إدخال اسم الكلية");
    if (tab === 'departments' && (!formData.name.trim() || !formData.college_id)) return alert("يرجى إكمال بيانات القسم والكلية");
    if (tab === 'majors' && (!formData.name.trim() || !formData.department_id)) return alert("يرجى إكمال بيانات التخصص والقسم");
    if (tab === 'students' && (!formData.full_name.trim() || !formData.university_id || !formData.major_id)) return alert("يرجى إكمال حقول الطالب الأساسية");

    if (tab === 'colleges') {
      if (editId) {
        await supabase.from('colleges').update({ name: formData.name }).eq('id', editId);
      } else {
        await supabase.from('colleges').insert([{ name: formData.name, status: 'active' }]);
      }
      loadColleges();
    }

    if (tab === 'departments') {
      if (editId) {
        await supabase.from('departments').update({ name: formData.name, college_id: formData.college_id }).eq('id', editId);
      } else {
        await supabase.from('departments').insert([{ name: formData.name, college_id: formData.college_id, status: 'active' }]);
      }
      loadDepartments();
    }

    if (tab === 'majors') {
      if (editId) {
        await supabase.from('majors').update({
          name: formData.name, department_id: formData.department_id,
          fees: formData.fees, duration: formData.duration
        }).eq('id', editId);
      } else {
        await supabase.from('majors').insert([{
          name: formData.name, department_id: formData.department_id,
          fees: formData.fees, duration: formData.duration, status: 'active'
        }]);
      }
      loadMajors();
    }

    if (tab === 'students') {
      const studentRow = {
        university_id: formData.university_id,
        full_name: formData.full_name,
        phone: formData.phone,
        parent_phone: formData.parent_phone,
        national_id: formData.national_id,
        major_id: formData.major_id,
        level: formData.level,
        group_name: formData.group_name,
        status: 'active'
      };

      if (editId) {
        await supabase.from('students').update(studentRow).eq('id', editId);
      } else {
        await supabase.from('students').insert([studentRow]);
      }
      loadStudents();
    }
    resetForm();
  };

  const handleDelete = async (id) => {
    if (window.confirm("🏛️ هل أنت متأكد من رغبتك في أرشفة هذا السجل ضمن الأرشيف الجامعي الآمن؟")) {
      const table = tab === 'colleges' ? 'colleges' : tab === 'departments' ? 'departments' : tab === 'majors' ? 'majors' : 'students';
      await supabase.from(table).update({ status: 'inactive' }).eq('id', id);
      if (tab === 'colleges') { loadColleges(); loadDepartments(); loadMajors(); loadStudents(); }
      if (tab === 'departments') { loadDepartments(); loadMajors(); loadStudents(); }
      if (tab === 'majors') { loadMajors(); loadStudents(); }
      if (tab === 'students') { loadStudents(); }
    }
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    if (tab === 'colleges') setFormData({ ...initialFormState, name: item.name });
    if (tab === 'departments') setFormData({ ...initialFormState, name: item.name, college_id: item.college_id });
    if (tab === 'majors') setFormData({ ...initialFormState, name: item.name, department_id: item.department_id, fees: item.fees, duration: item.duration });
    if (tab === 'students') setFormData({
      ...initialFormState,
      university_id: item.university_id || '',
      full_name: item.full_name || '',
      phone: item.phone || '',
      parent_phone: item.parent_phone || '',
      national_id: item.national_id || '',
      major_id: item.major_id || '',
      level: item.level || '',
      group_name: item.group_name || ''
    });
    setShowForm(true);
  };

  const printCard = (student) => {
    const cardWindow = window.open('', 'بطاقة الهوية الأكاديمية', 'width=480,height=700');
    cardWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>البطاقة الجامعية الذكية - فرع غيل باوزير</title>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&family=Amiri:wght@700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Tajawal', sans-serif; background: #020b07; color: #fff; text-align: center; padding: 0; margin: 0; display:flex; align-items:center; justify-content:center; height:100vh; }
            .card { 
              border: 2px dashed #D4AF37; border-radius: 24px; padding: 30px; width: 350px; margin: 0 auto;
              background: linear-gradient(135deg, #052218, #0a3a29); position: relative; overflow: hidden;
              box-shadow: 0 20px 40px rgba(0,0,0,0.8); box-sizing: border-box;
            }
            .card::before { content: "🏛️"; position: absolute; font-size: 16rem; opacity: 0.03; top: 15%; left: -15%; pointer-events: none; }
            .gold-line { height: 4px; background: linear-gradient(90deg, transparent, #D4AF37, transparent); margin: 12px 0; }
            .header-title { font-family: 'Amiri', serif; font-size: 1.3rem; color: #D4AF37; margin: 0; font-weight:700; }
            .sub-title { font-size: 0.78rem; color: #a3b8cc; margin: 2px 0 15px 0; letter-spacing: 0.5px; }
            .avatar-zone { width: 105px; height: 105px; border-radius: 50%; border: 2px solid #D4AF37; background: rgba(255,255,255,0.03); margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; font-size: 3rem; box-shadow: 0 0 15px rgba(214,175,55,0.1); }
            .name { font-size: 1.35rem; font-weight: 900; color: #fff; margin: 10px 0 5px 0; letter-spacing: -0.3px; }
            .id-badge { background: linear-gradient(135deg, #D4AF37, #b89324); color: #020b07; display: inline-block; padding: 5px 20px; border-radius: 50px; font-weight: 900; font-size: 1rem; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(214,175,55,0.2); }
            .qr-container { background: white; padding: 12px; display: inline-block; border-radius: 18px; margin: 5px 0; box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
            .info-box { text-align: right; background: rgba(0,0,0,0.3); padding: 14px 18px; border-radius: 16px; margin-top: 18px; border: 1px solid rgba(212,175,55,0.12); font-size: 0.88rem; }
            .info-box p { margin: 6px 0; color: #cbd5e1; display:flex; justify-content:space-between; }
            .info-box strong { color: #D4AF37; }
            .footer-text { font-size: 0.68rem; color: rgba(255,255,255,0.35); margin-top: 18px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; font-weight:400; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-title">جامعة القرآن الكريم والعلوم الإسلامية</div>
            <div class="sub-title">فرع غيل باوزير - حضرموت</div>
            <div class="gold-line"></div>
            <div class="avatar-zone">🎓</div>
            <div class="name">${student.full_name}</div>
            <div class="id-badge">ID: ${student.university_id}</div><br/>
            <div class="qr-container"><div id="qrcode"></div></div>
            <div class="info-box">
              <p><span><strong>🏛️ الكلية:</strong></span> <span>${student.college_name || 'العلوم الأكاديمية'}</span></p>
              <p><span><strong>📂 القسم:</strong></span> <span>${student.department_name || 'العام'}</span></p>
              <p><span><strong>📜 التخصص:</strong></span> <span>${student.major_name || 'غير محدد'}</span></p>
              <p><span><strong>📈 المستوى:</strong></span> <span>${student.level || 'الأول'} (شعبة ${student.group_name || 'أ'})</span></p>
            </div>
            <div class="footer-text">نظام الهوية الرقمية الموحد لبوابات الحضور الذكية</div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            new QRCode(document.getElementById("qrcode"), {
              text: "${student.university_id}", width: 115, height: 115,
              colorDark : "#020b07", colorLight : "#ffffff"
            });
            setTimeout(() => { window.print(); }, 500);
          </script>
        </body>
      </html>
    `);
  };

  const filteredStudents = students.filter(s =>
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.university_id?.includes(searchTerm) ||
    s.major_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 15 } }
  };

  // ========== واجهة المستخدم (نفسها تماماً، لم تتغير) ==========
  return (
    <div className="students-module" style={{ padding: '5px 0' }}>
      
      <div className="tabs" style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '20px', border: '1px solid var(--glass-border)', marginBottom: '30px', boxShadow: 'inset 0 0 15px rgba(255,255,255,0.01)' }}>
        {[
          { id: 'colleges', label: '🏫 هيكلة الكليات', load: loadColleges },
          { id: 'departments', label: '📂 الأقسام الأكاديمية', load: () => { loadColleges(); loadDepartments(); } },
          { id: 'majors', label: '🎓 مسارات التخصصات', load: () => { loadDepartments(); loadMajors(); } },
          { id: 'students', label: '👥 قاعدة بيانات الطلاب', load: () => { loadMajors(); loadStudents(); } }
        ].map(t => (
          <motion.button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); t.load(); resetForm(); }}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            style={{
              flex: 1, padding: '14px 10px', borderRadius: '14px', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
              background: tab === t.id ? 'linear-gradient(135deg, var(--gold-main), #b89324)' : 'transparent',
              color: tab === t.id ? '#052218' : 'var(--text-secondary)',
              border: tab === t.id ? '1px solid var(--gold-light)' : '1px solid transparent',
              boxShadow: tab === t.id ? '0 8px 20px rgba(214,175,55,0.15)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* 🏛️ الكليات */}
      {tab === 'colleges' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: 0 }}>🏫 الكليات المعتمدة بفرع غيل باوزير</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>إدارة الهيكل العام وتدشين الكليات الجامعية الرئيسية</p>
            </div>
            <motion.button onClick={() => { resetForm(); loadColleges(); setShowForm(true); }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.2)' }}>
              ➕ قيد كلية جديدة
            </motion.button>
          </div>
          <div className="data-table">
            <table>
              <thead>
                <tr><th>#</th><th>اسم الكلية الأكاديمية</th><th>حالة القيد المالي</th><th>إجراءات الضبط السيبراني</th></tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {colleges.map((c, i) => (
                  <motion.tr variants={itemVariants} key={c.id}>
                    <td><strong>{i + 1}</strong></td>
                    <td style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.98rem' }}>{c.name}</td>
                    <td><span style={{ color: 'var(--green-bright)', fontSize: '0.85rem' }}>● نشطة وموثقة</span></td>
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(c)}>✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(c.id)}>🗑️</button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 📂 الأقسام */}
      {tab === 'departments' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: 0 }}>📂 الأقسام والدوائر الأكاديمية العلمية</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>تقسيم الخطط التعليمية وربط الأقسام بالكليات المرجعية</p>
            </div>
            <motion.button onClick={() => { resetForm(); loadColleges(); setShowForm(true); }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.2)' }}>
              ➕ تدشين قسم أكاديمي
            </motion.button>
          </div>
          <div className="data-table">
            <table>
              <thead>
                <tr><th>#</th><th>اسم القسم العلمي</th><th>الكلية التابع لها</th><th>خيارات الضبط</th></tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {departments.map((d, i) => (
                  <motion.tr variants={itemVariants} key={d.id}>
                    <td><strong>{i + 1}</strong></td>
                    <td style={{ color: 'var(--white)', fontWeight: 600 }}>{d.name}</td>
                    <td style={{ color: d.college_name ? 'var(--gold-light)' : '#ef4444', fontWeight: 500 }}>
                      {d.college_name || '⚠️ لم يتم العثور على الكلية'}
                    </td>
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(d)}>✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(d.id)}>🗑️</button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 🎓 التخصصات */}
      {tab === 'majors' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <h3 style={{ fontFamily: 'Amiri', serif, fontSize: '1.6rem', color: 'var(--gold-light)', margin: 0 }}>🎓 مساقات الخطط الدراسية والتخصصات المتاحة</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>تحديد فترة الخطة الدراسية والرسوم السنوية لكل مسار فرعي</p>
            </div>
            <motion.button onClick={() => { resetForm(); loadDepartments(); setShowForm(true); }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.2)' }}>
              ➕ ربط تخصص خطة
            </motion.button>
          </div>
          <div className="data-table">
            <table>
              <thead>
                <tr><th>#</th><th>مساق التخصص الفرعي</th><th>القسم العلمي المرجعي</th><th>الكلية التابع لها</th><th>الرسوم المقيدة</th><th>فترة البقاء بالخطة</th><th>خيارات التحكم</th></tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {majors.map((m, i) => (
                  <motion.tr variants={itemVariants} key={m.id}>
                    <td><strong>{i + 1}</strong></td>
                    <td style={{ color: 'var(--white)', fontWeight: 600 }}>{m.name}</td>
                    <td>{m.department_name || '⚠️ بدون قسم'}</td>
                    <td style={{ color: 'var(--gold-light)' }}>{m.college_name || '⚠️ بدون كلية'}</td>
                    <td style={{ color: 'var(--gold-main)', fontWeight: 800 }}>{Number(m.fees || 0).toLocaleString('ar-YE')} ريال</td>
                    <td><span style={{ color: '#cbd5e1' }}>{m.duration}</span></td>
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(m)}>✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(m.id)}>🗑️</button>
                    </td>
                  </motion.tr>
                ))}
                {majors.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '25px', color: 'var(--text-secondary)' }}>📭 لا توجد مساقات خطط دراسية مضافة حالياً</td></tr>
                )}
              </motion.tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 👥 الطلاب */}
      {tab === 'students' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginBottom: '25px' }}>
            <div>
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.7rem', color: 'var(--gold-light)', margin: 0 }}>👥 وحدة قيد شؤون الطلاب والمسح البيومتري</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>مراقبة حية للمستويات الأكاديمية والربط الفوري لبصمات الوجه الرقمية</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flex: '1', justifyContent: 'flex-end', alignItems: 'center', minWidth: '300px' }}>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                <button onClick={() => setViewMode('grid')} style={{ background: viewMode === 'grid' ? 'var(--gold-main)' : 'transparent', color: viewMode === 'grid' ? '#052218' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>🎴 كروت ذكية</button>
                <button onClick={() => setViewMode('table')} style={{ background: viewMode === 'table' ? 'var(--gold-main)' : 'transparent', color: viewMode === 'table' ? '#052218' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>📋 جدول عادي</button>
              </div>
              <input type="text" placeholder="🔍 ابحث بالرقم الجامعي، الاسم، التخصص..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', maxWidth: '280px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '10px 16px', borderRadius: '12px', color: '#fff', fontSize: '0.9rem' }} />
              <motion.button onClick={() => { resetForm(); loadMajors(); setShowForm(true); }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 15px rgba(16,185,129,0.2)' }}>
                ➕ قيد طالب جديد
              </motion.button>
            </div>
          </div>

          {viewMode === 'grid' ? (
            <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {filteredStudents.map((s) => {
                let alertColor = 'var(--green-bright)';
                let alertLabel = 'حضور مستقر';
                if (s.absence_rate >= 25) { alertColor = '#ef4444'; alertLabel = 'حرمان حرج 🚨'; }
                else if (s.absence_rate > 12) { alertColor = '#f59e0b'; alertLabel = 'إنذار أول ⚠️'; }
                return (
                  <motion.div variants={itemVariants} key={s.id} whileHover={{ y: -6, boxShadow: '0 12px 30px rgba(0,0,0,0.4), 0 0 15px rgba(214,175,55,0.05)' }}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(255,255,255,0.03))', backdropFilter: 'blur(10px)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '20px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ background: `${alertColor}15`, color: alertColor, border: `1px solid ${alertColor}30`, padding: '3px 10px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 800 }}>{alertLabel} ({s.absence_rate}%)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div style={{ width: '65px', height: '65px', borderRadius: '50%', border: '2px solid var(--gold-main)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>🎓</div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--white)', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.3px', paddingLeft: '50px' }}>{s.full_name}</span>
                        <span style={{ color: 'var(--gold-light)', fontWeight: 700, fontSize: '0.85rem', marginTop: '2px' }}>ID: {s.university_id}</span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>🏛️ الكلية والأقسام:</span> <span style={{ color: 'var(--gold-light)', fontWeight: 600 }}>{s.college_name || '—'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>📜 المسار الدراسي:</span> <span style={{ color: '#fff', fontWeight: 600 }}>{s.major_name || 'عام'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>📈 الفوج والمستوى:</span> <span style={{ color: '#38bdf8', fontWeight: 600 }}>{s.level} (شعبة {s.group_name || 'أ'})</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>📱 جوال المزامنة:</span> <span style={{ color: '#cbd5e1' }}>{s.phone}</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                      <motion.button onClick={() => printCard(s)} whileTap={{ scale: 0.95 }} style={{ flex: 1, background: 'rgba(214,175,55,0.08)', color: 'var(--gold-main)', border: '1px solid rgba(214,175,55,0.2)', padding: '8px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>🖨️ الهوية الذكية</motion.button>
                      <button className="btn-edit" onClick={() => handleEdit(s)} style={{ margin: 0, padding: '8px 12px', borderRadius: '10px' }}>✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(s.id)} style={{ margin: 0, padding: '8px 12px', borderRadius: '10px' }}>🗑️</button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <div className="data-table">
              <table>
                <thead>
                  <tr><th>#</th><th>الرقم الجامعي</th><th>الاسم الرباعي الرسمي</th><th>الكلية المرجعية</th><th>تخصص المسار</th><th>المستوى الدراسي</th><th>نسبة الغياب</th><th>أوامر وإجراءات</th></tr>
                </thead>
                <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                  {filteredStudents.map((s, i) => (
                    <motion.tr variants={itemVariants} key={s.id}>
                      <td><strong>{i + 1}</strong></td>
                      <td style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{s.university_id}</td>
                      <td style={{ color: 'var(--white)', fontWeight: 600 }}>{s.full_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.college_name || '—'}</td>
                      <td>{s.major_name}</td>
                      <td><span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '3px 10px', borderRadius: '50px', fontSize: '0.82rem' }}>{s.level}</span></td>
                      <td style={{ fontWeight: 700, color: s.absence_rate >= 25 ? '#ef4444' : s.absence_rate > 12 ? '#f59e0b' : 'var(--green-bright)' }}>{s.absence_rate}%</td>
                      <td>
                        <button className="btn-edit" onClick={() => handleEdit(s)}>✏️</button>
                        <button className="btn-delete" onClick={() => handleDelete(s.id)}>🗑️</button>
                        <button className="btn-print" onClick={() => printCard(s)} style={{ color: 'var(--gold-main)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}>🖨️ طباعة</button>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* 🪟 النافذة المنبثقة */}
      <AnimatePresence>
        {showForm && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(2, 11, 7, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
            <motion.div className="form-card-modal" initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }} transition={{ type: 'spring', stiffness: 140, damping: 18 }} style={{ background: 'linear-gradient(135deg, rgba(5,34,24,0.98), rgba(10,58,41,0.98))', border: '1px solid var(--gold-main)', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: tab === 'students' ? '720px' : '460px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', position: 'relative' }}>
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-main)', marginBottom: '22px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginTop: 0 }}>
                {editId ? '📝 تحرير وثيقة السجل المعتمد' : '➕ قيد سجل إداري جديد مصفوفة'}
              </h3>

              {tab === 'colleges' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>اسم الكلية بالكامل</label>
                  <input type="text" className="glass-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: كلية الشريعة والقانون" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '1rem' }} />
                </div>
              )}

              {tab === 'departments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>الكلية الأكاديمية الحاضنة</label>
                  <select className="glass-input" value={formData.college_id} onChange={e => setFormData({ ...formData, college_id: e.target.value })} style={{ background: '#052218', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '1rem' }}>
                    <option value="">-- حدد الكلية المرجعية --</option>
                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>اسم القسم العلمي</label>
                  <input type="text" className="glass-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: قسم علوم القرآن" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                </div>
              )}

              {tab === 'majors' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>القسم العلمي التابع له المسار</label>
                  <select className="glass-input" value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} style={{ background: '#052218', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '1rem' }}>
                    <option value="">-- حدد القسم التخصصي --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.college_name || 'بدون كلية'})</option>)}
                  </select>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>اسم مسار التخصص الفرعي</label>
                  <input type="text" className="glass-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: تخصص التفسير" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>الرسوم السنوية (ريال)</label>
                      <input type="number" className="glass-input" value={formData.fees} onChange={e => setFormData({ ...formData, fees: e.target.value })} placeholder="مثال: 50000" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>فترة الخطة الأكاديمية</label>
                      <input type="text" className="glass-input" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                  </div>
                </div>
              )}

              {tab === 'students' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>🔢 الرقم الجامعي</label>
                      <input type="text" className="glass-input" value={formData.university_id} onChange={e => setFormData({ ...formData, university_id: e.target.value })} placeholder="مثال: 20260401" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '0.95rem', fontWeight: 600 }} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>👤 الاسم الرباعي</label>
                      <input type="text" className="glass-input" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="الاسم الكامل" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '0.95rem' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>📱 هاتف التواصل</label>
                      <input type="text" className="glass-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="777000000" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>💬 هاتف ولي الأمر</label>
                      <input type="text" className="glass-input" value={formData.parent_phone} onChange={e => setFormData({ ...formData, parent_phone: e.target.value })} placeholder="إشعار أولياء الأمور" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>🪪 رقم الهوية الوطنية</label>
                      <input type="text" className="glass-input" value={formData.national_id} onChange={e => setFormData({ ...formData, national_id: e.target.value })} placeholder="رقم البطاقة الشخصية" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>📜 مسار خطة القبول</label>
                      <select className="glass-input" value={formData.major_id} onChange={e => setFormData({ ...formData, major_id: e.target.value })} style={{ width: '100%', background: '#052218', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '0.95rem' }}>
                        <option value="">-- حدد المساق --</option>
                        {majors.map(m => <option key={m.id} value={m.id}>{m.name} ({m.department_name || 'بدون قسم'})</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>📈 الفوج / المستوى</label>
                      <input type="text" className="glass-input" value={formData.level} onChange={e => setFormData({ ...formData, level: e.target.value })} placeholder="مثال: المستوى الأول" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>🏫 الشعبة الدراسية</label>
                      <input type="text" className="glass-input" value={formData.group_name} onChange={e => setFormData({ ...formData, group_name: e.target.value })} placeholder="مثال: شعبة (أ)" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <motion.button onClick={handleSave} whileHover={{ scale: 1.02, boxShadow: '0 0 15px rgba(214,175,55,0.3)' }} whileTap={{ scale: 0.98 }} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#052218', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.95rem' }}>
                  💾 اعتماد وثيقة السجل
                </motion.button>
                <button onClick={resetForm} style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>
                  إلغاء الإجراء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Students;
