// src/components/Students.js – إدارة شؤون الطلاب والكليات (الإصدار الملكي الفاخر الخارق)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery } from '../services/db';

function Students() {
  const [tab, setTab] = useState('students');
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [majors, setMajors] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const [formData, setFormData] = useState({
    name: '', college_id: '', department_id: '', major_id: '',
    university_id: '', full_name: '', phone: '', parent_phone: '',
    national_id: '', level: '', group_name: '', fees: '', duration: '4 سنوات'
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = () => {
    setColleges(getQuery("SELECT * FROM colleges WHERE status='active' ORDER BY name"));
    setDepartments(getQuery("SELECT * FROM departments WHERE status='active' ORDER BY name"));
    setMajors(getQuery("SELECT * FROM majors WHERE status='active' ORDER BY name"));
    setStudents(getQuery("SELECT * FROM students WHERE status='active' ORDER BY full_name"));
    setAttendance(getQuery("SELECT * FROM attendance"));
  };

  // ========== دوال مساعدة لربط البيانات ==========
  const getCollegeName = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    if (!dept) return '';
    const college = colleges.find(c => c.id === dept.college_id);
    return college ? college.name : '';
  };

  const getDeptName = (majorId) => {
    const major = majors.find(m => m.id === majorId);
    if (!major) return '';
    const dept = departments.find(d => d.id === major.department_id);
    return dept ? dept.name : '';
  };

  const getStudentInfo = (student) => {
    const major = majors.find(m => m.id === student.major_id);
    const majorName = major ? major.name : '';
    const deptName = major ? getDeptName(major.id) : '';
    const collegeName = major ? getCollegeName(major.department_id) : '';
    
    const studentAttendance = attendance.filter(a => a.student_id === student.id);
    const absences = studentAttendance.filter(a => a.status === 'absent').length;
    const rate = studentAttendance.length > 0 ? Math.round((absences / studentAttendance.length) * 100) : 0;
    
    return {
      ...student,
      major_name: majorName,
      department_name: deptName,
      college_name: collegeName,
      absence_rate: rate
    };
  };

  const enrichedStudents = students.map(getStudentInfo);

  const resetForm = () => {
    setFormData({
      name: '', college_id: '', department_id: '', major_id: '',
      university_id: '', full_name: '', phone: '', parent_phone: '',
      national_id: '', level: '', group_name: '', fees: '', duration: '4 سنوات'
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = () => {
    if (tab === 'colleges') {
      editId ? runQuery("UPDATE colleges SET name=? WHERE id=?", [formData.name, editId]) : runQuery("INSERT INTO colleges (name) VALUES (?)", [formData.name]);
    }
    if (tab === 'departments') {
      editId ? runQuery("UPDATE departments SET name=?, college_id=? WHERE id=?", [formData.name, formData.college_id, editId]) : runQuery("INSERT INTO departments (name, college_id) VALUES (?, ?)", [formData.name, formData.college_id]);
    }
    if (tab === 'majors') {
      editId ? runQuery("UPDATE majors SET name=?, department_id=?, fees=?, duration=? WHERE id=?", [formData.name, formData.department_id, formData.fees, formData.duration, editId]) : runQuery("INSERT INTO majors (name, department_id, fees, duration) VALUES (?, ?, ?, ?)", [formData.name, formData.department_id, formData.fees, formData.duration]);
    }
    if (tab === 'students') {
      editId ? runQuery("UPDATE students SET university_id=?, full_name=?, phone=?, parent_phone=?, national_id=?, major_id=?, level=?, group_name=? WHERE id=?", [formData.university_id, formData.full_name, formData.phone, formData.parent_phone, formData.national_id, formData.major_id, formData.level, formData.group_name, editId]) : runQuery("INSERT INTO students (university_id, full_name, phone, parent_phone, national_id, major_id, level, group_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [formData.university_id, formData.full_name, formData.phone, formData.parent_phone, formData.national_id, formData.major_id, formData.level, formData.group_name]);
    }
    loadAll();
    resetForm();
  };

  const handleDelete = (id) => {
    if (window.confirm("🏛️ هل أنت متأكد من أرشفة هذا السجل؟")) {
      if (tab === 'colleges') runQuery("UPDATE colleges SET status='inactive' WHERE id=?", [id]);
      if (tab === 'departments') runQuery("UPDATE departments SET status='inactive' WHERE id=?", [id]);
      if (tab === 'majors') runQuery("UPDATE majors SET status='inactive' WHERE id=?", [id]);
      if (tab === 'students') runQuery("UPDATE students SET status='inactive' WHERE id=?", [id]);
      loadAll();
    }
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setShowForm(true);
    if (tab === 'colleges') setFormData({ ...formData, name: item.name });
    if (tab === 'departments') setFormData({ ...formData, name: item.name, college_id: item.college_id });
    if (tab === 'majors') setFormData({ ...formData, name: item.name, department_id: item.department_id, fees: item.fees, duration: item.duration });
    if (tab === 'students') setFormData({ ...formData, university_id: item.university_id, full_name: item.full_name, phone: item.phone, parent_phone: item.parent_phone, national_id: item.national_id, major_id: item.major_id, level: item.level, group_name: item.group_name });
  };

  const printCard = (student) => {
    const info = getStudentInfo(student);
    const cardWindow = window.open('', 'بطاقة الهوية', 'width=480,height=700');
    cardWindow.document.write(`
      <html dir="rtl"><head><title>البطاقة الجامعية</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&family=Amiri:wght@700&display=swap" rel="stylesheet">
      <style>body{font-family:'Tajawal',sans-serif;background:#020b07;color:#fff;text-align:center;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{border:2px dashed #D4AF37;border-radius:24px;padding:30px;width:350px;background:linear-gradient(135deg,#052218,#0a3a29);box-shadow:0 20px 40px rgba(0,0,0,0.8)}.gold-line{height:4px;background:linear-gradient(90deg,transparent,#D4AF37,transparent);margin:12px 0}.header-title{font-family:'Amiri',serif;font-size:1.3rem;color:#D4AF37}.name{font-size:1.35rem;font-weight:900}.id-badge{background:linear-gradient(135deg,#D4AF37,#b89324);color:#020b07;display:inline-block;padding:5px 20px;border-radius:50px;font-weight:900}.qr-container{background:white;padding:12px;display:inline-block;border-radius:18px;margin:5px 0}.info-box{text-align:right;background:rgba(0,0,0,0.3);padding:14px 18px;border-radius:16px;margin-top:18px;border:1px solid rgba(212,175,55,0.12)}.info-box p{margin:6px 0;color:#cbd5e1;display:flex;justify-content:space-between}.info-box strong{color:#D4AF37}</style></head><body>
      <div class="card"><div class="header-title">جامعة القرآن الكريم والعلوم الإسلامية</div><div class="gold-line"></div>
      <div style="font-size:3rem">🎓</div><div class="name">${student.full_name}</div><div class="id-badge">ID: ${student.university_id}</div>
      <div class="qr-container"><div id="qrcode"></div></div>
      <div class="info-box"><p><strong>🏛️ الكلية:</strong> ${info.college_name || '—'}</p><p><strong>📂 القسم:</strong> ${info.department_name || '—'}</p><p><strong>📜 التخصص:</strong> ${info.major_name || '—'}</p><p><strong>📈 المستوى:</strong> ${student.level || '—'} (${student.group_name || '—'})</p></div></div>
      <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
      <script>new QRCode(document.getElementById("qrcode"),{text:"${student.university_id}",width:115,height:115});setTimeout(()=>window.print(),500);</script></body></html>`);
  };

  const filteredStudents = enrichedStudents.filter(s =>
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.university_id?.includes(searchTerm)
  );

  return (
    <div className="students-module" style={{ padding: '5px 0' }}>
      <div className="tabs" style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '20px', border: '1px solid var(--glass-border)', marginBottom: '30px' }}>
        {[
          { id: 'colleges', label: '🏫 هيكلة الكليات' },
          { id: 'departments', label: '📂 الأقسام الأكاديمية' },
          { id: 'majors', label: '🎓 مسارات التخصصات' },
          { id: 'students', label: '👥 قاعدة بيانات الطلاب' }
        ].map(t => (
          <motion.button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); resetForm(); }}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
            style={{ flex: 1, padding: '14px 10px', borderRadius: '14px', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
              background: tab === t.id ? 'linear-gradient(135deg, var(--gold-main), #b89324)' : 'transparent',
              color: tab === t.id ? '#052218' : 'var(--text-secondary)' }}>
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* Colleges */}
      {tab === 'colleges' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: 0 }}>🏫 الكليات</h3>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>➕ إضافة</button>
          </div>
          <div className="data-table"><table><thead><tr><th>#</th><th>الاسم</th><th>إجراءات</th></tr></thead>
            <tbody>{colleges.map((c, i) => (<tr key={c.id}><td>{i + 1}</td><td>{c.name}</td><td><button className="btn-edit" onClick={() => handleEdit(c)}>✏️</button><button className="btn-delete" onClick={() => handleDelete(c.id)}>🗑️</button></td></tr>))}</tbody></table></div>
        </motion.div>
      )}

      {/* Departments */}
      {tab === 'departments' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>📂 الأقسام</h3>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>➕ إضافة</button>
          </div>
          <div className="data-table"><table><thead><tr><th>#</th><th>الاسم</th><th>الكلية</th><th>إجراءات</th></tr></thead>
            <tbody>{departments.map((d, i) => (<tr key={d.id}><td>{i + 1}</td><td>{d.name}</td><td>{colleges.find(c => c.id === d.college_id)?.name || ''}</td><td><button className="btn-edit" onClick={() => handleEdit(d)}>✏️</button><button className="btn-delete" onClick={() => handleDelete(d.id)}>🗑️</button></td></tr>))}</tbody></table></div>
        </motion.div>
      )}

      {/* Majors */}
      {tab === 'majors' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>🎓 التخصصات</h3>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>➕ إضافة</button>
          </div>
          <div className="data-table"><table><thead><tr><th>#</th><th>الاسم</th><th>القسم</th><th>الرسوم</th><th>المدة</th><th>إجراءات</th></tr></thead>
            <tbody>{majors.map((m, i) => (<tr key={m.id}><td>{i + 1}</td><td>{m.name}</td><td>{departments.find(d => d.id === m.department_id)?.name || ''}</td><td>{m.fees}</td><td>{m.duration}</td><td><button className="btn-edit" onClick={() => handleEdit(m)}>✏️</button><button className="btn-delete" onClick={() => handleDelete(m.id)}>🗑️</button></td></tr>))}</tbody></table></div>
        </motion.div>
      )}

      {/* Students */}
      {tab === 'students' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px' }}>
            <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>👥 الطلاب</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="🔍 بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '10px', color: '#fff' }} />
              <button onClick={() => { resetForm(); setShowForm(true); }} style={{ background: 'linear-gradient(135deg, var(--emerald-light), var(--green-bright))', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>➕ إضافة</button>
            </div>
          </div>
          <div className="data-table"><table><thead><tr><th>#</th><th>الرقم</th><th>الاسم</th><th>التخصص</th><th>المستوى</th><th>الغياب</th><th>إجراءات</th></tr></thead>
            <tbody>{filteredStudents.map((s, i) => (<tr key={s.id}><td>{i + 1}</td><td>{s.university_id}</td><td>{s.full_name}</td><td>{s.major_name}</td><td>{s.level}</td><td style={{ color: s.absence_rate >= 25 ? '#ef4444' : s.absence_rate > 12 ? '#f59e0b' : 'var(--green-bright)' }}>{s.absence_rate}%</td><td><button className="btn-edit" onClick={() => handleEdit(s)}>✏️</button><button className="btn-delete" onClick={() => handleDelete(s.id)}>🗑️</button><button onClick={() => printCard(s)} style={{ color: 'var(--gold-main)', background: 'transparent', border: 'none', cursor: 'pointer' }}>🖨️</button></td></tr>))}</tbody></table></div>
        </motion.div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,11,7,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} style={{ background: 'linear-gradient(135deg, #052218, #0a3a29)', border: '1px solid var(--gold-main)', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '500px' }}>
              <h3 style={{ fontFamily: 'Amiri, serif', color: 'var(--gold-main)' }}>{editId ? '📝 تعديل' : '➕ إضافة'}</h3>
              {tab === 'colleges' && <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="اسم الكلية" style={{ width: '100%', padding: '10px', margin: '10px 0', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }} />}
              {tab === 'departments' && (<><select value={formData.college_id} onChange={e => setFormData({ ...formData, college_id: e.target.value })} style={{ width: '100%', padding: '10px', margin: '10px 0', background: '#052218', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }}><option value="">اختر الكلية</option>{colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="اسم القسم" style={{ width: '100%', padding: '10px', margin: '10px 0', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }} /></>)}
              {tab === 'majors' && (<><select value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} style={{ width: '100%', padding: '10px', margin: '10px 0', background: '#052218', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }}><option value="">اختر القسم</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="اسم التخصص" style={{ width: '100%', padding: '10px', margin: '10px 0', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }} /></>)}
              {tab === 'students' && (<>
                <input type="text" value={formData.university_id} onChange={e => setFormData({ ...formData, university_id: e.target.value })} placeholder="الرقم الجامعي" style={{ width: '100%', padding: '10px', margin: '5px 0', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }} />
                <input type="text" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="الاسم الرباعي" style={{ width: '100%', padding: '10px', margin: '5px 0', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }} />
                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="الجوال" style={{ width: '100%', padding: '10px', margin: '5px 0', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }} />
                <input type="text" value={formData.level} onChange={e => setFormData({ ...formData, level: e.target.value })} placeholder="المستوى" style={{ width: '100%', padding: '10px', margin: '5px 0', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }} />
                <select value={formData.major_id} onChange={e => setFormData({ ...formData, major_id: e.target.value })} style={{ width: '100%', padding: '10px', margin: '5px 0', background: '#052218', border: '1px solid var(--glass-border)', borderRadius: '10px', color: '#fff' }}><option value="">اختر التخصص</option>{majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              </>)}
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={handleSave} style={{ flex: 1, background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#000', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>💾 حفظ</button>
                <button onClick={resetForm} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '10px', cursor: 'pointer' }}>إلغاء</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Students;
