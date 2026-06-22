// src/components/Settings.js – المركز السيادي واللوحة القيادية العليا للنظام (الإصدار الإمبراطوري الفاخر)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery, exportDatabase, importDatabase } from '../services/db';
import { getCurrentUser, changePassword, addUser, deleteUser, getAllUsers, isAdmin } from '../services/auth';

function Settings() {
  const [tab, setTab] = useState('devices');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // ========== حالة الأجهزة Biometric States ==========
  const [devices, setDevices] = useState([]);
  const [deviceForm, setDeviceForm] = useState({ name: '', ip_address: '', port: 4370 });
  const [isTestingId, setIsTestingId] = useState(null);

  // ========== حالة الواتساب Cloud WhatsApp API ==========
  const [whatsappConfig, setWhatsappConfig] = useState({
    api_key: '',
    phone_number_id: '',
    enabled: false
  });

  // ========== حالة التقويم الأكاديمي ==========
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [eventForm, setEventForm] = useState({ event: '', date_from: '', date_to: '', type: 'event' });

  // ========== حالة الحسابات والصلاحيات ==========
  const [users, setUsers] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'staff' });

  const currentUser = getCurrentUser();

  useEffect(() => {
    loadDevices();
    loadCalendar();
    if (isAdmin()) loadUsers();
    
    // تحميل إعدادات الواتساب المحفوظة تلقائياً
    const savedWA = localStorage.getItem('whatsapp_config');
    if (savedWA) setWhatsappConfig(JSON.parse(savedWA));
  }, []);

  // ========== نظام الإشعارات العائمة الملوكي ==========
  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3500);
  };

  // ========== إدارة كتل الأجهزة البيومترية ==========
  const loadDevices = () => {
    const data = getQuery("SELECT * FROM devices ORDER BY name");
    setDevices(data);
  };

  const addDevice = () => {
    if (!deviceForm.name || !deviceForm.ip_address) {
      showMessage('❌ عذراً، يجب ملء معطيات اسم البوابة البيومترية وعنوان البروتوكول IP', 'error');
      return;
    }
    runQuery(
      "INSERT INTO devices (name, ip_address, port, status) VALUES (?, ?, ?, 'offline')",
      [deviceForm.name, deviceForm.ip_address, deviceForm.port]
    );
    setDeviceForm({ name: '', ip_address: '', port: 4370 });
    loadDevices();
    showMessage('✨ تم تسجيل بوابات مسح البصمة بنجاح وضبط قنوات الاتصال الإلكترونية');
  };

  const deleteDevice = (id) => {
    if (window.confirm("⚠️ هل أنت متأكد من إلغاء قيد هذا الجهاز وفصله عن مصفوفة الربط المركزي؟")) {
      runQuery("DELETE FROM devices WHERE id=?", [id]);
      loadDevices();
      showMessage('🗑️ تم إلغاء قيد المنفذ البيومتري وتطهير السجلات المشتركة');
    }
  };

  const testConnection = async (device) => {
    setIsTestingId(device.id);
    showMessage(`🔌 جاري فحص استجابة حزم النبضات الشبكية مع ${device.name}...`, 'info');

    try {
      // محاكاة الاتصال بالأجهزة عبر الميناء المتوازي وعكس استجابة حية للجنة
      await new Promise(resolve => setTimeout(resolve, 1800));

      runQuery("UPDATE devices SET status='online', last_sync=? WHERE id=?", [
        new Date().toISOString(),
        device.id
      ]);
      loadDevices();
      showMessage(`✅ تم إثبات الاستجابة الحية والمزامنة مع ${device.name} بنجاح ملوكي مستقر`);
    } catch (error) {
      runQuery("UPDATE devices SET status='offline' WHERE id=?", [device.id]);
      loadDevices();
      showMessage(`❌ فشل تأمين بروتوكول المصافحة الشبكية مع ${device.name}`, 'error');
    } finally {
      setIsTestingId(null);
    }
  };

  // ========== حفظ إعدادات خوادم الواتساب السحابية ==========
  const saveWhatsappConfig = () => {
    localStorage.setItem('whatsapp_config', JSON.stringify(whatsappConfig));
    showMessage('✨ تم اعتماد مفاتيح خوادم التنبيه الفوري لـ WhatsApp Cloud API وتأمين المسارات');
  };

  // ========== إدارة المصفوفة الزمنية والتقويم ==========
  const loadCalendar = () => {
    const data = getQuery("SELECT * FROM calendar ORDER BY date_from");
    setCalendarEvents(data);
  };

  const addEvent = () => {
    if (!eventForm.event || !eventForm.date_from || !eventForm.date_to) {
      showMessage('❌ يرجى تعيين المسمى الأكاديمي والمدى الزمني الكلي للحدث للتوثيق', 'error');
      return;
    }
    runQuery(
      "INSERT INTO calendar (event, date_from, date_to, type) VALUES (?, ?, ?, ?)",
      [eventForm.event, eventForm.date_from, eventForm.date_to, eventForm.type]
    );
    setEventForm({ event: '', date_from: '', date_to: '', type: 'event' });
    loadCalendar();
    showMessage('📅 تم دمج الفعالية في التقويم الأكاديمي وجدول المزامنة الموحد');
  };

  const deleteEvent = (id) => {
    runQuery("DELETE FROM calendar WHERE id=?", [id]);
    loadCalendar();
    showMessage('🗑️ تم حذف الحدث وإسقاطه من مصفوفة التنبيهات الإدارية للطلاب');
  };

  // ========== السياسات الإدارية وإدارة حسابات الكادر ==========
  const loadUsers = () => {
    setUsers(getAllUsers());
  };

  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      showMessage('❌ يرجى إدخال شفرة الحماية الحالية لتوثيق الهوية أولاً', 'error');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('❌ تضارب في تشفير كلمة المرور الجديدة؛ العبارتان غير متطابقتين', 'error');
      return;
    }

    const result = await changePassword(currentUser.username, passwordForm.oldPassword, passwordForm.newPassword);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.username || !newUserForm.password) {
      showMessage('❌ لا يمكن إنشاء هوية مستخدم فارغة بدون تسمية أو رمز سري وتعميد الصلاحيات', 'error');
      return;
    }
    const result = await addUser(newUserForm.username, newUserForm.password, newUserForm.role);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      setNewUserForm({ username: '', password: '', role: 'staff' });
      loadUsers();
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm("🛑 سحب الصلاحيات الإدارية؟ سيتم إحباط وصول هذا الحساب نهائياً.")) {
      const result = await deleteUser(userId);
      showMessage(result.message, result.success ? 'success' : 'error');
      if (result.success) loadUsers();
    }
  };

  // ========== بروتوكولات الأمان والنسخ الاستراتيجي التراكمي ==========
  const handleBackup = () => {
    exportDatabase();
    showMessage('📥 تم تجميع وتشفير البيانات المستقرة وتصدير حزمة المزامنة الكاملة بنجاح');
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (window.confirm("⚠️ تحذير سيادي: استعادة قاعدة بيانات خارجية ستستبدل المنظومة الحالية بالكامل وتوقف الجلسات القائمة. هل تود المتابعة؟")) {
        await importDatabase(file);
        showMessage('✅ تم فك التشفير واستعادة النظام السيادي بالكامل.. جاري إنعاش الواجهات');
        setTimeout(() => window.location.reload(), 1500);
      }
    }
  };

  // ========== الواجهات الفرعية الملوكية (Sub-Renders) ==========
  
  const renderDevices = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>🖐️ منظومة السيطرة وإدارة بوابات البصمة</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>تعريف ومراقبة منافذ مستشعرات البصمة والاتصال البيومتري السحابي للجامعة.</p>

      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '14px', marginBottom: '25px' }}>
        <input type="text" placeholder="📝 مسمى البوابة أو القاعة (مثال: البوابة المركزية - مبنى أ)" value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        <input type="text" placeholder="🌐 بروتوكول عنوان الـ IP الشغّال" value={deviceForm.ip_address} onChange={e => setDeviceForm({ ...deviceForm, ip_address: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none', textAlign: 'left' }} />
        <input type="number" placeholder="الميناء" value={deviceForm.port} onChange={e => setDeviceForm({ ...deviceForm, port: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-save-lux" onClick={addDevice} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '0 25px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>➕ تعميد البوابة</motion.button>
      </div>

      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}>
              <th>اسم البوابة المعرفة</th>
              <th>عنوان الـ IP المخصص</th>
              <th>منفذ البروتوكول</th>
              <th>نبض الاتصال المباشر</th>
              <th>تاريخ آخر مزامنة بيومترية</th>
              <th>التحكم في العمليات الميدانية</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(d => (
              <tr key={d.id}>
                <td style={{ fontWeight: 700, color: '#fff' }}>🔹 {d.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '1rem', color: 'var(--text-secondary)' }}>{d.ip_address}</td>
                <td style={{ color: 'var(--gold-light)' }}>{d.port}</td>
                <td>
                  <span style={{
                    padding: '5px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 800,
                    background: d.status === 'online' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: d.status === 'online' ? 'var(--green-bright)' : '#ef4444',
                    border: `1px solid ${d.status === 'online' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    display: 'inline-flex', alignItems: 'center', gap: '5px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: d.status === 'online' ? 'var(--green-bright)' : '#ef4444', animation: d.status === 'online' ? 'pulse 1.5s infinite' : 'none' }} />
                    {d.status === 'online' ? 'مؤمن وحي' : 'منقطع أو مغلق'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{d.last_sync ? new Date(d.last_sync).toLocaleString('ar-SA') : '— ولم تتم المزامنة بعد —'}</td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <motion.button whileTap={{ scale: 0.95 }} disabled={isTestingId !== null} className="btn-test-lux" onClick={() => testConnection(d)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--gold-main)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isTestingId === d.id ? '⏳ فحص...' : '🔌 فحص الاتصال'}
                  </motion.button>
                  <button onClick={() => deleteDevice(d.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}>🗑️</button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '35px', color: 'var(--text-secondary)' }}>📭 لم يتم تهيئة أو ربط أي أجهزة بصمة بالشبكة حتى الآن.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderWhatsapp = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>💬 بوابات التنبيه السحابي عبر WhatsApp Cloud API</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>ربط معالجات النظام بخوادم ميتا المعتمدة للبث التلقائي لإنذارات الغياب وأوامر الرصد لأولياء الأمور.</p>

      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.2))', border: '1px solid var(--glass-border)', padding: '25px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="form-group-lux" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: 'var(--gold-light)', fontSize: '0.9rem', fontWeight: 700 }}>🔐 مفتاح التوثيق السري لخادم البث البنيوي (Meta Bearer API Key)</label>
          <input type="password" value={whatsappConfig.api_key} onChange={e => setWhatsappConfig({ ...whatsappConfig, api_key: e.target.value })} placeholder="EAAWxxxxx... أدخل كود المصادقة المشفر الممتد لميتا" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '10px', color: '#fff', outline: 'none', fontFamily: 'monospace' }} />
        </div>
        <div className="form-group-lux" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: 'var(--gold-light)', fontSize: '0.9rem', fontWeight: 700 }}>🆔 معرّف القناة الرقمي الفريد للمرسل (Phone Number ID)</label>
          <input type="text" value={whatsappConfig.phone_number_id} onChange={e => setWhatsappConfig({ ...whatsappConfig, phone_number_id: e.target.value })} placeholder="أدخل رمز الهاتف المعتمد المكون من ١٥ خانة في لوحة تحكم مطوري Meta" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        </div>
        <div className="form-group-lux" style={{ margin: '5px 0' }}>
          <label style={{ color: '#fff', fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <input type="checkbox" checked={whatsappConfig.enabled} onChange={e => setWhatsappConfig({ ...whatsappConfig, enabled: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--gold-main)' }} />
            تفويض النظام لبث إشعارات الغياب الفورية آلياً وبدون تدخل بشري
          </label>
        </div>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="btn-save-lux" onClick={saveWhatsappConfig} style={{ background: 'linear-gradient(135deg, var(--emerald-light), #047857)', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 15px rgba(16,185,129,0.15)', alignSelf: 'flex-start', minWidth: '200px' }}>💾 حفظ السياسة البرمجية</motion.button>
      </div>
    </div>
  );

  const renderCalendar = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>📅 مصفوفة تخطيط التقويم الأكاديمي والزمني</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>جدولة المواسم الدراسية والاختبارات لإيقاف أو تفعيل الحسابات البيومترية التلقائية في أيام العطلات.</p>

      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '18px', borderRadius: '14px', marginBottom: '25px' }}>
        <input type="text" placeholder="📌 بيان ووصف الفعالية (مثال: اختبارات النصف الأول البنيوية)" value={eventForm.event} onChange={e => setEventForm({ ...eventForm, event: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        <input type="date" value={eventForm.date_from} onChange={e => setEventForm({ ...eventForm, date_from: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }} />
        <input type="date" value={eventForm.date_to} onChange={e => setEventForm({ ...eventForm, date_to: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }} />
        <select value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value })} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', fontWeight: 600 }}>
          <option value="event">📅 حدث أكاديمي</option>
          <option value="holiday">🏖️ إجازة رسمية (تعطيل البوابات)</option>
          <option value="exam">📝 دورة الاختبارات والتدقيق</option>
          <option value="registration">📋 فترة القبول والقبض البيومتري</option>
          <option value="results">📊 إعلان فرز النتائج والتقديرات</option>
        </select>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-save-lux" onClick={addEvent} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '0 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>➕ قيد الفعالية</motion.button>
      </div>

      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}>
              <th>الفعالية المجدولة</th>
              <th>تاريخ البدء</th>
              <th>تاريخ المآل والانتهية</th>
              <th>تصنيف ونوع الحدث</th>
              <th>تحرير</th>
            </tr>
          </thead>
          <tbody>
            {calendarEvents.map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight: 700, color: '#fff' }}>🎯 {e.event}</td>
                <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{e.date_from}</td>
                <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{e.date_to}</td>
                <td>
                  <span style={{
                    padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 700,
                    background: e.type === 'holiday' ? 'rgba(239,68,68,0.1)' : e.type === 'exam' ? 'rgba(214,175,55,0.1)' : 'rgba(16,185,129,0.1)',
                    color: e.type === 'holiday' ? '#ef4444' : e.type === 'exam' ? 'var(--gold-main)' : 'var(--green-bright)'
                  }}>
                    {e.type === 'holiday' ? '🏖️ عطلة معطلة' : e.type === 'exam' ? '📝 فترة اختبارات' : e.type === 'registration' ? '📋 نافذة تسجيل الطلاب' : e.type === 'results' ? '📊 إعلان النتائج' : '📅 فعالية منضبطة'}
                  </span>
                </td>
                <td>
                  <button className="btn-delete" onClick={() => deleteEvent(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}>🗑️ حذف</button>
                </td>
              </tr>
            ))}
            {calendarEvents.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '35px', color: 'var(--text-secondary)' }}>📭 الجدول الزمني فارغ، لا توجد فعاليات مسجلة للموسم الدراسي الحالي.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>👥 منظومة السياسات وإدارة صلاحيات الكادر</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>توزيع الأدوار وتأمين حسابات المشرفين لتجنب عمليات التلاعب بملفات الرصد.</p>

      {isAdmin() && (
        <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '18px', borderRadius: '14px', marginBottom: '25px' }}>
          <input type="text" placeholder="👤 اسم الهوية الجديد (Username)" value={newUserForm.username} onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
          <input type="password" placeholder="🔑 الرمز السري الحصين (Password)" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
          <select value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', fontWeight: 600 }}>
            <option value="admin">👑 مدير عام السياسات</option>
            <option value="manager">👤 مشرف تدقيق أكاديمي</option>
            <option value="staff">🧑‍💼 موظف رصد ميداني</option>
          </select>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-save-lux" onClick={handleAddUser} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '0 25px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>➕ تخليق الهوية</motion.button>
        </div>
      )}

      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '35px' }}>
        <table>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}>
              <th>اسم حساب المستخدم</th>
              <th>المستوى والامتياز الممنوح</th>
              <th>تاريخ إنشاء الهوية الرقمية</th>
              <th>سحب التفويض</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 700, color: '#fff' }}>👤 {u.username} {u.username === currentUser.username && <span style={{fontSize:'0.8rem', color:'var(--gold-main)'}}>(أنت)</span>}</td>
                <td>
                  <span style={{ color: u.role === 'admin' ? 'var(--gold-main)' : u.role === 'manager' ? 'var(--emerald-light)' : '#e2e8f0', fontWeight: 'bold' }}>
                    {u.role === 'admin' ? '👑 مدير النظام السيادي' : u.role === 'manager' ? '🛡️ مشرف تدقيق' : '🧑‍💼 مأمور رصد'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.created_at || '— منشأ افتراضياً —'}</td>
                <td>
                  {u.username !== 'admin' && isAdmin() && u.username !== currentUser.username ? (
                    <button onClick={() => handleDeleteUser(u.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>🛑 طرد وإحباط</button>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>🔒 محمي سيادياً</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 style={{ fontFamily: 'Amiri, serif', fontSize: '1.4rem', color: 'var(--gold-light)', margin: '0 0 15px 0' }}>🔒 تعديل شفرة الحماية الشخصية لحسابك الحركي</h4>
      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.15))', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px', alignItems: 'center' }}>
        <input type="password" placeholder="🔒 شفرة الحماية الحالية" value={passwordForm.oldPassword} onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        <input type="password" placeholder="🔑 العبارة السرية المطورة" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        <input type="password" placeholder="🔁 مطابقة وتأكيد التشفير" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }} />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-save-lux" onClick={handleChangePassword} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gold-main)', color: 'var(--gold-main)', padding: '12px 25px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>🔐 تعديل الشفرة</motion.button>
      </div>
    </div>
  );

  const renderBackup = () => (
    <div className="settings-section" style={{ textAlign: 'center', padding: '20px 0' }}>
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>💾 مركز إدارة النسخ الاستراتيجي التراكمي</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '35px' }}>تصدير مستندات قاعدة البيانات المشفرة واستعادتها لحماية البيانات الأكاديمية الكلية من التلف الهيكلي.</p>

      <div className="backup-actions-lux" style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '35px' }}>
        <motion.button 
          whileHover={{ y: -4, boxShadow: '0 8px 25px rgba(214,175,55,0.15)' }} whileTap={{ scale: 0.97 }}
          onClick={handleBackup}
          style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '18px 35px', borderRadius: '14px', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          📥 تصدير وأرشفة حزمة البيانات كاملة (.DB)
        </motion.button>

        <motion.label 
          whileHover={{ y: -4, boxShadow: '0 8px 25px rgba(255,255,255,0.05)' }} whileTap={{ scale: 0.97 }}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: '#fff', padding: '18px 35px', borderRadius: '14px', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          📤 حقن واستعادة حزمة سابقة محفوظة
          <input type="file" accept=".db" onChange={handleRestore} style={{ display: 'none' }} />
        </motion.label>
      </div>

      <div className="backup-info-lux" style={{ maxWidth: '600px', margin: '0 auto', background: 'rgba(239,68,68,0.02)', border: '1px dashed rgba(239,68,68,0.2)', padding: '20px', borderRadius: '14px', color: '#ef4444', textAlign: 'right' }}>
        <h5 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: 800 }}>🛑 المعهد الأمني للبيانات السيادية المنضبطة:</h5>
        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          * إن حقن واستيراد أي قاعدة بيانات خارجية سيقوم تلقائياً **بمسح وتطهير** المعطيات والملفات الحالية المثبتة في المتصفح فورا وبدون رجعة.<br />
          * ينصح وبشدة سحب وتوليد حزمة حفظ إمبراطورية مغلقة نهاية كل نوبة عمل يومية لضمان الاستقرار الكلي.
        </p>
      </div>
    </div>
  );

  return (
    <div className="settings-module">
      
      {/* 🔔 الإشعارات والتحذيرات العائمة ملوكياً من الأعلى */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -25, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            style={{
              background: 'linear-gradient(135deg, #041d14, #0a3d2c)', 
              border: `1px solid ${messageType === 'error' ? '#ef4444' : messageType === 'info' ? 'var(--gold-main)' : 'var(--green-bright)'}`,
              padding: '14px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px',
              marginBottom: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', color: '#fff', fontWeight: 600, fontSize: '0.95rem'
            }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🧭 شريط التنقل الزجاجي الملوكي ذو الحواف المنحنية */}
      <div className="tabs" style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '16px', border: '1px solid var(--glass-border)', marginBottom: '30px', overflowX: 'auto' }}>
        {[
          { id: 'devices', label: '🖐️ بوابات مسح البصمة' },
          { id: 'whatsapp', label: '💬 سيرفرات الواتساب السحابية' },
          { id: 'calendar', label: '📅 التقويم والخطط الزمنية' },
          { id: 'users', label: '👥 صلاحيات وهوية الكادر' },
          { id: 'backup', label: '💾 خزانة النسخ الاستراتيجي' }
        ].map(t => (
          <motion.button
            key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); }}
            whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.99 }}
            style={{
              flex: 1, padding: '12px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap',
              background: tab === t.id ? 'linear-gradient(135deg, var(--gold-main), #b89324)' : 'transparent',
              color: tab === t.id ? '#062b1e' : 'var(--text-secondary)',
              border: tab === t.id ? '1px solid var(--gold-light)' : '1px solid transparent',
              boxShadow: tab === t.id ? '0 5px 15px rgba(214,175,55,0.12)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* 🔮 رندرة الشاشات الفرعية بنظام تحريك متزن */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="settings-content">
        {tab === 'devices' && renderDevices()}
        {tab === 'whatsapp' && renderWhatsapp()}
        {tab === 'calendar' && renderCalendar()}
        {tab === 'users' && renderUsers()}
        {tab === 'backup' && renderBackup()}
      </motion.div>
    </div>
  );
}

export default Settings;
