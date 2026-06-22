// src/services/auth.js – نظام المصادقة والأمان (كلمة مرور فقط)
// متوافق مع db.js | localStorage مباشر | بدون اعتماديات خارجية

// ========== متغيرات الجلسة ==========
let currentUser = null;
let sessionTimer = null;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 دقيقة

// ==========================================
// ١. الطبقة الأساسية (Core)
// ==========================================

function getUsers() {
  try {
    const saved = localStorage.getItem('attendance_db');
    if (!saved) return [];
    const data = JSON.parse(saved);
    return data.users || [];
  } catch (e) {
    console.error('❌ فشل قراءة المستخدمين:', e);
    return [];
  }
}

function saveUsers(users) {
  try {
    const saved = localStorage.getItem('attendance_db');
    const data = saved ? JSON.parse(saved) : {};
    data.users = users;
    localStorage.setItem('attendance_db', JSON.stringify(data));
  } catch (e) {
    console.error('❌ فشل حفظ المستخدمين:', e);
  }
}

function addAuditEntry(username, action, details) {
  try {
    const saved = localStorage.getItem('attendance_db');
    const data = saved ? JSON.parse(saved) : {};
    if (!data.audit_log) data.audit_log = [];
    data.audit_log.push({
      id: Date.now(),
      user: username,
      action,
      details,
      timestamp: new Date().toISOString()
    });
    // حد أقصى 500 سجل
    if (data.audit_log.length > 500) {
      data.audit_log = data.audit_log.slice(-500);
    }
    localStorage.setItem('attendance_db', JSON.stringify(data));
  } catch (e) {}
}

// ==========================================
// ٢. المصادقة (Authentication)
// ==========================================

export async function login(password) {
  // تحقق سريع
  if (!password || !password.trim()) {
    return { success: false, message: '❌ الرجاء إدخال كلمة المرور' };
  }

  const users = getUsers();

  // إذا لم يوجد مستخدمين... أنشئ مدير افتراضي
  if (users.length === 0) {
    users.push({
      id: 1,
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      created_at: new Date().toISOString()
    });
    saveUsers(users);
  }

  // البحث عن المستخدم
  const user = users.find(u => u.password === password.trim());

  if (!user) {
    return { success: false, message: '❌ كلمة المرور غير صحيحة' };
  }

  // إنشاء الجلسة
  currentUser = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  addAuditEntry(user.username, 'تسجيل دخول', 'دخول النظام');
  saveSession(password.trim());
  startSession();

  return { success: true, user: currentUser };
}

export function logout() {
  if (currentUser) {
    addAuditEntry(currentUser.username, 'تسجيل خروج', 'خروج من النظام');
  }
  currentUser = null;
  clearSession();
  clearSavedSession();
}

// ==========================================
// ٣. الجلسة (Session)
// ==========================================

function startSession() {
  clearSession();
  sessionTimer = setTimeout(() => {
    logout();
    window.location.reload();
  }, SESSION_TIMEOUT);
}

function clearSession() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

export function refreshSession() {
  if (currentUser) {
    clearSession();
    startSession();
  }
}

export async function restoreSession() {
  try {
    const savedPassword = localStorage.getItem('current_session');
    if (!savedPassword) return null;

    const users = getUsers();
    const user = users.find(u => u.password === savedPassword);

    if (user) {
      currentUser = {
        id: user.id,
        username: user.username,
        role: user.role
      };
      startSession();
      return currentUser;
    }
  } catch (e) {
    localStorage.removeItem('current_session');
  }

  return null;
}

export function saveSession(password) {
  localStorage.setItem('current_session', password);
}

export function clearSavedSession() {
  localStorage.removeItem('current_session');
}

// ==========================================
// ٤. المستخدم الحالي (Current User)
// ==========================================

export function getCurrentUser() {
  return currentUser;
}

export function isAdmin() {
  return currentUser?.role === 'admin';
}

export function hasRole(role) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  return currentUser.role === role;
}

// ==========================================
// ٥. إدارة المستخدمين (User Management)
// ==========================================

export async function changePassword(oldPassword, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    return { success: false, message: '❌ كلمة المرور الجديدة قصيرة جداً (4 أحرف على الأقل)' };
  }

  const users = getUsers();
  const idx = users.findIndex(u => u.password === oldPassword);

  if (idx === -1) {
    return { success: false, message: '❌ كلمة المرور القديمة غير صحيحة' };
  }

  users[idx].password = newPassword;
  saveUsers(users);
  addAuditEntry(currentUser?.username || 'admin', 'تغيير كلمة المرور', 'تم بنجاح');

  // تحديث الجلسة
  saveSession(newPassword);

  return { success: true, message: '✅ تم تغيير كلمة المرور بنجاح' };
}

export async function addUser(username, password, role = 'staff') {
  if (!isAdmin()) {
    return { success: false, message: '❌ لا تملك صلاحية إضافة مستخدمين' };
  }

  if (!username || !password) {
    return { success: false, message: '❌ الرجاء إدخال اسم المستخدم وكلمة المرور' };
  }

  const users = getUsers();

  if (users.find(u => u.username === username)) {
    return { success: false, message: '❌ اسم المستخدم موجود مسبقاً' };
  }

  users.push({
    id: Date.now(),
    username,
    password,
    role,
    created_at: new Date().toISOString()
  });

  saveUsers(users);
  addAuditEntry(currentUser.username, 'إضافة مستخدم', `${username} بدور ${role}`);

  return { success: true, message: '✅ تم إضافة المستخدم بنجاح' };
}

export async function deleteUser(userId) {
  if (!isAdmin()) {
    return { success: false, message: '❌ لا تملك صلاحية حذف مستخدمين' };
  }

  if (userId === 1) {
    return { success: false, message: '❌ لا يمكن حذف المدير الافتراضي' };
  }

  const users = getUsers();
  const filtered = users.filter(u => u.id !== userId);

  if (filtered.length === users.length) {
    return { success: false, message: '❌ المستخدم غير موجود' };
  }

  saveUsers(filtered);
  addAuditEntry(currentUser.username, 'حذف مستخدم', `رقم ${userId}`);

  return { success: true, message: '✅ تم حذف المستخدم بنجاح' };
}

export function getAllUsers() {
  return getUsers().map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    created_at: u.created_at
  }));
}

// ==========================================
// ٦. سجل التدقيق (Audit Log)
// ==========================================

export function getAuditLog(limit = 100) {
  try {
    const saved = localStorage.getItem('attendance_db');
    if (!saved) return [];
    const data = JSON.parse(saved);
    const logs = data.audit_log || [];
    return logs.slice(-limit).reverse();
  } catch (e) {
    return [];
  }
}

// ==========================================
// ٧. الصلاحيات (Permissions)
// ==========================================

export const PERMISSIONS = {
  admin: [
    'view_dashboard',
    'manage_colleges',
    'manage_students',
    'manage_schedules',
    'view_attendance',
    'send_notifications',
    'view_reports',
    'manage_devices',
    'manage_calendar',
    'manage_users',
    'export_data',
    'ai_analysis'
  ],
  manager: [
    'view_dashboard',
    'view_attendance',
    'send_notifications',
    'view_reports',
    'ai_analysis'
  ],
  staff: [
    'view_dashboard',
    'view_attendance',
    'send_notifications'
  ]
};

export function hasPermission(permission) {
  if (!currentUser) return false;
  const rolePermissions = PERMISSIONS[currentUser.role] || [];
  return rolePermissions.includes(permission);
}

// ==========================================
// ٨. قفل الشاشة (Screen Lock)
// ==========================================

export function lockScreen() {
  clearSession();
  return { locked: true };
}

export async function unlockScreen(password) {
  return await login(password);
}
