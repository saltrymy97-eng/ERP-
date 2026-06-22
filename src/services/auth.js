// src/services/auth.js – نظام المصادقة والأمان (متوافق مع localStorage)
import { initDatabase } from './db';

// ========== متغيرات الجلسة ==========
let currentUser = null;
let sessionTimer = null;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 دقيقة

// ========== دوال مساعدة ==========
function getUsers() {
  const saved = localStorage.getItem('attendance_db');
  if (!saved) return [];
  try {
    const data = JSON.parse(saved);
    return data.users || [];
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  const saved = localStorage.getItem('attendance_db');
  let data = {};
  try {
    data = saved ? JSON.parse(saved) : {};
  } catch (e) {
    data = {};
  }
  data.users = users;
  localStorage.setItem('attendance_db', JSON.stringify(data));
}

function getAuditLogs() {
  const saved = localStorage.getItem('attendance_db');
  if (!saved) return [];
  try {
    const data = JSON.parse(saved);
    return data.audit_log || [];
  } catch (e) {
    return [];
  }
}

function addAuditLog(username, action, details) {
  const saved = localStorage.getItem('attendance_db');
  let data = {};
  try {
    data = saved ? JSON.parse(saved) : {};
  } catch (e) {
    data = {};
  }
  if (!data.audit_log) data.audit_log = [];
  data.audit_log.push({
    id: Date.now(),
    user: username,
    action: action,
    details: details,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('attendance_db', JSON.stringify(data));
}

// ========== تسجيل الدخول ==========
export async function login(username, password) {
  await initDatabase();

  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return { success: false, message: '❌ اسم المستخدم أو كلمة المرور غير صحيحة' };
  }

  currentUser = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  addAuditLog(username, 'تسجيل دخول', 'دخول النظام');
  saveSession(username, password);
  startSession();

  return { success: true, user: currentUser };
}

// ========== تسجيل الخروج ==========
export function logout() {
  if (currentUser) {
    addAuditLog(currentUser.username, 'تسجيل خروج', 'خروج من النظام');
  }
  currentUser = null;
  clearSession();
  clearSavedSession();
}

// ========== المستخدم الحالي ==========
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

// ========== إدارة الجلسة ==========
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

// ========== استعادة الجلسة ==========
export async function restoreSession() {
  const saved = localStorage.getItem('current_session');
  if (saved) {
    try {
      const session = JSON.parse(saved);
      await initDatabase();
      const users = getUsers();
      const user = users.find(u => u.username === session.username && u.password === session.password);
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
  }
  return null;
}

export function saveSession(username, password) {
  localStorage.setItem('current_session', JSON.stringify({ username, password }));
}

export function clearSavedSession() {
  localStorage.removeItem('current_session');
}

// ========== تغيير كلمة المرور ==========
export async function changePassword(username, oldPassword, newPassword) {
  const users = getUsers();
  const idx = users.findIndex(u => u.username === username && u.password === oldPassword);

  if (idx === -1) {
    return { success: false, message: '❌ كلمة المرور القديمة غير صحيحة' };
  }

  users[idx].password = newPassword;
  saveUsers(users);
  addAuditLog(username, 'تغيير كلمة المرور', 'تم تغيير كلمة المرور بنجاح');

  return { success: true, message: '✅ تم تغيير كلمة المرور بنجاح' };
}

// ========== إضافة مستخدم ==========
export async function addUser(username, password, role = 'staff') {
  if (!isAdmin()) {
    return { success: false, message: '❌ لا تملك صلاحية إضافة مستخدمين' };
  }

  const users = getUsers();
  if (users.find(u => u.username === username)) {
    return { success: false, message: '❌ اسم المستخدم موجود مسبقاً' };
  }

  const newUser = {
    id: Date.now(),
    username,
    password,
    role,
    created_at: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  addAuditLog(currentUser.username, 'إضافة مستخدم', `إضافة ${username} بدور ${role}`);

  return { success: true, message: '✅ تم إضافة المستخدم بنجاح' };
}

// ========== حذف مستخدم ==========
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
  addAuditLog(currentUser.username, 'حذف مستخدم', `حذف مستخدم رقم ${userId}`);

  return { success: true, message: '✅ تم حذف المستخدم بنجاح' };
}

// ========== قائمة المستخدمين ==========
export function getAllUsers() {
  return getUsers().map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    created_at: u.created_at
  }));
}

// ========== سجل التدقيق ==========
export function getAuditLog(limit = 100) {
  const logs = getAuditLogs();
  return logs.slice(-limit).reverse();
}

// ========== صلاحيات الأدوار ==========
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

// ========== التحقق من الصلاحية ==========
export function hasPermission(permission) {
  if (!currentUser) return false;
  const rolePermissions = PERMISSIONS[currentUser.role] || [];
  return rolePermissions.includes(permission);
}

// ========== قفل الشاشة ==========
export function lockScreen() {
  clearSession();
  return { locked: true };
}

// ========== فك القفل ==========
export async function unlockScreen(username, password) {
  const result = await login(username, password);
  return result;
}
