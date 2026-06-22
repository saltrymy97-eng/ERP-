// services/auth.js – نظام المصادقة والأمان
import { getDB, runQuery, getQuery, initDatabase, loadFromLocalStorage } from './db';

// ========== متغيرات الجلسة ==========
let currentUser = null;
let sessionTimeout = 30 * 60 * 1000; // 30 دقيقة
let sessionTimer = null;

// ========== تسجيل الدخول ==========
export async function login(username, password) {
  await initDatabase();
  
  const users = getQuery(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password]
  );

  if (users.length === 0) {
    return { success: false, message: '❌ اسم المستخدم أو كلمة المرور غير صحيحة' };
  }

  const user = users[0];
  currentUser = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  // تسجيل الدخول في سجل التدقيق
  runQuery(
    "INSERT INTO audit_log (user, action, details) VALUES (?, 'تسجيل دخول', ?)",
    [username, 'دخول النظام']
  );

  // بدء جلسة
  startSession();

  return { success: true, user: currentUser };
}

// ========== تسجيل الخروج ==========
export function logout() {
  if (currentUser) {
    runQuery(
      "INSERT INTO audit_log (user, action, details) VALUES (?, 'تسجيل خروج', ?)",
      [currentUser.username, 'خروج من النظام']
    );
  }
  currentUser = null;
  clearSession();
}

// ========== المستخدم الحالي ==========
export function getCurrentUser() {
  return currentUser;
}

// ========== التحقق من الصلاحية ==========
export function hasRole(role) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  return currentUser.role === role;
}

export function isAdmin() {
  return currentUser?.role === 'admin';
}

// ========== إدارة الجلسة ==========
function startSession() {
  clearSession();
  sessionTimer = setTimeout(() => {
    logout();
    window.location.reload();
  }, sessionTimeout);
}

function clearSession() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

// ========== تجديد الجلسة ==========
export function refreshSession() {
  if (currentUser) {
    clearSession();
    startSession();
  }
}

// ========== تغيير كلمة المرور ==========
export async function changePassword(username, oldPassword, newPassword) {
  const users = getQuery(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, oldPassword]
  );

  if (users.length === 0) {
    return { success: false, message: '❌ كلمة المرور القديمة غير صحيحة' };
  }

  runQuery(
    "UPDATE users SET password = ? WHERE username = ?",
    [newPassword, username]
  );

  runQuery(
    "INSERT INTO audit_log (user, action, details) VALUES (?, 'تغيير كلمة المرور', ?)",
    [username, 'تم تغيير كلمة المرور بنجاح']
  );

  return { success: true, message: '✅ تم تغيير كلمة المرور بنجاح' };
}

// ========== إضافة مستخدم ==========
export async function addUser(username, password, role = 'staff') {
  if (!isAdmin()) {
    return { success: false, message: '❌ لا تملك صلاحية إضافة مستخدمين' };
  }

  const exists = getQuery("SELECT id FROM users WHERE username = ?", [username]);
  if (exists.length > 0) {
    return { success: false, message: '❌ اسم المستخدم موجود مسبقاً' };
  }

  runQuery(
    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
    [username, password, role]
  );

  runQuery(
    "INSERT INTO audit_log (user, action, details) VALUES (?, 'إضافة مستخدم', ?)",
    [currentUser.username, `إضافة ${username} بدور ${role}`]
  );

  return { success: true, message: '✅ تم إضافة المستخدم بنجاح' };
}

// ========== حذف مستخدم ==========
export async function deleteUser(userId) {
  if (!isAdmin()) {
    return { success: false, message: '❌ لا تملك صلاحية حذف مستخدمين' };
  }

  runQuery("DELETE FROM users WHERE id = ? AND username != 'admin'", [userId]);
  
  runQuery(
    "INSERT INTO audit_log (user, action, details) VALUES (?, 'حذف مستخدم', ?)",
    [currentUser.username, `حذف مستخدم رقم ${userId}`]
  );

  return { success: true, message: '✅ تم حذف المستخدم بنجاح' };
}

// ========== قائمة المستخدمين ==========
export function getAllUsers() {
  return getQuery("SELECT id, username, role, created_at FROM users ORDER BY id");
}

// ========== التحقق من الجلسة المحفوظة ==========
export async function restoreSession() {
  const saved = localStorage.getItem('current_session');
  if (saved) {
    try {
      const session = JSON.parse(saved);
      await initDatabase();
      const users = getQuery(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [session.username, session.password]
      );
      if (users.length > 0) {
        currentUser = {
          id: users[0].id,
          username: users[0].username,
          role: users[0].role
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

// ========== حفظ الجلسة ==========
export function saveSession(username, password) {
  localStorage.setItem('current_session', JSON.stringify({ username, password }));
}

// ========== مسح الجلسة ==========
export function clearSavedSession() {
  localStorage.removeItem('current_session');
}

// ========== سجل التدقيق ==========
export function getAuditLog(limit = 100) {
  return getQuery(
    "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?",
    [limit]
  );
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

// ========== تسجيل عملية تدقيق ==========
export function auditLog(action, details = '') {
  if (currentUser) {
    runQuery(
      "INSERT INTO audit_log (user, action, details) VALUES (?, ?, ?)",
      [currentUser.username, action, details]
    );
  }
}
