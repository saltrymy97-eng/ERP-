// src/services/auth.js – نظام المصادقة والأمان المطور لحل مشكلة تجمّد الواجهة
import { getQuery, runQuery } from './db';

// ========== متغيرات الجلسة ==========
let currentUser = null;
let sessionTimer = null;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 دقيقة صريحة

// ذاكرة مؤقتة للمستخدمين لمنع خنق قاعدة البيانات مع كل حركة
let cachedUsers = null;
let lastCacheTime = 0;
const CACHE_DURATION = 10000; // 10 ثوانٍ

// ==========================================
// ١. الطبقة الأساسية (Core) – SQLite
// ==========================================

async function getUsers() {
  const now = Date.now();
  // إذا كانت البيانات المؤقتة موجودة ولم تمر 10 ثوانٍ، أرجعها فوراً دون الذهاب لقاعدة البيانات
  if (cachedUsers && (now - lastCacheTime < CACHE_DURATION)) {
    return cachedUsers;
  }
  try {
    const users = await getQuery("SELECT * FROM users ORDER BY id");
    cachedUsers = users || [];
    lastCacheTime = now;
    return cachedUsers;
  } catch (e) {
    console.error('❌ فشل قراءة المستخدمين:', e);
    return [];
  }
}

async function addAuditEntry(username, action, details) {
  try {
    await runQuery(
      "INSERT INTO audit_log (user, action, details, timestamp) VALUES (?, ?, ?, ?)",
      [username, action, details, new Date().toISOString()]
    );
    
    // حد أقصى 500 سجل
    await runQuery(
      "DELETE FROM audit_log WHERE id NOT IN (SELECT id FROM audit_log ORDER BY id DESC LIMIT 500)"
    );
  } catch (e) {
    console.error('❌ فشل تسجيل التدقيق:', e);
  }
}

// ==========================================
// ٢. المصادقة (Authentication)
// ==========================================

export async function login(password) {
  if (!password || !password.trim()) {
    return { success: false, message: '❌ الرجاء إدخال كلمة المرور' };
  }

  cachedUsers = null; // تفريغ الكاش عند تسجيل الدخول
  let users = await getUsers();

  if (users.length === 0) {
    await runQuery(
      "INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, ?)",
      ['admin', 'admin123', 'admin', new Date().toISOString()]
    );
    users = await getUsers();
  }

  const user = users.find(u => u.password === password.trim());

  if (!user) {
    return { success: false, message: '❌ كلمة المرور غير صحيحة' };
  }

  currentUser = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  await addAuditEntry(user.username, 'تسجيل دخول', 'دخول النظام');
  saveSession(password.trim());
  startSession();

  return { success: true, user: currentUser };
}

export async function logout() {
  if (currentUser) {
    await addAuditEntry(currentUser.username, 'تسجيل خروج', 'خروج من النظام');
  }
  currentUser = null;
  clearSession();
  clearSavedSession();
}

// ==========================================
// ٣. الجلسة الذكية الصامتة (Session)
// ==========================================

function startSession() {
  clearSession();
  // معالج آمن يمنع التداخل مع كود الكتابة في الواجهات
  sessionTimer = setTimeout(() => {
    logout();
    // بدلاً من عمل Reload قسري ومفاجئ يسبب تعليق، نوجه المستخدم لصفحة القفل بمرونة
    window.location.hash = '/login'; 
    window.location.reload();
  }, SESSION_TIMEOUT);
}

function clearSession() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

// تحسين الأداء: تقليل عدد مرات عمل الـ Refresh أثناء الكتابة المستمرة
let lastRefresh = 0;
export function refreshSession() {
  const now = Date.now();
  if (currentUser && (now - lastRefresh > 5000)) { // لا تحدث الجلسة إلا إذا مرت 5 ثوانٍ على الأقل من آخر تحديث
    lastRefresh = now;
    clearSession();
    startSession();
  }
}

export async function restoreSession() {
  try {
    const savedPassword = localStorage.getItem('current_session');
    if (!savedPassword) return null;

    const users = await getUsers();
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

export async function changePassword(username, oldPassword, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    return { success: false, message: '❌ كلمة المرور الجديدة قصيرة جداً (4 أحرف على الأقل)' };
  }

  const users = await getUsers();
  const user = users.find(u => u.username === username && u.password === oldPassword);

  if (!user) {
    return { success: false, message: '❌ كلمة المرور القديمة غير صحيحة' };
  }

  await runQuery(
    "UPDATE users SET password = ? WHERE id = ?",
    [newPassword, user.id]
  );

  await addAuditEntry(username, 'تغيير كلمة المرور', 'تم بنجاح');
  saveSession(newPassword);
  cachedUsers = null; // تصفير الكاش للتحديث

  return { success: true, message: '✅ تم تغيير كلمة المرور بنجاح' };
}

export async function addUser(username, password, role = 'staff') {
  if (!isAdmin()) {
    return { success: false, message: '❌ لا تملك صلاحية إضافة مستخدمين' };
  }

  if (!username || !password) {
    return { success: false, message: '❌ الرجاء إدخال اسم المستخدم وكلمة المرور' };
  }

  const users = await getUsers();

  if (users.find(u => u.username === username)) {
    return { success: false, message: '❌ اسم المستخدم موجود مسبقاً' };
  }

  await runQuery(
    "INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, ?)",
    [username, password, role, new Date().toISOString()]
  );

  await addAuditEntry(currentUser.username, 'إضافة مستخدم', `${username} بدور ${role}`);
  cachedUsers = null; 

  return { success: true, message: '✅ تم إضافة المستخدم بنجاح' };
}

export async function deleteUser(userId) {
  if (!isAdmin()) {
    return { success: false, message: '❌ لا تملك صلاحية حذف مستخدمين' };
  }

  const users = await getUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    return { success: false, message: '❌ المستخدم غير موجود' };
  }

  if (user.username === 'admin') {
    return { success: false, message: '❌ لا يمكن حذف المدير الافتراضي' };
  }

  await runQuery("DELETE FROM users WHERE id = ?", [userId]);
  await addAuditEntry(currentUser.username, 'حذف مستخدم', `رقم ${userId}`);
  cachedUsers = null;

  return { success: true, message: '✅ تم حذف المستخدم بنجاح' };
}

export async function getAllUsers() {
  const users = await getUsers();
  return users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    created_at: u.created_at
  }));
}

// ==========================================
// ٦. سجل التدقيق (Audit Log)
// ==========================================

export async function getAuditLog(limit = 100) {
  try {
    const logs = await getQuery(
      "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?",
      [limit]
    );
    return logs || [];
  } catch (e) {
    return [];
  }
}

// ==========================================
// ٧. الصلاحيات وقفل الشاشة
// ==========================================

export const PERMISSIONS = {
  admin: ['view_dashboard', 'manage_colleges', 'manage_students', 'manage_schedules', 'view_attendance', 'send_notifications', 'view_reports', 'manage_devices', 'manage_calendar', 'manage_users', 'export_data', 'ai_analysis'],
  manager: ['view_dashboard', 'view_attendance', 'send_notifications', 'view_reports', 'ai_analysis'],
  staff: ['view_dashboard', 'view_attendance', 'send_notifications']
};

export function hasPermission(permission) {
  if (!currentUser) return false;
  const rolePermissions = PERMISSIONS[currentUser.role] || [];
  return rolePermissions.includes(permission);
}

export function lockScreen() {
  clearSession();
  return { locked: true };
}

export async function unlockScreen(password) {
  return await login(password);
}
