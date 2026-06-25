// src/components/Teachers.js – إدارة هيئة التدريس والكادر الأكاديمي (SQLite محلية + صورة)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery, initDatabase } from '../services/db';

function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [dbReady, setDbReady] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, byCollege: [], bySpeciality: [] });
  const photoInputRef = useRef(null);

  const initialFormState = {
    teacher_id: '', full_name: '', email: '', phone: '',
    speciality: '', department_id: '', college_id: '', qualifications: '', photo: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  const loadColleges = useCallback(async () => {
    const data = await getQuery("SELECT * FROM colleges WHERE status = 'active' ORDER BY name");
    setColleges(data || []);
  }, []);

  const loadDepartments = useCallback(async (collegeId = null) => {
    if (collegeId) {
      const data = await getQuery("SELECT * FROM departments WHERE college_id = ? AND status = 'active' ORDER BY name", [collegeId]);
      setDepartments(data || []);
    } else {
      const data = await getQuery("SELECT d.*, c.name as college_name FROM departments d LEFT JOIN colleges c ON d.college_id = c.id WHERE d.status = 'active' ORDER BY d.name");
      setDepartments(data || []);
    }
  }, []);

  const loadTeachers = useCallback(async () => {
    const data = await getQuery(
      "SELECT t.*, d.name as department_name, c.name as college_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id LEFT JOIN colleges c ON t.college_id = c.id WHERE t.status = 'active' ORDER BY t.full_name"
    );
    setTeachers(data || []);

    // حساب الإحصائيات
    if (data && data.length > 0) {
      const byCollege = {};
      const bySpeciality = {};
      data.forEach(t => {
        const cn = t.college_name || 'غير محدد';
        const sp = t.speciality || 'غير محدد';
        byCollege[cn] = (byCollege[cn] || 0) + 1;
        bySpeciality[sp] = (bySpeciality[sp] || 0) + 1;
      });
      setStats({
        total: data.length,
        active: data.filter(t => t.status === 'active').length,
        byCollege: Object.entries(byCollege).map(([name, count]) => ({ name, count })),
        bySpeciality: Object.entries(bySpeciality).map(([name, count]) => ({ name, count }))
      });
    } else {
      setStats({ total: 0, active: 0, byCollege: [], bySpeciality: [] });
    }
  }, []);

  useEffect(() => {
    const setup = async () => {
      await initDatabase();
      setDbReady(true);
      await loadColleges();
      await loadDepartments();
      await loadTeachers();
    };
    setup();
  }, [loadColleges, loadDepartments, loadTeachers]);

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
    await loadTeachers();
  };

  const handleDelete = async (id) => {
    if (window.confirm("👨‍🏫 هل أنت متأكد من أرشفة سجل هذا المعلم؟")) {
      await runQuery("UPDATE teachers SET status = 'inactive' WHERE id = ?", [id]);
      await loadTeachers();
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
        .card{border:2px dashed #D4AF37;border-radius:24px;padding:30px;width:350px;background:linear-gradient(135deg,#052218,#0a3a29);position:relative;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.8);box-sizing:border-box}
        .card::before{content:"🏛️";position:absolute;font-size:16rem;opacity:0.03;top:15%;left:-15%;pointer-events:none}
        .gold-line{height:4px;background:linear-gradient(90deg,transparent,#D4AF37,transparent);margin:12px 0}
        .header-title{font-family:'Amiri',serif;font-size:1.3rem;color:#D4AF37;margin:0;font-weight:700}
        .sub-title{font-size:0.78rem;color:#a3b8cc;margin:2px 0 15px 0}
        .avatar-zone{width:105px;height:105px;border-radius:50%;border:2px solid #D4AF37;background:rgba(255,255,255,0.03);margin:0 auto 15px;display:flex;align-items:center;justify-content:center;font-size:3rem;box-shadow:0 0 15px rgba(214,175,55,0.1);overflow:hidden}
        .avatar-zone img{width:100%;height:100%;object-fit:cover}
        .name{font-size:1.35rem;font-weight:900;color:#fff;margin:10px 0 5px 0}
        .id-badge{background:linear-gradient(135deg,#D4AF37,#b89324);color:#020b07;display:inline-block;padding:5px 20px;border-radius:50px;font-weight:900;font-size:1rem;margin-bottom:15px;box-shadow:0 4px 10px rgba(214,175,55,0.2)}
        .info-box{text-align:right;background:rgba(0,0,0,0.3);padding:14px 18px;border-radius:16px;margin-top:18px;border:1px solid rgba(212,175,55,0.12);font-size:0.88rem}
        .info-box p{margin:6px 0;color:#cbd5e1;display:flex;justify-content:space-between}
        .info-box strong{color:#D4AF37}
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

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
  const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 15 } } };

  return (
    <div className="students-module" style={{ padding: '5px 0' }}>
      {!dbReady && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gold-light)' }}>⏳ جاري تهيئة قاعدة البيانات المحلية...</div>
      )}

      {dbReady && (
        <>
          {/* 🏛️ إحصائيات سريعة */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            {[
              { label: 'إجمالي المعلمين', count: stats.total, color: '#f472b6', icon: '👨‍🏫' },
              { label: 'المعلمين النشطين', count: stats.active, color: '#34d399', icon: '✅' },
              { label: 'عدد الكليات', count: stats.byCollege.length, color: '#D4AF37', icon: '🏛️' },
              { label: 'التخصصات', count: stats.bySpeciality.length, color: '#38bdf8', icon: '📚' }
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

          {/* 📊 توزيع المعلمين على الكليات */}
          {stats.byCollege.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '25px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', borderRadius: '14px', padding: '15px' }}>
              {stats.byCollege.map((c, i) => (
                <span key={i} style={{ background: 'rgba(244,114,182,0.1)', color: '#f472b6', border: '1px solid rgba(244,114,182,0.2)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                  🏛️ {c.name}: {c.count}
                </span>
              ))}
            </div>
          )}

          {/* 🛠️ شريط الأدوات */}
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', alignItems: 'center', marginBottom: '25px' }}>
            <div>
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.7rem', color: 'var(--gold-light)', margin: 0 }}>👨‍🏫 وحدة إدارة هيئة التدريس والكادر الأكاديمي</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>إدارة أعضاء هيئة التدريس والمحاضرين والمعيدين وربطهم بالكليات والأقسام</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                <button onClick={() => setViewMode('grid')} style={{ background: viewMode === 'grid' ? 'var(--gold-main)' : 'transparent', color: viewMode === 'grid' ? '#052218' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>🎴 كروت</button>
                <button onClick={() => setViewMode('table')} style={{ background: viewMode === 'table' ? 'var(--gold-main)' : 'transparent', color: viewMode === 'table' ? '#052218' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>📋 جدول</button>
              </div>
              <input type="text" placeholder="🔍 بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '220px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '10px 16px', borderRadius: '12px', color: '#fff' }} />
              <motion.button onClick={() => { resetForm(); loadColleges(); setShowForm(true); }} whileHover={{ scale: 1.03 }}
                style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 15px rgba(244,114,182,0.3)' }}>
                ➕ قيد معلم
              </motion.button>
            </div>
          </div>

          {/* 👨‍🏫 عرض المعلمين */}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>📧 البريد:</span><span style={{ color: '#cbd5e1', direction: 'ltr', textAlign: 'left' }}>{teacher.email || '—'}</span></div>
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
              {filteredTeachers.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', borderRadius: '16px' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '15px' }}>👨‍🏫</span>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>لا يوجد معلمين مسجلين</p>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}>
                    <th>#</th><th>صورة</th><th>الرقم الوظيفي</th><th>الاسم</th><th>الكلية</th><th>القسم</th><th>التخصص</th><th>الهاتف</th><th>إجراءات</th>
                  </tr>
                </thead>
                <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                  {filteredTeachers.map((t, i) => (
                    <motion.tr variants={itemVariants} key={t.id}>
                      <td><strong>{i + 1}</strong></td>
                      <td>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(244,114,182,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: '1.2rem' }}>
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
                        <button className="btn-edit" onClick={() => handleEdit(t)} style={{ marginRight: '4px' }}>✏️</button>
                        <button className="btn-delete" onClick={() => handleDelete(t.id)} style={{ marginRight: '4px' }}>🗑️</button>
                        <button onClick={() => printTeacherCard(t)} style={{ color: '#f472b6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>🖨️</button>
                      </td>
                    </motion.tr>
                  ))}
                  {filteredTeachers.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>👨‍🏫 لا يوجد معلمين مسجلين</td></tr>
                  )}
                </motion.tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 🪟 نافذة النموذج */}
      <AnimatePresence>
        {showForm && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(2, 11, 7, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }} transition={{ type: 'spring', stiffness: 140, damping: 18 }}
              style={{ background: 'linear-gradient(135deg, rgba(5,34,24,0.98), rgba(10,58,41,0.98))', border: '1px solid #f472b6', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
              
              <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: '#f472b6', marginBottom: '22px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginTop: 0 }}>
                {editId ? '📝 تحرير بيانات المعلم' : '➕ قيد معلم جديد'}
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
                    <input type="text" className="glass-input" value={formData.teacher_id} onChange={e => setFormData({ ...formData, teacher_id: e.target.value })} placeholder="مثال: T2024001" style={{ width: '100%' }} />
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
                    <input type="email" className="glass-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="example@university.edu" style={{ width: '100%', direction: 'ltr', textAlign: 'left' }} />
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
