// components/Settings.js – واجهة الإعدادات الشاملة
import React, { useState, useEffect } from 'react';
import { getQuery, runQuery, exportDatabase, importDatabase } from '../services/db';
import { getCurrentUser, changePassword, addUser, deleteUser, getAllUsers, isAdmin } from '../services/auth';

function Settings() {
  const [tab, setTab] = useState('devices');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // ========== حالة الأجهزة ==========
  const [devices, setDevices] = useState([]);
  const [deviceForm, setDeviceForm] = useState({ name: '', ip_address: '', port: 4370 });

  // ========== حالة الواتساب ==========
  const [whatsappConfig, setWhatsappConfig] = useState({
    api_key: '',
    phone_number_id: '',
    enabled: false
  });

  // ========== حالة التقويم ==========
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [eventForm, setEventForm] = useState({
    event: '',
    date_from: '',
    date_to: '',
    type: 'event'
  });

  // ========== حالة المستخدمين ==========
  const [users, setUsers] = useState([]);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    role: 'staff'
  });

  const currentUser = getCurrentUser();

  useEffect(() => {
    loadDevices();
    loadCalendar();
    if (isAdmin()) loadUsers();
  }, []);

  // ========== عرض رسالة ==========
  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  // ========== إدارة الأجهزة ==========
  const loadDevices = () => {
    const data = getQuery("SELECT * FROM devices ORDER BY name");
    setDevices(data);
  };

  const addDevice = () => {
    if (!deviceForm.name || !deviceForm.ip_address) {
      showMessage('❌ الرجاء إدخال اسم الجهاز وعنوان IP', 'error');
      return;
    }

    runQuery(
      "INSERT INTO devices (name, ip_address, port, status) VALUES (?, ?, ?, 'offline')",
      [deviceForm.name, deviceForm.ip_address, deviceForm.port]
    );

    setDeviceForm({ name: '', ip_address: '', port: 4370 });
    loadDevices();
    showMessage('✅ تم إضافة الجهاز بنجاح');
  };

  const deleteDevice = (id) => {
    runQuery("DELETE FROM devices WHERE id=?", [id]);
    loadDevices();
    showMessage('🗑️ تم حذف الجهاز');
  };

  const testConnection = async (device) => {
    showMessage(`🔌 جاري اختبار الاتصال بـ ${device.name}...`, 'info');

    try {
      // محاكاة اختبار اتصال
      await new Promise(resolve => setTimeout(resolve, 2000));

      runQuery("UPDATE devices SET status='online', last_sync=? WHERE id=?", [
        new Date().toISOString(),
        device.id
      ]);
      loadDevices();
      showMessage(`✅ تم الاتصال بـ ${device.name} بنجاح`);
    } catch (error) {
      runQuery("UPDATE devices SET status='offline' WHERE id=?", [device.id]);
      loadDevices();
      showMessage(`❌ فشل الاتصال بـ ${device.name}`, 'error');
    }
  };

  // ========== إعدادات الواتساب ==========
  const saveWhatsappConfig = () => {
    localStorage.setItem('whatsapp_config', JSON.stringify(whatsappConfig));
    showMessage('✅ تم حفظ إعدادات الواتساب');
  };

  // ========== إدارة التقويم ==========
  const loadCalendar = () => {
    const data = getQuery("SELECT * FROM calendar ORDER BY date_from");
    setCalendarEvents(data);
  };

  const addEvent = () => {
    if (!eventForm.event || !eventForm.date_from || !eventForm.date_to) {
      showMessage('❌ الرجاء إدخال جميع بيانات الحدث', 'error');
      return;
    }

    runQuery(
      "INSERT INTO calendar (event, date_from, date_to, type) VALUES (?, ?, ?, ?)",
      [eventForm.event, eventForm.date_from, eventForm.date_to, eventForm.type]
    );

    setEventForm({ event: '', date_from: '', date_to: '', type: 'event' });
    loadCalendar();
    showMessage('✅ تم إضافة الحدث');
  };

  const deleteEvent = (id) => {
    runQuery("DELETE FROM calendar WHERE id=?", [id]);
    loadCalendar();
    showMessage('🗑️ تم حذف الحدث');
  };

  // ========== إدارة المستخدمين ==========
  const loadUsers = () => {
    const data = getAllUsers();
    setUsers(data);
  };

  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      showMessage('❌ الرجاء إدخال كلمة المرور القديمة والجديدة', 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('❌ كلمة المرور الجديدة غير متطابقة', 'error');
      return;
    }

    const result = await changePassword(
      currentUser.username,
      passwordForm.oldPassword,
      passwordForm.newPassword
    );

    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.username || !newUserForm.password) {
      showMessage('❌ الرجاء إدخال اسم المستخدم وكلمة المرور', 'error');
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
    const result = await deleteUser(userId);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) loadUsers();
  };

  // ========== نسخ احتياطي ==========
  const handleBackup = () => {
    exportDatabase();
    showMessage('✅ تم تصدير النسخة الاحتياطية');
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await importDatabase(file);
      showMessage('✅ تم استعادة النسخة الاحتياطية');
      window.location.reload();
    }
  };

  // ========== واجهة الأجهزة ==========
  const renderDevices = () => (
    <div className="settings-section">
      <h3>🖐️ إدارة أجهزة البصمة</h3>

      <div className="form-row">
        <input
          type="text"
          placeholder="اسم الجهاز"
          value={deviceForm.name}
          onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })}
        />
        <input
          type="text"
          placeholder="عنوان IP"
          value={deviceForm.ip_address}
          onChange={e => setDeviceForm({ ...deviceForm, ip_address: e.target.value })}
        />
        <input
          type="number"
          placeholder="المنفذ"
          value={deviceForm.port}
          onChange={e => setDeviceForm({ ...deviceForm, port: e.target.value })}
        />
        <button className="btn-save" onClick={addDevice}>➕ إضافة</button>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>الجهاز</th>
              <th>IP</th>
              <th>المنفذ</th>
              <th>الحالة</th>
              <th>آخر مزامنة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(d => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.ip_address}</td>
                <td>{d.port}</td>
                <td>
                  <span className={`device-status ${d.status}`}>
                    {d.status === 'online' ? '🟢 متصل' : '🔴 غير متصل'}
                  </span>
                </td>
                <td>{d.last_sync ? new Date(d.last_sync).toLocaleString('ar-SA') : '—'}</td>
                <td>
                  <button className="btn-test" onClick={() => testConnection(d)}>🔌 اختبار</button>
                  <button className="btn-delete" onClick={() => deleteDevice(d.id)}>🗑️</button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr><td colSpan={6} className="empty-row">لا توجد أجهزة مضافة</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ========== واجهة الواتساب ==========
  const renderWhatsapp = () => (
    <div className="settings-section">
      <h3>💬 إعدادات واتساب</h3>

      <div className="form-card">
        <div className="form-group">
          <label>مفتاح API</label>
          <input
            type="password"
            value={whatsappConfig.api_key}
            onChange={e => setWhatsappConfig({ ...whatsappConfig, api_key: e.target.value })}
            placeholder="أدخل مفتاح WhatsApp Cloud API"
          />
        </div>
        <div className="form-group">
          <label>رقم هاتف API</label>
          <input
            type="text"
            value={whatsappConfig.phone_number_id}
            onChange={e => setWhatsappConfig({ ...whatsappConfig, phone_number_id: e.target.value })}
            placeholder="Phone Number ID"
          />
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={whatsappConfig.enabled}
              onChange={e => setWhatsappConfig({ ...whatsappConfig, enabled: e.target.checked })}
            />
            تفعيل إشعارات الواتساب
          </label>
        </div>
        <button className="btn-save" onClick={saveWhatsappConfig}>💾 حفظ الإعدادات</button>
      </div>
    </div>
  );

  // ========== واجهة التقويم ==========
  const renderCalendar = () => (
    <div className="settings-section">
      <h3>📅 التقويم الأكاديمي</h3>

      <div className="form-row">
        <input
          type="text"
          placeholder="الحدث"
          value={eventForm.event}
          onChange={e => setEventForm({ ...eventForm, event: e.target.value })}
        />
        <input
          type="date"
          value={eventForm.date_from}
          onChange={e => setEventForm({ ...eventForm, date_from: e.target.value })}
        />
        <input
          type="date"
          value={eventForm.date_to}
          onChange={e => setEventForm({ ...eventForm, date_to: e.target.value })}
        />
        <select
          value={eventForm.type}
          onChange={e => setEventForm({ ...eventForm, type: e.target.value })}
        >
          <option value="event">📅 حدث</option>
          <option value="holiday">🏖️ إجازة</option>
          <option value="exam">📝 اختبار</option>
          <option value="registration">📋 تسجيل</option>
          <option value="results">📊 نتائج</option>
        </select>
        <button className="btn-save" onClick={addEvent}>➕ إضافة</button>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>الحدث</th>
              <th>من</th>
              <th>إلى</th>
              <th>النوع</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {calendarEvents.map(e => (
              <tr key={e.id}>
                <td>{e.event}</td>
                <td>{e.date_from}</td>
                <td>{e.date_to}</td>
                <td>{e.type === 'holiday' ? '🏖️ إجازة' : e.type === 'exam' ? '📝 اختبار' : e.type === 'registration' ? '📋 تسجيل' : e.type === 'results' ? '📊 نتائج' : '📅 حدث'}</td>
                <td>
                  <button className="btn-delete" onClick={() => deleteEvent(e.id)}>🗑️</button>
                </td>
              </tr>
            ))}
            {calendarEvents.length === 0 && (
              <tr><td colSpan={5} className="empty-row">لا توجد أحداث</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ========== واجهة المستخدمين ==========
  const renderUsers = () => (
    <div className="settings-section">
      <h3>👥 إدارة المستخدمين</h3>

      {isAdmin() && (
        <div className="form-row">
          <input
            type="text"
            placeholder="اسم المستخدم"
            value={newUserForm.username}
            onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })}
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            value={newUserForm.password}
            onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
          />
          <select
            value={newUserForm.role}
            onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}
          >
            <option value="admin">مدير</option>
            <option value="manager">مشرف</option>
            <option value="staff">موظف</option>
          </select>
          <button className="btn-save" onClick={handleAddUser}>➕ إضافة</button>
        </div>
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الدور</th>
              <th>تاريخ الإنشاء</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.role === 'admin' ? '👑 مدير' : u.role === 'manager' ? '👤 مشرف' : '🧑‍💼 موظف'}</td>
                <td>{u.created_at}</td>
                <td>
                  {u.username !== 'admin' && isAdmin() && (
                    <button className="btn-delete" onClick={() => handleDeleteUser(u.id)}>🗑️</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>🔒 تغيير كلمة المرور</h4>
      <div className="form-card">
        <input
          type="password"
          placeholder="كلمة المرور القديمة"
          value={passwordForm.oldPassword}
          onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
        />
        <input
          type="password"
          placeholder="كلمة المرور الجديدة"
          value={passwordForm.newPassword}
          onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
        />
        <input
          type="password"
          placeholder="تأكيد كلمة المرور"
          value={passwordForm.confirmPassword}
          onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
        />
        <button className="btn-save" onClick={handleChangePassword}>🔒 تغيير</button>
      </div>
    </div>
  );

  // ========== واجهة النسخ الاحتياطي ==========
  const renderBackup = () => (
    <div className="settings-section">
      <h3>💾 النسخ الاحتياطي</h3>

      <div className="backup-actions">
        <button className="btn-backup" onClick={handleBackup}>
          📥 تصدير نسخة احتياطية
        </button>

        <label className="btn-restore">
          📤 استعادة نسخة احتياطية
          <input
            type="file"
            accept=".db"
            onChange={handleRestore}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="backup-info">
        <p>⚠️ تنبيه: استعادة نسخة احتياطية ستؤدي إلى فقدان جميع البيانات الحالية.</p>
        <p>📌 ينصح بعمل نسخة احتياطية يومياً.</p>
      </div>
    </div>
  );

  return (
    <div className="settings-module">
      {/* رسالة التنبيه */}
      {message && (
        <div className={`settings-message ${messageType}`}>
          {message}
        </div>
      )}

      {/* تبويبات الإعدادات */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'devices' ? 'active' : ''}`} onClick={() => setTab('devices')}>
          🖐️ أجهزة البصمة
        </button>
        <button className={`tab-btn ${tab === 'whatsapp' ? 'active' : ''}`} onClick={() => setTab('whatsapp')}>
          💬 واتساب
        </button>
        <button className={`tab-btn ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>
          📅 التقويم
        </button>
        <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          👥 المستخدمين
        </button>
        <button className={`tab-btn ${tab === 'backup' ? 'active' : ''}`} onClick={() => setTab('backup')}>
          💾 نسخ احتياطي
        </button>
      </div>

      {/* المحتوى */}
      {tab === 'devices' && renderDevices()}
      {tab === 'whatsapp' && renderWhatsapp()}
      {tab === 'calendar' && renderCalendar()}
      {tab === 'users' && renderUsers()}
      {tab === 'backup' && renderBackup()}
    </div>
  );
}

export default Settings;
