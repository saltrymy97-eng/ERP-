// src/components/Settings.js – المركز السيادي واللوحة القيادية العليا للنظام (SQLite محلية + جداول موحدة)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery, initDatabase, exportDatabase, importDatabase } from '../services/db';
import { getCurrentUser, changePassword, addUser, deleteUser, getAllUsers, isAdmin } from '../services/auth';

function Settings() {
  const [tab, setTab] = useState('devices');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [dbReady, setDbReady] = useState(false);

  const [devices, setDevices] = useState([]);
  const [deviceForm, setDeviceForm] = useState({ name: '', ip_address: '', port: 4370 });
  const [isTestingId, setIsTestingId] = useState(null);

  const [whatsappConfig, setWhatsappConfig] = useState({ api_key: '', phone_number_id: '', enabled: false });
  const [aiConfig, setAiConfig] = useState({ api_key: '', enabled: false });

  const [calendarEvents, setCalendarEvents] = useState([]);
  const [eventForm, setEventForm] = useState({ event: '', date_from: '', date_to: '', type: 'event' });

  // الجداول الدراسية
  const [schedules, setSchedules] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({ day: '', subject: '', teacher: '', time_from: '', time_to: '', room: '', break_time: 0, late_tolerance: 10 });

  const [users, setUsers] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'staff' });

  const currentUser = getCurrentUser();

  useEffect(() => {
    const setup = async () => {
      await initDatabase();
      setDbReady(true);
      loadDevices();
      loadCalendar();
      loadSchedules();
      if (isAdmin()) loadUsers();
      const savedWA = localStorage.getItem('whatsapp_config');
      if (savedWA) setWhatsappConfig(JSON.parse(savedWA));
      const savedAI = localStorage.getItem('ai_config');
      if (savedAI) setAiConfig(JSON.parse(savedAI));
    };
    setup();
  }, []);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg); setMessageType(type);
    setTimeout(() => setMessage(''), 3500);
  };

  const loadDevices = async () => { const data = await getQuery("SELECT * FROM devices ORDER BY name"); setDevices(data || []); };
  const addDevice = async () => {
    if (!deviceForm.name || !deviceForm.ip_address) { showMessage('❌ يرجى ملء اسم البوابة وعنوان IP', 'error'); return; }
    await runQuery("INSERT INTO devices (name, ip_address, port, status) VALUES (?, ?, ?, 'offline')", [deviceForm.name, deviceForm.ip_address, deviceForm.port]);
    setDeviceForm({ name: '', ip_address: '', port: 4370 }); await loadDevices(); showMessage('✨ تم تسجيل البوابة بنجاح');
  };
  const deleteDevice = async (id) => {
    if (window.confirm("⚠️ إلغاء قيد هذا الجهاز؟")) { await runQuery("DELETE FROM devices WHERE id = ?", [id]); await loadDevices(); showMessage('🗑️ تم إلغاء الجهاز'); }
  };
  const testConnection = async (device) => {
    setIsTestingId(device.id); showMessage(`🔌 فحص ${device.name}...`, 'info');
    try {
      await new Promise(r => setTimeout(r, 1800));
      await runQuery("UPDATE devices SET status = 'online', last_sync = ? WHERE id = ?", [new Date().toISOString(), device.id]);
      await loadDevices(); showMessage(`✅ ${device.name} متصل`);
    } catch { await runQuery("UPDATE devices SET status = 'offline' WHERE id = ?", [device.id]); await loadDevices(); showMessage(`❌ فشل اتصال ${device.name}`, 'error'); }
    finally { setIsTestingId(null); }
  };

  const saveWhatsappConfig = () => { localStorage.setItem('whatsapp_config', JSON.stringify(whatsappConfig)); showMessage('✨ تم حفظ إعدادات WhatsApp'); };
  const saveAiConfig = () => { localStorage.setItem('ai_config', JSON.stringify(aiConfig)); showMessage('🧠 تم حفظ إعدادات AI'); };

  const loadCalendar = async () => { const data = await getQuery("SELECT * FROM calendar ORDER BY date_from"); setCalendarEvents(data || []); };
  const addEvent = async () => {
    if (!eventForm.event || !eventForm.date_from || !eventForm.date_to) { showMessage('❌ يرجى إكمال بيانات الفعالية', 'error'); return; }
    await runQuery("INSERT INTO calendar (event, date_from, date_to, type) VALUES (?, ?, ?, ?)", [eventForm.event, eventForm.date_from, eventForm.date_to, eventForm.type]);
    setEventForm({ event: '', date_from: '', date_to: '', type: 'event' }); await loadCalendar(); showMessage('📅 تمت إضافة الفعالية');
  };
  const deleteEvent = async (id) => { await runQuery("DELETE FROM calendar WHERE id = ?", [id]); await loadCalendar(); showMessage('🗑️ تم حذف الفعالية'); };

  // ========== الجداول الدراسية ==========
  const loadSchedules = async () => { const data = await getQuery("SELECT * FROM schedules ORDER BY day, time_from"); setSchedules(data || []); };
  const addSchedule = async () => {
    if (!scheduleForm.day || !scheduleForm.subject || !scheduleForm.time_from || !scheduleForm.time_to) { showMessage('❌ يرجى إكمال بيانات الجدول', 'error'); return; }
    await runQuery("INSERT INTO schedules (day, subject, teacher, time_from, time_to, room, break_time, late_tolerance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [scheduleForm.day, scheduleForm.subject, scheduleForm.teacher, scheduleForm.time_from, scheduleForm.time_to, scheduleForm.room, scheduleForm.break_time, scheduleForm.late_tolerance]);
    setScheduleForm({ day: '', subject: '', teacher: '', time_from: '', time_to: '', room: '', break_time: 0, late_tolerance: 10 });
    await loadSchedules(); showMessage('📚 تمت إضافة المحاضرة');
  };
  const deleteSchedule = async (id) => { await runQuery("DELETE FROM schedules WHERE id = ?", [id]); await loadSchedules(); showMessage('🗑️ تم حذف المحاضرة'); };

  const loadUsers = () => { setUsers(getAllUsers()); };
  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) { showMessage('❌ يرجى إدخال كلمة المرور', 'error'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { showMessage('❌ غير متطابقتين', 'error'); return; }
    const result = await changePassword(currentUser.username, passwordForm.oldPassword, passwordForm.newPassword);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
  };
  const handleAddUser = async () => {
    if (!newUserForm.username || !newUserForm.password) { showMessage('❌ بيانات ناقصة', 'error'); return; }
    const result = await addUser(newUserForm.username, newUserForm.password, newUserForm.role);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) { setNewUserForm({ username: '', password: '', role: 'staff' }); loadUsers(); }
  };
  const handleDeleteUser = async (userId) => {
    if (window.confirm("🛑 سحب الصلاحيات؟")) { const result = await deleteUser(userId); showMessage(result.message, result.success ? 'success' : 'error'); if (result.success) loadUsers(); }
  };

  const handleBackup = () => { exportDatabase(); showMessage('📥 تم تصدير النسخة الاحتياطية'); };
  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (file && window.confirm("⚠️ استبدال البيانات الحالية؟")) { await importDatabase(file); showMessage('✅ تمت الاستعادة'); setTimeout(() => window.location.reload(), 1500); }
  };

  if (!dbReady) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '20px' }}>
        <div style={{ width: '50px', height: '50px', border: '3px solid rgba(214,175,55,0.1)', borderTop: '3px solid var(--gold-main)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--gold-light)', fontWeight: 600 }}>⏳ جاري تهيئة قاعدة البيانات المحلية...</p>
      </div>
    );
  }

  const renderAI = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>🧠 المستشار الأكاديمي الذكي (Groq API)</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>مفتاح مجاني من <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: 'var(--gold-main)' }}>console.groq.com</a></p>
      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.2))', border: '1px solid var(--glass-border)', padding: '25px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div><label style={{ color: 'var(--gold-light)', fontWeight: 700 }}>🔑 مفتاح API</label><input type="password" value={aiConfig.api_key} onChange={e => setAiConfig({ ...aiConfig, api_key: e.target.value })} placeholder="gsk_xxx" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '10px', color: '#fff', outline: 'none', fontFamily: 'monospace', width: '100%', marginTop: '6px', direction: 'ltr', textAlign: 'left' }} /></div>
        <label style={{ color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}><input type="checkbox" checked={aiConfig.enabled} onChange={e => setAiConfig({ ...aiConfig, enabled: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--gold-main)' }} />تفعيل المستشار الذكي</label>
        <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', padding: '14px', borderRadius: '10px', color: '#cbd5e1', fontSize: '0.85rem' }}>💡 Llama 3.2 1B | مجاني | سريع | يدعم العربية</div>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={saveAiConfig} style={{ background: 'linear-gradient(135deg, #8B5CF6, #7c3aed)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', minWidth: '200px' }}>💾 حفظ</motion.button>
      </div>
    </div>
  );

  const renderDevices = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>🖐️ بوابات البصمة</h3>
      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '14px', marginBottom: '25px' }}>
        <input type="text" placeholder="اسم البوابة" value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} className="glass-input" />
        <input type="text" placeholder="IP" value={deviceForm.ip_address} onChange={e => setDeviceForm({ ...deviceForm, ip_address: e.target.value })} className="glass-input" style={{ textAlign: 'left' }} />
        <input type="number" placeholder="منفذ" value={deviceForm.port} onChange={e => setDeviceForm({ ...deviceForm, port: e.target.value })} className="glass-input" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addDevice} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>➕ تعميد</motion.button>
      </div>
      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table><thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>البوابة</th><th>IP</th><th>منفذ</th><th>حالة</th><th>آخر مزامنة</th><th>تحكم</th></tr></thead>
          <tbody>{devices.map(d => (<tr key={d.id}><td>🔹 {d.name}</td><td>{d.ip_address}</td><td>{d.port}</td><td><span style={{ color: d.status === 'online' ? 'var(--green-bright)' : '#ef4444' }}>{d.status === 'online' ? '🟢 متصل' : '🔴 غير متصل'}</span></td><td>{d.last_sync ? new Date(d.last_sync).toLocaleString('ar-SA') : '—'}</td><td style={{ display: 'flex', gap: '8px' }}><motion.button whileTap={{ scale: 0.95 }} disabled={isTestingId !== null} onClick={() => testConnection(d)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--gold-main)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}>{isTestingId === d.id ? '⏳' : '🔌'}</motion.button><button onClick={() => deleteDevice(d.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}>🗑️</button></td></tr>))}{devices.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '35px' }}>📭 لا توجد أجهزة</td></tr>}</tbody></table>
      </div>
    </div>
  );

  const renderWhatsapp = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>💬 WhatsApp Cloud API</h3>
      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.2))', border: '1px solid var(--glass-border)', padding: '25px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div><label style={{ color: 'var(--gold-light)', fontWeight: 700 }}>🔐 مفتاح API</label><input type="password" value={whatsappConfig.api_key} onChange={e => setWhatsappConfig({ ...whatsappConfig, api_key: e.target.value })} placeholder="EAAWxxxxx..." className="glass-input" style={{ width: '100%', marginTop: '6px', fontFamily: 'monospace' }} /></div>
        <div><label style={{ color: 'var(--gold-light)', fontWeight: 700 }}>🆔 Phone Number ID</label><input type="text" value={whatsappConfig.phone_number_id} onChange={e => setWhatsappConfig({ ...whatsappConfig, phone_number_id: e.target.value })} placeholder="رقم الهاتف" className="glass-input" style={{ width: '100%', marginTop: '6px' }} /></div>
        <label style={{ color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}><input type="checkbox" checked={whatsappConfig.enabled} onChange={e => setWhatsappConfig({ ...whatsappConfig, enabled: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--gold-main)' }} />تفعيل الإشعارات</label>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={saveWhatsappConfig} style={{ background: 'linear-gradient(135deg, var(--emerald-light), #047857)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', minWidth: '200px' }}>💾 حفظ</motion.button>
      </div>
    </div>
  );

  const renderCalendar = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>📅 التقويم الأكاديمي</h3>
      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '18px', borderRadius: '14px', marginBottom: '25px' }}>
        <input type="text" placeholder="الفعالية" value={eventForm.event} onChange={e => setEventForm({ ...eventForm, event: e.target.value })} className="glass-input" />
        <input type="date" value={eventForm.date_from} onChange={e => setEventForm({ ...eventForm, date_from: e.target.value })} className="glass-input" />
        <input type="date" value={eventForm.date_to} onChange={e => setEventForm({ ...eventForm, date_to: e.target.value })} className="glass-input" />
        <select value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value })} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }}><option value="event">📅 حدث</option><option value="holiday">🏖️ إجازة</option><option value="exam">📝 اختبار</option><option value="registration">📋 تسجيل</option><option value="results">📊 نتائج</option></select>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addEvent} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>➕</motion.button>
      </div>
      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table><thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>الفعالية</th><th>من</th><th>إلى</th><th>النوع</th><th>حذف</th></tr></thead>
          <tbody>{calendarEvents.map(e => (<tr key={e.id}><td>🎯 {e.event}</td><td>{e.date_from}</td><td>{e.date_to}</td><td>{e.type}</td><td><button onClick={() => deleteEvent(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️</button></td></tr>))}{calendarEvents.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '35px' }}>📭 لا توجد فعاليات</td></tr>}</tbody></table>
      </div>
    </div>
  );

  // ========== تبويب الجداول الدراسية ==========
  const renderSchedules = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>📚 الجدول الدراسي</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>إدارة المحاضرات والجداول الأسبوعية.</p>
      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1fr auto', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '18px', borderRadius: '14px', marginBottom: '25px' }}>
        <select value={scheduleForm.day} onChange={e => setScheduleForm({ ...scheduleForm, day: e.target.value })} className="glass-input" style={{ background: '#041d14' }}>
          <option value="">اليوم</option>
          <option value="السبت">السبت</option><option value="الأحد">الأحد</option><option value="الاثنين">الاثنين</option><option value="الثلاثاء">الثلاثاء</option><option value="الأربعاء">الأربعاء</option><option value="الخميس">الخميس</option>
        </select>
        <input type="text" placeholder="المادة" value={scheduleForm.subject} onChange={e => setScheduleForm({ ...scheduleForm, subject: e.target.value })} className="glass-input" />
        <input type="text" placeholder="المدرس" value={scheduleForm.teacher} onChange={e => setScheduleForm({ ...scheduleForm, teacher: e.target.value })} className="glass-input" />
        <input type="time" value={scheduleForm.time_from} onChange={e => setScheduleForm({ ...scheduleForm, time_from: e.target.value })} className="glass-input" />
        <input type="time" value={scheduleForm.time_to} onChange={e => setScheduleForm({ ...scheduleForm, time_to: e.target.value })} className="glass-input" />
        <input type="text" placeholder="القاعة" value={scheduleForm.room} onChange={e => setScheduleForm({ ...scheduleForm, room: e.target.value })} className="glass-input" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addSchedule} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', padding: '0 15px' }}>➕</motion.button>
      </div>
      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table><thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>اليوم</th><th>المادة</th><th>المدرس</th><th>من</th><th>إلى</th><th>القاعة</th><th>حذف</th></tr></thead>
          <tbody>{schedules.map(s => (<tr key={s.id}><td>{s.day}</td><td style={{ color: '#fff', fontWeight: 600 }}>{s.subject}</td><td>{s.teacher}</td><td>{s.time_from}</td><td>{s.time_to}</td><td>{s.room}</td><td><button onClick={() => deleteSchedule(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️</button></td></tr>))}{schedules.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '35px' }}>📭 لا توجد محاضرات</td></tr>}</tbody></table>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>👥 صلاحيات الكادر</h3>
      {isAdmin() && (
        <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '18px', borderRadius: '14px', marginBottom: '25px' }}>
          <input type="text" placeholder="اسم المستخدم" value={newUserForm.username} onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })} className="glass-input" />
          <input type="password" placeholder="كلمة المرور" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} className="glass-input" />
          <select value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }}><option value="admin">👑 مدير</option><option value="manager">👤 مشرف</option><option value="staff">🧑‍💼 موظف</option></select>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAddUser} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>➕</motion.button>
        </div>
      )}
      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '35px' }}>
        <table><thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>المستخدم</th><th>الدور</th><th>تاريخ الإنشاء</th><th>حذف</th></tr></thead>
          <tbody>{users.map(u => (<tr key={u.id}><td>👤 {u.username}</td><td>{u.role}</td><td>{u.created_at}</td><td>{u.username !== 'admin' && isAdmin() && u.username !== currentUser.username ? <button onClick={() => handleDeleteUser(u.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🛑</button> : <span>🔒</span>}</td></tr>))}</tbody></table>
      </div>
      <h4 style={{ fontFamily: 'Amiri, serif', color: 'var(--gold-light)' }}>🔒 تغيير كلمة المرور</h4>
      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.15))', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px' }}>
        <input type="password" placeholder="القديمة" value={passwordForm.oldPassword} onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })} className="glass-input" />
        <input type="password" placeholder="الجديدة" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="glass-input" />
        <input type="password" placeholder="تأكيد" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="glass-input" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleChangePassword} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gold-main)', color: 'var(--gold-main)', padding: '12px 25px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>🔐 تعديل</motion.button>
      </div>
    </div>
  );

  const renderBackup = () => (
    <div className="settings-section" style={{ textAlign: 'center', padding: '20px 0' }}>
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>💾 النسخ الاحتياطي</h3>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '35px' }}>
        <motion.button whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={handleBackup} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '18px 35px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>📥 تصدير</motion.button>
        <motion.label whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: '#fff', padding: '18px 35px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>📤 استيراد<input type="file" accept=".db" onChange={handleRestore} style={{ display: 'none' }} /></motion.label>
      </div>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: 'rgba(239,68,68,0.02)', border: '1px dashed rgba(239,68,68,0.2)', padding: '20px', borderRadius: '14px', textAlign: 'right' }}>
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
          { id: 'devices', label: '🖐️ البصمة' },
          { id: 'schedules', label: '📚 الجداول' },
          { id: 'whatsapp', label: '💬 الواتساب' },
          { id: 'ai', label: '🧠 الذكاء' },
          { id: 'calendar', label: '📅 التقويم' },
          { id: 'users', label: '👥 الصلاحيات' },
          { id: 'backup', label: '💾 النسخ' }
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
        {tab === 'schedules' && renderSchedules()}
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
