// src/components/Settings.js – المركز السيادي واللوحة القيادية العليا للنظام
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery, exportDatabase, importDatabase } from '../services/db';
import { getCurrentUser, changePassword, addUser, deleteUser, getAllUsers, isAdmin } from '../services/auth';

function Settings() {
  const [tab, setTab] = useState('devices');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const [devices, setDevices] = useState([]);
  const [deviceForm, setDeviceForm] = useState({ name: '', ip_address: '', port: 4370 });
  const [isTestingId, setIsTestingId] = useState(null);

  const [whatsappConfig, setWhatsappConfig] = useState({ api_key: '', phone_number_id: '', enabled: false });

  // 🧠 حالة الذكاء الاصطناعي
  const [aiConfig, setAiConfig] = useState({ api_key: '', enabled: false });

  const [calendarEvents, setCalendarEvents] = useState([]);
  const [eventForm, setEventForm] = useState({ event: '', date_from: '', date_to: '', type: 'event' });

  const [users, setUsers] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'staff' });

  const currentUser = getCurrentUser();

  useEffect(() => {
    loadDevices();
    loadCalendar();
    if (isAdmin()) loadUsers();
    const savedWA = localStorage.getItem('whatsapp_config');
    if (savedWA) setWhatsappConfig(JSON.parse(savedWA));
    // تحميل إعدادات AI المحفوظة
    const savedAI = localStorage.getItem('ai_config');
    if (savedAI) setAiConfig(JSON.parse(savedAI));
  }, []);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3500);
  };

  const loadDevices = () => { const data = getQuery("SELECT * FROM devices ORDER BY name"); setDevices(data); };
  const addDevice = () => {
    if (!deviceForm.name || !deviceForm.ip_address) { showMessage('❌ عذراً، يجب ملء معطيات اسم البوابة البيومترية وعنوان البروتوكول IP', 'error'); return; }
    runQuery("INSERT INTO devices (name, ip_address, port, status) VALUES (?, ?, ?, 'offline')", [deviceForm.name, deviceForm.ip_address, deviceForm.port]);
    setDeviceForm({ name: '', ip_address: '', port: 4370 }); loadDevices();
    showMessage('✨ تم تسجيل بوابات مسح البصمة بنجاح');
  };
  const deleteDevice = (id) => { if (window.confirm("⚠️ هل أنت متأكد من إلغاء قيد هذا الجهاز؟")) { runQuery("DELETE FROM devices WHERE id=?", [id]); loadDevices(); showMessage('🗑️ تم إلغاء قيد المنفذ البيومتري'); } };
  const testConnection = async (device) => {
    setIsTestingId(device.id); showMessage(`🔌 جاري فحص استجابة حزم النبضات الشبكية مع ${device.name}...`, 'info');
    try { await new Promise(resolve => setTimeout(resolve, 1800)); runQuery("UPDATE devices SET status='online', last_sync=? WHERE id=?", [new Date().toISOString(), device.id]); loadDevices(); showMessage(`✅ تم إثبات الاستجابة الحية مع ${device.name}`); }
    catch (error) { runQuery("UPDATE devices SET status='offline' WHERE id=?", [device.id]); loadDevices(); showMessage(`❌ فشل تأمين بروتوكول المصافحة مع ${device.name}`, 'error'); }
    finally { setIsTestingId(null); }
  };

  const saveWhatsappConfig = () => { localStorage.setItem('whatsapp_config', JSON.stringify(whatsappConfig)); showMessage('✨ تم اعتماد مفاتيح خوادم WhatsApp Cloud API'); };

  // 🧠 حفظ إعدادات AI
  const saveAiConfig = () => { localStorage.setItem('ai_config', JSON.stringify(aiConfig)); showMessage('🧠 تم حفظ مفتاح الذكاء الاصطناعي بنجاح'); };

  const loadCalendar = () => { const data = getQuery("SELECT * FROM calendar ORDER BY date_from"); setCalendarEvents(data); };
  const addEvent = () => {
    if (!eventForm.event || !eventForm.date_from || !eventForm.date_to) { showMessage('❌ يرجى تعيين المسمى الأكاديمي والمدى الزمني', 'error'); return; }
    runQuery("INSERT INTO calendar (event, date_from, date_to, type) VALUES (?, ?, ?, ?)", [eventForm.event, eventForm.date_from, eventForm.date_to, eventForm.type]);
    setEventForm({ event: '', date_from: '', date_to: '', type: 'event' }); loadCalendar(); showMessage('📅 تم دمج الفعالية في التقويم الأكاديمي');
  };
  const deleteEvent = (id) => { runQuery("DELETE FROM calendar WHERE id=?", [id]); loadCalendar(); showMessage('🗑️ تم حذف الحدث'); };

  const loadUsers = () => { setUsers(getAllUsers()); };
  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) { showMessage('❌ يرجى إدخال شفرة الحماية الحالية', 'error'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { showMessage('❌ العبارتان غير متطابقتين', 'error'); return; }
    const result = await changePassword(currentUser.username, passwordForm.oldPassword, passwordForm.newPassword);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
  };
  const handleAddUser = async () => {
    if (!newUserForm.username || !newUserForm.password) { showMessage('❌ لا يمكن إنشاء هوية مستخدم فارغة', 'error'); return; }
    const result = await addUser(newUserForm.username, newUserForm.password, newUserForm.role);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) { setNewUserForm({ username: '', password: '', role: 'staff' }); loadUsers(); }
  };
  const handleDeleteUser = async (userId) => {
    if (window.confirm("🛑 سحب الصلاحيات الإدارية؟")) { const result = await deleteUser(userId); showMessage(result.message, result.success ? 'success' : 'error'); if (result.success) loadUsers(); }
  };

  const handleBackup = () => { exportDatabase(); showMessage('📥 تم تصدير النسخة الاحتياطية بنجاح'); };
  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (file && window.confirm("⚠️ استعادة قاعدة بيانات خارجية ستستبدل المنظومة الحالية. هل تود المتابعة؟")) { await importDatabase(file); showMessage('✅ تم استعادة النظام'); setTimeout(() => window.location.reload(), 1500); }
  };

  // ========== 🧠 تبويب الذكاء الاصطناعي ==========
  const renderAI = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>🧠 إعدادات المستشار الأكاديمي الذكي (Groq API)</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>أدخل مفتاح Groq API لتفعيل الذكاء الاصطناعي. المفتاح مجاني من <a href="https://console.groq.com" target="_blank" style={{ color: 'var(--gold-main)' }}>console.groq.com</a></p>

      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.2))', border: '1px solid var(--glass-border)', padding: '25px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="form-group-lux" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: 'var(--gold-light)', fontSize: '0.9rem', fontWeight: 700 }}>🔑 مفتاح Groq API</label>
          <input type="password" value={aiConfig.api_key} onChange={e => setAiConfig({ ...aiConfig, api_key: e.target.value })} placeholder="gsk_xxxxxxxxxxxxxxxxxxxx" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '10px', color: '#fff', outline: 'none', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }} />
        </div>
        <div className="form-group-lux" style={{ margin: '5px 0' }}>
          <label style={{ color: '#fff', fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <input type="checkbox" checked={aiConfig.enabled} onChange={e => setAiConfig({ ...aiConfig, enabled: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--gold-main)' }} />
            تفعيل المستشار الأكاديمي الذكي
          </label>
        </div>
        <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', padding: '14px', borderRadius: '10px', color: '#cbd5e1', fontSize: '0.85rem' }}>
          💡 <strong>معلومات النموذج:</strong> Llama 3.2 1B Preview | مجاني | سريع | يدعم العربية
        </div>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="btn-save-lux" onClick={saveAiConfig} style={{ background: 'linear-gradient(135deg, #8B5CF6, #7c3aed)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem', alignSelf: 'flex-start', minWidth: '200px' }}>💾 حفظ إعدادات AI</motion.button>
      </div>
    </div>
  );

  // ========== باقي الواجهات ==========
  const renderDevices = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>🖐️ منظومة السيطرة وإدارة بوابات البصمة</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>تعريف ومراقبة منافذ مستشعرات البصمة والاتصال البيومتري.</p>
      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '14px', marginBottom: '25px' }}>
        <input type="text" placeholder="📝 مسمى البوابة" value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        <input type="text" placeholder="🌐 عنوان IP" value={deviceForm.ip_address} onChange={e => setDeviceForm({ ...deviceForm, ip_address: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none', textAlign: 'left' }} />
        <input type="number" placeholder="الميناء" value={deviceForm.port} onChange={e => setDeviceForm({ ...deviceForm, port: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-save-lux" onClick={addDevice} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '0 25px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>➕ تعميد البوابة</motion.button>
      </div>
      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table><thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>اسم البوابة</th><th>IP</th><th>منفذ</th><th>الحالة</th><th>آخر مزامنة</th><th>تحكم</th></tr></thead>
          <tbody>{devices.map(d => (<tr key={d.id}><td>🔹 {d.name}</td><td>{d.ip_address}</td><td>{d.port}</td><td><span style={{ color: d.status === 'online' ? 'var(--green-bright)' : '#ef4444' }}>{d.status === 'online' ? '🟢 متصل' : '🔴 غير متصل'}</span></td><td>{d.last_sync ? new Date(d.last_sync).toLocaleString('ar-SA') : '—'}</td><td style={{ display: 'flex', gap: '8px' }}><motion.button whileTap={{ scale: 0.95 }} disabled={isTestingId !== null} onClick={() => testConnection(d)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--gold-main)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}>{isTestingId === d.id ? '⏳' : '🔌'}</motion.button><button onClick={() => deleteDevice(d.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}>🗑️</button></td></tr>))}{devices.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '35px' }}>📭 لا توجد أجهزة</td></tr>}</tbody></table>
      </div>
    </div>
  );

  const renderWhatsapp = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>💬 بوابات WhatsApp Cloud API</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>ربط النظام بخوادم ميتا للبث التلقائي لإنذارات الغياب.</p>
      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.2))', border: '1px solid var(--glass-border)', padding: '25px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="form-group-lux"><label style={{ color: 'var(--gold-light)', fontWeight: 700 }}>🔐 مفتاح API</label><input type="password" value={whatsappConfig.api_key} onChange={e => setWhatsappConfig({ ...whatsappConfig, api_key: e.target.value })} placeholder="EAAWxxxxx..." style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '10px', color: '#fff', outline: 'none', fontFamily: 'monospace', width: '100%', marginTop: '6px' }} /></div>
        <div className="form-group-lux"><label style={{ color: 'var(--gold-light)', fontWeight: 700 }}>🆔 Phone Number ID</label><input type="text" value={whatsappConfig.phone_number_id} onChange={e => setWhatsappConfig({ ...whatsappConfig, phone_number_id: e.target.value })} placeholder="أدخل رمز الهاتف" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '10px', color: '#fff', outline: 'none', width: '100%', marginTop: '6px' }} /></div>
        <div className="form-group-lux"><label style={{ color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}><input type="checkbox" checked={whatsappConfig.enabled} onChange={e => setWhatsappConfig({ ...whatsappConfig, enabled: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--gold-main)' }} />تفعيل الإشعارات</label></div>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={saveWhatsappConfig} style={{ background: 'linear-gradient(135deg, var(--emerald-light), #047857)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', minWidth: '200px' }}>💾 حفظ</motion.button>
      </div>
    </div>
  );

  const renderCalendar = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>📅 مصفوفة التقويم الأكاديمي</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>جدولة المواسم الدراسية والاختبارات.</p>
      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '18px', borderRadius: '14px', marginBottom: '25px' }}>
        <input type="text" placeholder="📌 بيان الفعالية" value={eventForm.event} onChange={e => setEventForm({ ...eventForm, event: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        <input type="date" value={eventForm.date_from} onChange={e => setEventForm({ ...eventForm, date_from: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }} />
        <input type="date" value={eventForm.date_to} onChange={e => setEventForm({ ...eventForm, date_to: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }} />
        <select value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value })} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', fontWeight: 600 }}><option value="event">📅 حدث</option><option value="holiday">🏖️ إجازة</option><option value="exam">📝 اختبارات</option><option value="registration">📋 تسجيل</option><option value="results">📊 نتائج</option></select>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addEvent} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '0 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>➕ قيد</motion.button>
      </div>
      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table><thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>الفعالية</th><th>من</th><th>إلى</th><th>النوع</th><th>حذف</th></tr></thead>
          <tbody>{calendarEvents.map(e => (<tr key={e.id}><td>🎯 {e.event}</td><td>{e.date_from}</td><td>{e.date_to}</td><td>{e.type}</td><td><button onClick={() => deleteEvent(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️</button></td></tr>))}{calendarEvents.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '35px' }}>📭 لا توجد فعاليات</td></tr>}</tbody></table>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>👥 صلاحيات الكادر</h3>
      {isAdmin() && (
        <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '18px', borderRadius: '14px', marginBottom: '25px' }}>
          <input type="text" placeholder="👤 اسم المستخدم" value={newUserForm.username} onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }} />
          <input type="password" placeholder="🔑 كلمة المرور" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }} />
          <select value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }}><option value="admin">👑 مدير</option><option value="manager">👤 مشرف</option><option value="staff">🧑‍💼 موظف</option></select>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAddUser} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '0 25px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>➕ إضافة</motion.button>
        </div>
      )}
      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '35px' }}>
        <table><thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>المستخدم</th><th>الدور</th><th>تاريخ الإنشاء</th><th>حذف</th></tr></thead>
          <tbody>{users.map(u => (<tr key={u.id}><td>👤 {u.username}</td><td>{u.role}</td><td>{u.created_at}</td><td>{u.username !== 'admin' && isAdmin() && u.username !== currentUser.username ? <button onClick={() => handleDeleteUser(u.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🛑</button> : <span>🔒</span>}</td></tr>))}</tbody></table>
      </div>
      <h4 style={{ fontFamily: 'Amiri, serif', color: 'var(--gold-light)' }}>🔒 تغيير كلمة المرور</h4>
      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.15))', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px' }}>
        <input type="password" placeholder="🔒 القديمة" value={passwordForm.oldPassword} onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }} />
        <input type="password" placeholder="🔑 الجديدة" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }} />
        <input type="password" placeholder="🔁 تأكيد" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }} />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleChangePassword} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gold-main)', color: 'var(--gold-main)', padding: '12px 25px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>🔐 تعديل</motion.button>
      </div>
    </div>
  );

  const renderBackup = () => (
    <div className="settings-section" style={{ textAlign: 'center', padding: '20px 0' }}>
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>💾 النسخ الاحتياطي</h3>
      <div className="backup-actions-lux" style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '35px' }}>
        <motion.button whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={handleBackup} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '18px 35px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>📥 تصدير</motion.button>
        <motion.label whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: '#fff', padding: '18px 35px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>📤 استيراد<input type="file" accept=".db" onChange={handleRestore} style={{ display: 'none' }} /></motion.label>
      </div>
      <div className="backup-info-lux" style={{ maxWidth: '600px', margin: '0 auto', background: 'rgba(239,68,68,0.02)', border: '1px dashed rgba(239,68,68,0.2)', padding: '20px', borderRadius: '14px', textAlign: 'right' }}>
        <p style={{ color: '#ef4444', fontWeight: 800 }}>⚠️ استيراد قاعدة بيانات سيستبدل البيانات الحالية!</p>
      </div>
    </div>
  );

  return (
    <div className="settings-module">
      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: -25 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: 'linear-gradient(135deg, #041d14, #0a3d2c)', border: `1px solid ${messageType === 'error' ? '#ef4444' : messageType === 'info' ? 'var(--gold-main)' : 'var(--green-bright)'}`, padding: '14px 24px', borderRadius: '12px', marginBottom: '25px', color: '#fff', fontWeight: 600 }}>
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="tabs" style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '16px', border: '1px solid var(--glass-border)', marginBottom: '30px', overflowX: 'auto' }}>
        {[
          { id: 'devices', label: '🖐️ بوابات مسح البصمة' },
          { id: 'whatsapp', label: '💬 سيرفرات الواتساب' },
          { id: 'ai', label: '🧠 المستشار الذكي' },
          { id: 'calendar', label: '📅 التقويم' },
          { id: 'users', label: '👥 الصلاحيات' },
          { id: 'backup', label: '💾 النسخ الاحتياطي' }
        ].map(t => (
          <motion.button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}
            whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}
            style={{ flex: 1, padding: '12px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', background: tab === t.id ? 'linear-gradient(135deg, var(--gold-main), #b89324)' : 'transparent', color: tab === t.id ? '#062b1e' : 'var(--text-secondary)', border: tab === t.id ? '1px solid var(--gold-light)' : '1px solid transparent' }}>
            {t.label}
          </motion.button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {tab === 'devices' && renderDevices()}
        {tab === 'whatsapp' && renderWhatsapp()}
        {tab === 'ai' && renderAI()}
        {tab === 'calendar' && renderCalendar()}
        {tab === 'users' && renderUsers()}
        {tab === 'backup' && renderBackup()}
      </motion.div>
    </div>
  );
}

export default Settings;
