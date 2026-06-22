// components/Students.js – إدارة الطلاب (كليات + أقسام + تخصصات + طلاب + QR)
import React, { useState, useEffect } from 'react';
import { getQuery, runQuery } from '../services/db';
import { QRCodeSVG } from 'qrcode.react';

function Students() {
  const [tab, setTab] = useState('students'); // colleges, departments, majors, students
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [majors, setMajors] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // حقول النموذج
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

  // ========== تحميل البيانات ==========
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

  // ========== إعادة تعيين النموذج ==========
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

  // ========== حفظ البيانات ==========
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

  // ========== حذف ==========
  const handleDelete = (id) => {
    if (tab === 'colleges') {
      runQuery("UPDATE colleges SET status='inactive' WHERE id=?", [id]);
      loadColleges();
    }
    if (tab === 'departments') {
      runQuery("UPDATE departments SET status='inactive' WHERE id=?", [id]);
      loadDepartments();
    }
    if (tab === 'majors') {
      runQuery("UPDATE majors SET status='inactive' WHERE id=?", [id]);
      loadMajors();
    }
    if (tab === 'students') {
      runQuery("UPDATE students SET status='inactive' WHERE id=?", [id]);
      loadStudents();
    }
  };

  // ========== تعديل ==========
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

  // ========== طباعة بطاقة ==========
  const printCard = (student) => {
    const cardWindow = window.open('', 'بطاقة طالب', 'width=400,height=600');
    cardWindow.document.write(`
      <html dir="rtl">
        <head>
          <style>
            body { font-family: 'Tajawal', sans-serif; text-align: center; padding: 20px; }
            .card { border: 2px solid #D4AF37; border-radius: 16px; padding: 20px; max-width: 350px; margin: auto; }
            .logo { width: 80px; }
            .name { font-size: 1.3rem; font-weight: bold; color: #083d2b; }
            .id { font-size: 1.1rem; color: #D4AF37; margin: 10px 0; }
            .info { text-align: right; margin-top: 15px; }
            .info p { margin: 5px 0; }
            svg { margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="/logo.png" class="logo" alt="الشعار" />
            <h3>جامعة القرآن الكريم والعلوم الإسلامية</h3>
            <p class="name">${student.full_name}</p>
            <p class="id">${student.university_id}</p>
            <div id="qrcode"></div>
            <div class="info">
              <p><strong>التخصص:</strong> ${student.major_name || ''}</p>
              <p><strong>المستوى:</strong> ${student.level || ''}</p>
              <p><strong>الشعبة:</strong> ${student.group_name || ''}</p>
            </div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            new QRCode(document.getElementById("qrcode"), {
              text: "${student.university_id}",
              width: 120,
              height: 120
            });
            setTimeout(() => window.print(), 500);
          </script>
        </body>
      </html>
    `);
  };

  // ========== فلترة البحث ==========
  const filteredStudents = students.filter(s =>
    s.full_name?.includes(searchTerm) ||
    s.university_id?.includes(searchTerm) ||
    s.major_name?.includes(searchTerm)
  );

  // ========== واجهة الكليات ==========
  const renderColleges = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h3>🏫 الكليات</h3>
        <button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }}>
          ➕ إضافة كلية
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <input
            type="text"
            placeholder="اسم الكلية"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
          <div className="form-actions">
            <button className="btn-save" onClick={handleSave}>💾 حفظ</button>
            <button className="btn-cancel" onClick={resetForm}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>اسم الكلية</th>
              <th>تاريخ الإنشاء</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {colleges.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td>{c.name}</td>
                <td>{c.created_at}</td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(c)}>✏️</button>
                  <button className="btn-delete" onClick={() => handleDelete(c.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ========== واجهة الأقسام ==========
  const renderDepartments = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h3>📂 الأقسام</h3>
        <button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }}>
          ➕ إضافة قسم
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <select
            value={formData.college_id}
            onChange={e => setFormData({ ...formData, college_id: e.target.value })}
          >
            <option value="">اختر الكلية</option>
            {colleges.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="اسم القسم"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
          <div className="form-actions">
            <button className="btn-save" onClick={handleSave}>💾 حفظ</button>
            <button className="btn-cancel" onClick={resetForm}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>اسم القسم</th>
              <th>الكلية</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d, i) => (
              <tr key={d.id}>
                <td>{i + 1}</td>
                <td>{d.name}</td>
                <td>{d.college_name}</td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(d)}>✏️</button>
                  <button className="btn-delete" onClick={() => handleDelete(d.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ========== واجهة التخصصات ==========
  const renderMajors = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h3>🎓 التخصصات</h3>
        <button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }}>
          ➕ إضافة تخصص
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <select
            value={formData.department_id}
            onChange={e => setFormData({ ...formData, department_id: e.target.value })}
          >
            <option value="">اختر القسم</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} - {d.college_name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="اسم التخصص"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="الرسوم"
            value={formData.fees}
            onChange={e => setFormData({ ...formData, fees: e.target.value })}
          />
          <input
            type="text"
            placeholder="المدة"
            value={formData.duration}
            onChange={e => setFormData({ ...formData, duration: e.target.value })}
          />
          <div className="form-actions">
            <button className="btn-save" onClick={handleSave}>💾 حفظ</button>
            <button className="btn-cancel" onClick={resetForm}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>التخصص</th>
              <th>القسم</th>
              <th>الكلية</th>
              <th>الرسوم</th>
              <th>المدة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {majors.map((m, i) => (
              <tr key={m.id}>
                <td>{i + 1}</td>
                <td>{m.name}</td>
                <td>{m.department_name}</td>
                <td>{m.college_name}</td>
                <td>{m.fees} ريال</td>
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
    </div>
  );

  // ========== واجهة الطلاب ==========
  const renderStudents = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h3>👥 الطلاب</h3>
        <div className="tab-actions">
          <input
            type="text"
            placeholder="🔍 بحث عن طالب..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button className="btn-add" onClick={() => { resetForm(); setShowForm(true); }}>
            ➕ إضافة طالب
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-card">
          <div className="form-row">
            <input
              type="text"
              placeholder="الرقم الجامعي"
              value={formData.university_id}
              onChange={e => setFormData({ ...formData, university_id: e.target.value })}
            />
            <input
              type="text"
              placeholder="الاسم الرباعي"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="رقم الجوال"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
            />
            <input
              type="text"
              placeholder="رقم ولي الأمر"
              value={formData.parent_phone}
              onChange={e => setFormData({ ...formData, parent_phone: e.target.value })}
            />
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="الرقم الوطني"
              value={formData.national_id}
              onChange={e => setFormData({ ...formData, national_id: e.target.value })}
            />
            <select
              value={formData.major_id}
              onChange={e => setFormData({ ...formData, major_id: e.target.value })}
            >
              <option value="">اختر التخصص</option>
              {majors.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="المستوى الدراسي"
              value={formData.level}
              onChange={e => setFormData({ ...formData, level: e.target.value })}
            />
            <input
              type="text"
              placeholder="الشعبة"
              value={formData.group_name}
              onChange={e => setFormData({ ...formData, group_name: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button className="btn-save" onClick={handleSave}>💾 حفظ</button>
            <button className="btn-cancel" onClick={resetForm}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الرقم الجامعي</th>
              <th>الاسم</th>
              <th>التخصص</th>
              <th>المستوى</th>
              <th>الجوال</th>
              <th>QR</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>{s.university_id}</td>
                <td>{s.full_name}</td>
                <td>{s.major_name}</td>
                <td>{s.level}</td>
                <td>{s.phone}</td>
                <td>
                  <button className="btn-qr" onClick={() => printCard(s)}>📱</button>
                </td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(s)}>✏️</button>
                  <button className="btn-delete" onClick={() => handleDelete(s.id)}>🗑️</button>
                  <button className="btn-print" onClick={() => printCard(s)}>🖨️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="students-module">
      {/* تبويبات */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'colleges' ? 'active' : ''}`} onClick={() => { setTab('colleges'); loadColleges(); }}>
          🏫 الكليات
        </button>
        <button className={`tab-btn ${tab === 'departments' ? 'active' : ''}`} onClick={() => { setTab('departments'); loadDepartments(); }}>
          📂 الأقسام
        </button>
        <button className={`tab-btn ${tab === 'majors' ? 'active' : ''}`} onClick={() => { setTab('majors'); loadMajors(); }}>
          🎓 التخصصات
        </button>
        <button className={`tab-btn ${tab === 'students' ? 'active' : ''}`} onClick={() => { setTab('students'); loadStudents(); }}>
          👥 الطلاب
        </button>
      </div>

      {/* المحتوى */}
      {tab === 'colleges' && renderColleges()}
      {tab === 'departments' && renderDepartments()}
      {tab === 'majors' && renderMajors()}
      {tab === 'students' && renderStudents()}
    </div>
  );
}

export default Students;
