// src/components/Students.js – إدارة شؤون الطلاب والكليات (الإصدار الملكي الفاخر)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery } from '../services/db';

function Students() {
  const [tab, setTab] = useState('students'); // colleges, departments, majors, students
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [majors, setMajors] = useState([]);
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // حقول النموذج الملكي الموحد
  const [formData, setFormData] = useState({
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
  });

  useEffect(() => {
    loadColleges();
    loadStudents();
  }, []);

  // ========== خدمات استدعاء البيانات المحلية ==========
  const loadColleges = () => {
    const data = getQuery("SELECT * FROM colleges WHERE status='active' ORDER BY name");
    setColleges(data);
  };

  const loadDepartments = (collegeId = null) => {
    let data;
    if (collegeId) {
      data = getQuery("SELECT * FROM departments WHERE college_id=? AND status='active' ORDER BY name", [collegeId]);
    } else {
      data = getQuery("SELECT d.*, c.name as college_name FROM departments d JOIN colleges c ON d.college_id=c.id WHERE d.status='active' ORDER BY c.name, d.name");
    }
    setDepartments(data);
  };

  const loadMajors = (deptId = null) => {
    let data;
    if (deptId) {
      data = getQuery("SELECT * FROM majors WHERE department_id=? AND status='active' ORDER BY name", [deptId]);
    } else {
      data = getQuery("SELECT m.*, d.name as department_name, c.name as college_name FROM majors m JOIN departments d ON m.department_id=d.id JOIN colleges c ON d.college_id=c.id WHERE m.status='active' ORDER BY c.name, d.name, m.name");
    }
    setMajors(data);
  };

  const loadStudents = () => {
    const data = getQuery(`
      SELECT s.*, m.name as major_name, d.name as department_name, c.name as college_name
      FROM students s
      LEFT JOIN majors m ON s.major_id = m.id
      LEFT JOIN departments d ON m.department_id = d.id
      LEFT JOIN colleges c ON d.college_id = c.id
      WHERE s.status='active'
      ORDER BY s.full_name
    `);
    setStudents(data);
  };

  // ========== تفريغ وإعادة تعيين الحقول ==========
  const resetForm = () => {
    setFormData({
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
    });
    setEditId(null);
    setShowForm(false);
  };

  // ========== عمليات حفظ السجلات المعدلة والجديدة ==========
  const handleSave = () => {
    if (tab === 'colleges') {
      if (editId) {
        runQuery("UPDATE colleges SET name=? WHERE id=?", [formData.name, editId]);
      } else {
        runQuery("INSERT INTO colleges (name) VALUES (?)", [formData.name]);
      }
      loadColleges();
    }

    if (tab === 'departments') {
      if (editId) {
        runQuery("UPDATE departments SET name=?, college_id=? WHERE id=?", [formData.name, formData.college_id, editId]);
      } else {
        runQuery("INSERT INTO departments (name, college_id) VALUES (?, ?)", [formData.name, formData.college_id]);
      }
      loadDepartments();
    }

    if (tab === 'majors') {
      if (editId) {
        runQuery("UPDATE majors SET name=?, department_id=?, fees=?, duration=? WHERE id=?", [formData.name, formData.department_id, formData.fees, formData.duration, editId]);
      } else {
        runQuery("INSERT INTO majors (name, department_id, fees, duration) VALUES (?, ?, ?, ?)", [formData.name, formData.department_id, formData.fees, formData.duration]);
      }
      loadMajors();
    }

    if (tab === 'students') {
      if (editId) {
        runQuery(
          "UPDATE students SET university_id=?, full_name=?, phone=?, parent_phone=?, national_id=?, major_id=?, level=?, group_name=? WHERE id=?",
          [formData.university_id, formData.full_name, formData.phone, formData.parent_phone, formData.national_id, formData.major_id, formData.level, formData.group_name, editId]
        );
      } else {
        runQuery(
          "INSERT INTO students (university_id, full_name, phone, parent_phone, national_id, major_id, level, group_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [formData.university_id, formData.full_name, formData.phone, formData.parent_phone, formData.national_id, formData.major_id, formData.level, formData.group_name]
        );
      }
      loadStudents();
    }

    resetForm();
  };

  // ========== الإخفاء المؤقت المعتمد في المشروع (الأرشفة) ==========
  const handleDelete = (id) => {
    if (window.confirm("هل أنت متأكد من رغبتك في نقل هذا السجل للأرشيف العام؟")) {
      if (tab === 'colleges') { runQuery("UPDATE colleges SET status='inactive' WHERE id=?", [id]); loadColleges(); }
      if (tab === 'departments') { runQuery("UPDATE departments SET status='inactive' WHERE id=?", [id]); loadDepartments(); }
      if (tab === 'majors') { runQuery("UPDATE majors SET status='inactive' WHERE id=?", [id]); loadMajors(); }
      if (tab === 'students') { runQuery("UPDATE students SET status='inactive' WHERE id=?", [id]); loadStudents(); }
    }
  };

  // ========== تعبئة بيانات التعديل للمدخرات ==========
  const handleEdit = (item) => {
    setEditId(item.id);
    setShowForm(true);
    if (tab === 'colleges') {
      setFormData({ ...formData, name: item.name });
    }
    if (tab === 'departments') {
      setFormData({ ...formData, name: item.name, college_id: item.college_id });
    }
    if (tab === 'majors') {
      setFormData({ ...formData, name: item.name, department_id: item.department_id, fees: item.fees, duration: item.duration });
    }
    if (tab === 'students') {
      setFormData({
        ...formData,
        university_id: item.university_id,
        full_name: item.full_name,
        phone: item.phone,
        parent_phone: item.parent_phone,
        national_id: item.national_id,
        major_id: item.major_id,
        level: item.level,
        group_name: item.group_name
      });
    }
  };

  // ========== طباعة وإصدار بطاقة الهوية الجامعية الذكية QR ==========
  const printCard = (student) => {
    const cardWindow = window.open('', 'بطاقة الهوية الأكاديمية', 'width=450,height=650');
    cardWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>البطاقة الجامعية الذكية</title>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&family=Amiri:ital,wght@0,700;1,400&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Tajawal', sans-serif; background: #03140f; color: #fff; text-align: center; padding: 10px; margin: 0; }
            .card { 
              border: 3px solid #D4AF37; border-radius: 24px; padding: 25px; max-width: 360px; margin: 20px auto;
              background: linear-gradient(135deg, #062b1e, #0c4733); position: relative; overflow: hidden;
              box-shadow: 0 15px 35px rgba(0,0,0,0.6);
            }
            .card::before {
              content: "🏛️"; position: absolute; font-size: 15rem; opacity: 0.03; top: 20%; left: -10%; pointer-events: none;
            }
            .header-title { font-family: 'Amiri', serif; font-size: 1.15rem; color: #D4AF37; margin: 5px 0; }
            .sub-title { font-size: 0.75rem; color: #cbd5e1; margin-bottom: 15px; letter-spacing: 1px; }
            .avatar-placeholder { width: 95px; height: 95px; border-radius: 50%; border: 2px solid #D4AF37; background: rgba(255,255,255,0.05); margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; }
            .name { font-size: 1.25rem; font-weight: 900; color: #fff; margin: 8px 0; letter-spacing: -0.5px; }
            .id-badge { background: #D4AF37; color: #062b1e; display: inline-block; padding: 4px 16px; border-radius: 50px; font-weight: 800; font-size: 0.95rem; margin-bottom: 15px; }
            .qr-container { background: white; padding: 10px; display: inline-block; border-radius: 16px; margin: 5px 0; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
            .info-box { text-align: right; background: rgba(0,0,0,0.25); padding: 12px 18px; border-radius: 14px; margin-top: 15px; border: 1px solid rgba(212,175,55,0.15); font-size: 0.85rem; }
            .info-box p { margin: 6px 0; color: #e2e8f0; }
            .info-box strong { color: #D4AF37; }
            .footer-text { font-size: 0.65rem; color: rgba(255,255,255,0.4); margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-title">جامعة القرآن الكريم والعلوم الإسلامية</div>
            <div class="sub-title">فرع غيل باوزير - حضرموت</div>
            <div class="avatar-placeholder">🎓</div>
            <div class="name">${student.full_name}</div>
            <div class="id-badge">${student.university_id}</div>
            <br/>
            <div class="qr-container"><div id="qrcode"></div></div>
            <div class="info-box">
              <p><strong>🏛️ الكلية:</strong> ${student.college_name || 'الأقسام الأكاديمية'}</p>
              <p><strong>📂 القسم:</strong> ${student.department_name || ''}</p>
              <p><strong>📜 التخصص:</strong> ${student.major_name || ''}</p>
              <p><strong>📈 المستوى الدراسي:</strong> ${student.level || ''} (الشعبة: ${student.group_name || '1'})</p>
            </div>
            <div class="footer-text">نظام الهوية الإلكتروني الذكي الموحد لبوابات الحضور الإلكترونية</div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            new QRCode(document.getElementById("qrcode"), {
              text: "${student.university_id}",
              width: 110,
              height: 110,
              colorDark : "#062b1e",
              colorLight : "#ffffff"
            });
            setTimeout(() => { window.print(); }, 600);
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

  // ========== مؤثرات تحريك النوافذ (Modals) ==========
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 150, damping: 20 } },
    exit: { opacity: 0, scale: 0.95, y: 15, transition: { duration: 0.2 } }
  };

  return (
    <div className="students-module" style={{ padding: '5px 0' }}>
      
      {/* 🧭 شريط التبويبات الفاخر ثلاثي الأبعاد */}
      <div className="tabs" style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '18px', border: '1px solid var(--glass-border)', marginBottom: '30px' }}>
        {[
          { id: 'colleges', label: '🏫 الكليات العمومية', load: loadColleges },
          { id: 'departments', label: '📂 الأقسام المقيدة', load: () => loadDepartments() },
          { id: 'majors', label: '🎓 تخصصات الكليات', load: () => loadMajors() },
          { id: 'students', label: '👥 سجلات الطلاب', load: loadStudents }
        ].map(t => (
          <motion.button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); t.load(); resetForm(); }}
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
              background: tab === t.id ? 'linear-gradient(135deg, var(--gold-main), #b89324)' : 'rgba(255,255,255,0.03)',
              color: tab === t.id ? '#062b1e' : 'var(--text-secondary)',
              border: tab === t.id ? '1px solid var(--gold-light)' : '1px solid rgba(255,255,255,0.05)',
              boxShadow: tab === t.id ? '0 5px 15px rgba(214,175,55,0.2)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* 📋 محتوى الكليات */}
      {tab === 'colleges' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
          <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>🏫 إدارة هيكلة كليات الجامعة</h3>
            <motion.button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
              ➕ قيد كلية جديدة
            </motion.button>
          </div>

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم الكلية الأكاديمية</th>
                  <th>تاريخ القيد المالي</th>
                  <th>إجراءات إدارية</th>
                </tr>
              </thead>
              <tbody>
                {colleges.map((c, i) => (
                  <tr key={c.id}>
                    <td><strong>{i + 1}</strong></td>
                    <td style={{ color: 'var(--white)', fontWeight: 600 }}>{c.name}</td>
                    <td>{c.created_at || 'مفعل مسبقاً'}</td>
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(c)}>✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(c.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 📋 محتوى الأقسام */}
      {tab === 'departments' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
          <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>📂 إدارة الأقسام العلمية للجامعة</h3>
            <motion.button className="btn-add" onClick={() => { resetForm(); loadColleges(); setShowForm(true); }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
              ➕ تدشين قسم أكاديمي
            </motion.button>
          </div>

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم القسم العلمي</th>
                  <th>الكلية التابع لها</th>
                  <th>إجراءات إدارية</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d, i) => (
                  <tr key={d.id}>
                    <td><strong>{i + 1}</strong></td>
                    <td style={{ color: 'var(--white)', fontWeight: 600 }}>{d.name}</td>
                    <td style={{ color: 'var(--gold-light)' }}>{d.college_name}</td>
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(d)}>✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(d.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 📋 محتوى التخصصات */}
      {tab === 'majors' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
          <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>🎓 مساقات الخطط الدراسية والتخصصات</h3>
            <motion.button className="btn-add" onClick={() => { resetForm(); loadDepartments(); setShowForm(true); }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>
              ➕ ربط تخصص خطة
            </motion.button>
          </div>

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>مساق التخصص الفرعي</th>
                  <th>القسم العلمي</th>
                  <th>الرسوم السنوية</th>
                  <th>مدة المسار الدراسي</th>
                  <th>إجراءات إدارية</th>
                </tr>
              </thead>
              <tbody>
                {majors.map((m, i) => (
                  <tr key={m.id}>
                    <td><strong>{i + 1}</strong></td>
                    <td style={{ color: 'var(--white)', fontWeight: 600 }}>{m.name}</td>
                    <td>{m.department_name}</td>
                    <td style={{ color: 'var(--gold-main)', fontWeight: 700 }}>{m.fees} ريال</td>
                    <td>{m.duration}</td>
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(m)}>✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(m.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 📋 محتوى السجلات والطلاب */}
      {tab === 'students' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-content">
          <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>👥 شؤون المقيدين وضبط الهوية الجامعية</h3>
            <div className="tab-actions" style={{ display: 'flex', gap: '12px', flex: '1', justifyContent: 'flex-end', minWidth: '280px' }}>
              <input
                type="text"
                placeholder="🔍 ابحث بالرقم الجامعي، الاسم، التخصص..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-input"
                style={{ width: '100%', maxWidth: '320px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '10px 16px', borderRadius: '12px', color: '#fff' }}
              />
              <motion.button className="btn-add" onClick={() => { resetForm(); loadMajors(); setShowForm(true); }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '10px 20px', borderVer: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ➕ تسجيل طالب
              </motion.button>
            </div>
          </div>

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>الرقم الجامعي</th>
                  <th>الاسم الرباعي المعتمد</th>
                  <th>تخصص المسار الدراسي</th>
                  <th>المستوى</th>
                  <th>رقم الهاتف الشخصي</th>
                  <th>بطاقة QR</th>
                  <th>أوامر تحرير</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, i) => (
                  <tr key={s.id}>
                    <td><strong>{i + 1}</strong></td>
                    <td style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{s.university_id}</td>
                    <td style={{ color: 'var(--white)', fontWeight: 600 }}>{s.full_name}</td>
                    <td>{s.major_name}</td>
                    <td><span style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '3px 10px', borderRadius: '50px', fontSize: '0.85rem' }}>{s.level}</span></td>
                    <td>{s.phone}</td>
                    <td>
                      <motion.button className="btn-qr" onClick={() => printCard(s)} whileHover={{ scale: 1.1 }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: '6px 10px', borderRadius: '8px' }}>📱 كود</motion.button>
                    </td>
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(s)}>✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(s.id)}>🗑️</button>
                      <button className="btn-print" onClick={() => printCard(s)} style={{ color: 'var(--gold-main)' }}>🖨️ طباعة</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 🪟 النافذة المنبثقة الشفافة الفاخرة للنماذج الإدخالية (Glassmorphic Modal) */}
      <AnimatePresence>
        {showForm && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(3, 20, 15, 0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <motion.div
              className="form-card-modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ background: 'linear-gradient(135deg, rgba(6,43,30,0.95), rgba(12,71,51,0.95))', border: '1px solid var(--gold-light)', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: tab === 'students' ? '700px' : '450px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
            >
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-main)', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                {editId ? '📝 تعديل سجل حالي موثق' : '➕ إضافة سجل إداري جديد'}
              </h3>

              {/* حقول نموذج الكليات */}
              {tab === 'colleges' && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>اسم الكلية بالكامل</label>
                  <input type="text" className="glass-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: كلية الشريعة والدراسات الإسلامية" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '1rem' }} />
                </div>
              )}

              {/* حقول نموذج الأقسام */}
              {tab === 'departments' && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>الكلية الحاضنة</label>
                  <select className="glass-input" value={formData.college_id} onChange={e => setFormData({ ...formData, college_id: e.target.value })} style={{ background: '#062b1e', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff', fontSize: '1rem' }}>
                    <option value="">-- حدد الكلية المرجعية --</option>
                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>اسم القسم العلمي</label>
                  <input type="text" className="glass-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: قسم التفسير وعلوم القرآن" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                </div>
              )}

              {/* حقول نموذج التخصصات */}
              {tab === 'majors' && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>القسم التخصصي تتبع</label>
                  <select className="glass-input" value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} style={{ background: '#062b1e', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }}>
                    <option value="">-- حدد القسم التخصصي --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.college_name})</option>)}
                  </select>
                  <label style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>اسم مسار التخصص الفرعي</label>
                  <input type="text" className="glass-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: تخصص القراءات" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>الرسوم السنوية (ريال)</label>
                      <input type="number" className="glass-input" value={formData.fees} onChange={e => setFormData({ ...formData, fees: e.target.value })} placeholder="الرسوم" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>فترة البقاء بالخطة</label>
                      <input type="text" className="glass-input" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* حقول نموذج شؤون الطلاب (الهيكلة العريضة) */}
              {tab === 'students' && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>🔢 الرقم الجامعي المقيد</label>
                      <input type="text" className="glass-input" value={formData.university_id} onChange={e => setFormData({ ...formData, university_id: e.target.value })} placeholder="مثال: 20261009" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>👤 الاسم الرباعي الرسمي لطالب</label>
                      <input type="text" className="glass-input" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="الاسم الكامل دون اختصارات" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>📱 هاتف التواصل الأساسي</label>
                      <input type="text" className="glass-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="777000000" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>💬 جوال ولي الأمر (WhatsApp)</label>
                      <input type="text" className="glass-input" value={formData.parent_phone} onChange={e => setFormData({ ...formData, parent_phone: e.target.value })} placeholder="إشعار أولياء الأمور تلقائياً" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>🪪 رقم البطاقة الوطنية</label>
                      <input type="text" className="glass-input" value={formData.national_id} onChange={e => setFormData({ ...formData, national_id: e.target.value })} placeholder="الرقم الوطني الشخصي" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>📜 تخصص خطة القبول</label>
                      <select className="glass-input" value={formData.major_id} onChange={e => setFormData({ ...formData, major_id: e.target.value })} style={{ width: '100%', background: '#062b1e', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }}>
                        <option value="">-- حدد المساق المقيد --</option>
                        {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>📈 الفوج/المستوى الدراسي</label>
                      <input type="text" className="glass-input" value={formData.level} onChange={e => setFormData({ ...formData, level: e.target.value })} placeholder="مثال: المستوى الأول" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>🏫 الشعبة الدراسية الفرعية</label>
                      <input type="text" className="glass-input" value={formData.group_name} onChange={e => setFormData({ ...formData, group_name: e.target.value })} placeholder="مثال: أ / ب" style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px 16px', borderRadius: '12px', color: '#fff' }} />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-actions" style={{ display: 'flex', justify: 'flex-end', gap: '12px', marginTop: '25px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <motion.button className="btn-save" onClick={handleSave} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '10px 22px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                  💾 اعتماد حفظ البيانات
                </motion.button>
                <button className="btn-cancel" onClick={resetForm} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer' }}>
                  إلغاء الأمر
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
