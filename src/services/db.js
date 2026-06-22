// src/services/db.js – قاعدة بيانات محلية (localStorage)
// سريعة، بدون تحميل، تعمل بدون إنترنت

const DB_KEY = 'attendance_db';

// ========== تحميل البيانات ==========
function loadData() {
  const saved = localStorage.getItem(DB_KEY);
  return saved ? JSON.parse(saved) : getDefaultData();
}

// ========== حفظ البيانات ==========
function saveData(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// ========== البيانات الافتراضية ==========
function getDefaultData() {
  return {
    colleges: [],
    departments: [],
    majors: [],
    students: [],
    teachers: [],
    schedules: [],
    attendance: [],
    devices: [],
    notifications: [],
    calendar: [],
    audit_log: [],
    discipline: [],
    users: [
      { id: 1, username: 'admin', password: 'admin123', role: 'admin', created_at: new Date().toISOString() }
    ],
    _nextId: 1
  };
}

// ========== الحصول على ID جديد ==========
function nextId(data) {
  data._nextId = (data._nextId || 1) + 1;
  return data._nextId;
}

// ========== بدء قاعدة البيانات ==========
export async function initDatabase() {
  const data = loadData();
  saveData(data);
  return data;
}

// ========== تنفيذ استعلام بسيط ==========
export function getQuery(table, conditions = {}) {
  const data = loadData();
  let rows = data[table] || [];

  // فلترة بسيطة
  if (conditions.where) {
    const [col, val] = conditions.where;
    rows = rows.filter(r => r[col] === val);
  }

  // ترتيب
  if (conditions.orderBy) {
    rows.sort((a, b) => {
      if (a[conditions.orderBy] < b[conditions.orderBy]) return -1;
      if (a[conditions.orderBy] > b[conditions.orderBy]) return 1;
      return 0;
    });
  }

  return rows;
}

// ========== تنفيذ استعلام SQL بسيط (محاكاة) ==========
export function runQuery(sql, params = []) {
  const data = loadData();
  
  // INSERT
  if (sql.trim().toUpperCase().startsWith('INSERT')) {
    const table = sql.match(/INTO\s+(\w+)/i)[1];
    const row = {};
    row.id = nextId(data);
    
    if (table === 'colleges') {
      row.name = params[0];
      row.status = 'active';
      row.created_at = new Date().toISOString();
    } else if (table === 'students') {
      row.university_id = params[0];
      row.full_name = params[1];
      row.phone = params[2];
      row.parent_phone = params[3];
      row.national_id = params[4];
      row.major_id = params[5];
      row.level = params[6];
      row.group_name = params[7];
      row.status = 'active';
      row.created_at = new Date().toISOString();
    } else if (table === 'attendance') {
      row.student_id = params[0];
      row.date = params[1];
      row.time_in = params[2];
      row.status = params[3] || 'present';
      row.method = params[4] || 'fingerprint';
      row.created_at = new Date().toISOString();
    } else if (table === 'devices') {
      row.name = params[0];
      row.ip_address = params[1];
      row.port = params[2] || 4370;
      row.status = 'offline';
    } else if (table === 'notifications') {
      row.student_id = params[0];
      row.parent_phone = params[1];
      row.message = params[2];
      row.type = params[3];
      row.status = params[4] || 'sent';
      row.sent_at = new Date().toISOString();
    } else if (table === 'calendar') {
      row.event = params[0];
      row.date_from = params[1];
      row.date_to = params[2];
      row.type = params[3] || 'event';
    } else if (table === 'audit_log') {
      row.user = params[0];
      row.action = params[1];
      row.details = params[2];
      row.timestamp = new Date().toISOString();
    } else if (table === 'users') {
      row.username = params[0];
      row.password = params[1];
      row.role = params[2] || 'staff';
      row.created_at = new Date().toISOString();
    }

    if (!data[table]) data[table] = [];
    data[table].push(row);
  }

  // UPDATE
  if (sql.trim().toUpperCase().startsWith('UPDATE')) {
    const table = sql.match(/UPDATE\s+(\w+)/i)[1];
    if (table === 'devices') {
      const idx = data.devices.findIndex(d => d.id === params[3]);
      if (idx >= 0) {
        data.devices[idx].status = params[0];
        data.devices[idx].last_sync = params[1];
      }
    } else if (table === 'students') {
      const idx = data.students.findIndex(s => s.id === params[8]);
      if (idx >= 0) {
        data.students[idx].university_id = params[0];
        data.students[idx].full_name = params[1];
        data.students[idx].phone = params[2];
        data.students[idx].parent_phone = params[3];
        data.students[idx].national_id = params[4];
        data.students[idx].major_id = params[5];
        data.students[idx].level = params[6];
        data.students[idx].group_name = params[7];
      }
    }
  }

  // DELETE
  if (sql.trim().toUpperCase().startsWith('DELETE')) {
    const table = sql.match(/FROM\s+(\w+)/i)[1];
    const id = params[0];
    data[table] = (data[table] || []).filter(r => r.id !== id);
  }

  saveData(data);
  return data;
}

// ========== استعلام متقدم ==========
export function executeQuery(sql, params = []) {
  const data = loadData();
  const today = new Date().toISOString().slice(0, 10);

  // COUNT queries
  if (sql.includes('COUNT(*)')) {
    const table = sql.match(/FROM\s+(\w+)/i)[1];
    
    if (sql.includes("status='active'")) {
      return [{ c: (data[table] || []).filter(r => r.status === 'active').length }];
    }
    if (sql.includes("status='present'") || sql.includes("status='absent'") || sql.includes("status='late'")) {
      const status = sql.match(/status='(\w+)'/)[1];
      const filtered = (data[table] || []).filter(r => r.date === (params[0] || today) && r.status === status);
      return [{ c: filtered.length }];
    }
    
    return [{ c: (data[table] || []).length }];
  }

  // Simple SELECT
  const table = sql.match(/FROM\s+(\w+)/i)[1];
  let rows = [...(data[table] || [])];

  // LIMIT
  const limit = sql.match(/LIMIT\s+(\d+)/i);
  if (limit) rows = rows.slice(0, parseInt(limit[1]));

  return rows;
}

// ========== حفظ تلقائي ==========
export async function loadFromLocalStorage() {
  return loadData();
}

export function closeDatabase() {
  // لا شيء... localStorage يحفظ تلقائياً
}

export function exportDatabase() {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDatabase(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  saveData(data);
  return data;
}
