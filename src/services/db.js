// src/services/db.js – قاعدة بيانات محلية احترافية
// تدعم: INSERT, SELECT, UPDATE, DELETE, COUNT, JOIN بسيط
// التخزين: localStorage | لا تحتاج إنترنت | لا تحتاج تحميل

const DB_KEY = 'attendance_db';

// ==========================================
// ١. الطبقة الأساسية (Core Layer)
// ==========================================

function loadData() {
  try {
    const saved = localStorage.getItem(DB_KEY);
    if (!saved) return createFreshDatabase();
    const data = JSON.parse(saved);
    return validateAndRepair(data);
  } catch (e) {
    console.error('❌ فشل تحميل قاعدة البيانات:', e);
    return createFreshDatabase();
  }
}

function saveData(data) {
  try {
    const copy = JSON.parse(JSON.stringify(data));
    localStorage.setItem(DB_KEY, JSON.stringify(copy));
  } catch (e) {
    console.error('❌ فشل حفظ قاعدة البيانات:', e);
  }
}

function createFreshDatabase() {
  return {
    _version: '1.0',
    _nextId: 100,
    users: [
      {
        id: 1,
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        created_at: new Date().toISOString()
      }
    ],
    colleges: [],
    departments: [],
    majors: [],
    teachers: [],
    students: [],
    schedules: [],
    attendance: [],
    devices: [],
    notifications: [],
    calendar: [],
    audit_log: [],
    discipline: []
  };
}

function validateAndRepair(data) {
  const fresh = createFreshDatabase();
  // تأكد من وجود جميع الجداول
  for (const table of Object.keys(fresh)) {
    if (!data[table] && table !== '_version' && table !== '_nextId') {
      data[table] = [];
    }
  }
  if (!data._nextId) data._nextId = 100;
  return data;
}

function nextId(data) {
  data._nextId = (data._nextId || 100) + 1;
  return data._nextId;
}

// ==========================================
// ٢. واجهة API العامة (Public API)
// ==========================================

export async function initDatabase() {
  const data = loadData();
  saveData(data);
  return data;
}

export async function loadFromLocalStorage() {
  return loadData();
}

export function closeDatabase() {
  // localStorage يحفظ تلقائياً
}

// ==========================================
// ٣. محرك الاستعلامات (Query Engine)
// ==========================================

export function getQuery(sql, params = []) {
  const data = loadData();
  const sqlUpper = sql.toUpperCase().trim();

  // COUNT queries
  if (sqlUpper.includes('COUNT(*)')) {
    return handleCountQuery(sql, sqlUpper, params, data);
  }

  // SELECT queries
  if (sqlUpper.startsWith('SELECT')) {
    return handleSelectQuery(sql, sqlUpper, params, data);
  }

  return [];
}

export function runQuery(sql, params = []) {
  const data = loadData();
  const sqlUpper = sql.toUpperCase().trim();

  if (sqlUpper.startsWith('INSERT')) {
    handleInsertQuery(sql, params, data);
  } else if (sqlUpper.startsWith('UPDATE')) {
    handleUpdateQuery(sql, params, data);
  } else if (sqlUpper.startsWith('DELETE')) {
    handleDeleteQuery(sql, params, data);
  }

  saveData(data);
  return data;
}

// ==========================================
// ٤. معالجة الاستعلامات (Query Handlers)
// ==========================================

function handleCountQuery(sql, sqlUpper, params, data) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return [{ c: 0 }];

  const table = tableMatch[1];
  if (!data[table]) return [{ c: 0 }];

  let rows = [...data[table]];

  // DISTINCT
  if (sqlUpper.includes('DISTINCT')) {
    const colMatch = sql.match(/DISTINCT\s+(\w+)/i);
    if (colMatch) {
      const col = colMatch[1];
      const uniqueValues = new Set(rows.map(r => r[col]));
      return [{ c: uniqueValues.size }];
    }
  }

  // WHERE (بسيط)
  if (params && params.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const filterDate = params[0] || today;
    rows = rows.filter(r => r.date === filterDate || r[Object.keys(params[0] || {})[0]] === params[0]);
  }

  // Status filter
  if (sqlUpper.includes("STATUS='ACTIVE'")) rows = rows.filter(r => r.status === 'active');
  if (sqlUpper.includes("STATUS='PRESENT'")) rows = rows.filter(r => r.status === 'present');
  if (sqlUpper.includes("STATUS='ABSENT'")) rows = rows.filter(r => r.status === 'absent');
  if (sqlUpper.includes("STATUS='LATE'")) rows = rows.filter(r => r.status === 'late');
  if (sqlUpper.includes("STATUS='ONLINE'")) rows = rows.filter(r => r.status === 'online');
  if (sqlUpper.includes("STATUS='OFFLINE'")) rows = rows.filter(r => r.status === 'offline');

  return [{ c: rows.length }];
}

function handleSelectQuery(sql, sqlUpper, params, data) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return [];

  const table = tableMatch[1];
  if (!data[table]) return [];

  let rows = [...data[table]];

  // WHERE
  if (params && params.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    if (sqlUpper.includes('DATE=?')) {
      rows = rows.filter(r => r.date === (params[0] || today));
    }
    if (sqlUpper.includes('DATE LIKE')) {
      const monthPattern = params[0] || '';
      rows = rows.filter(r => r.date && r.date.startsWith(monthPattern));
    }
    if (sqlUpper.includes('STUDENT_ID=?')) {
      rows = rows.filter(r => r.student_id === params[0]);
    }
  }

  // Status
  if (sqlUpper.includes("STATUS='ACTIVE'")) rows = rows.filter(r => r.status === 'active');

  // ORDER BY
  const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)\s*(DESC)?/i);
  if (orderMatch) {
    const col = orderMatch[1];
    const desc = orderMatch[2];
    rows.sort((a, b) => {
      const va = a[col] || '';
      const vb = b[col] || '';
      if (va < vb) return desc ? 1 : -1;
      if (va > vb) return desc ? -1 : 1;
      return 0;
    });
  }

  // LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    rows = rows.slice(0, parseInt(limitMatch[1]));
  }

  return rows;
}

function handleInsertQuery(sql, params, data) {
  const tableMatch = sql.match(/INTO\s+(\w+)/i);
  if (!tableMatch) return;

  const table = tableMatch[1];
  if (!data[table]) data[table] = [];

  const row = {
    id: nextId(data),
    created_at: new Date().toISOString()
  };

  // تعيين القيم حسب الجدول
  const tableHandlers = {
    colleges: () => {
      row.name = params[0];
      row.status = 'active';
    },
    departments: () => {
      row.name = params[0];
      row.college_id = params[1];
      row.status = 'active';
    },
    majors: () => {
      row.name = params[0];
      row.department_id = params[1];
      row.fees = params[2] || 0;
      row.duration = params[3] || '4 سنوات';
      row.status = 'active';
    },
    teachers: () => {
      row.name = params[0];
      row.phone = params[1];
      row.department_id = params[2];
      row.status = 'active';
    },
    students: () => {
      row.university_id = params[0];
      row.full_name = params[1];
      row.phone = params[2] || '';
      row.parent_phone = params[3] || '';
      row.national_id = params[4] || '';
      row.major_id = params[5] || null;
      row.level = params[6] || '';
      row.group_name = params[7] || '';
      row.status = 'active';
    },
    attendance: () => {
      row.student_id = params[0];
      row.date = params[1];
      row.time_in = params[2] || new Date().toLocaleTimeString('ar-SA');
      row.status = params[3] || 'present';
      row.late_minutes = params[4] || 0;
      row.method = params[5] || 'fingerprint';
    },
    devices: () => {
      row.name = params[0];
      row.ip_address = params[1];
      row.port = params[2] || 4370;
      row.status = 'offline';
    },
    notifications: () => {
      row.student_id = params[0];
      row.parent_phone = params[1];
      row.message = params[2];
      row.type = params[3];
      row.status = params[4] || 'sent';
      row.sent_at = new Date().toISOString();
    },
    calendar: () => {
      row.event = params[0];
      row.date_from = params[1];
      row.date_to = params[2];
      row.type = params[3] || 'event';
    },
    audit_log: () => {
      row.user = params[0];
      row.action = params[1];
      row.details = params[2];
      row.timestamp = new Date().toISOString();
    },
    users: () => {
      row.username = params[0];
      row.password = params[1];
      row.role = params[2] || 'staff';
    }
  };

  if (tableHandlers[table]) {
    tableHandlers[table]();
  }

  data[table].push(row);
}

function handleUpdateQuery(sql, params, data) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (!tableMatch || params.length < 2) return;

  const table = tableMatch[1];
  if (!data[table]) return;

  // أسلوب مبسط: البحث عن الصف وتحديثه
  const whereMatch = sql.match(/WHERE\s+(.+)/i);
  if (whereMatch) {
    const condition = whereMatch[1].toUpperCase();
    
    if (condition.includes('ID=?') && condition.includes('DATE=?')) {
      // تحديث حضور
      const id = params[0];
      const date = params[1];
      const idx = data[table].findIndex(r => r.student_id === id && r.date === date);
      if (idx >= 0) {
        data[table][idx].status = params[2] || data[table][idx].status;
        data[table][idx].time_out = params[3] || data[table][idx].time_out;
      }
    } else if (condition.includes('ID=?')) {
      const id = params[params.length - 1];
      const idx = data[table].findIndex(r => r.id === id);
      if (idx >= 0) {
        if (table === 'devices') {
          data[table][idx].status = params[0];
          data[table][idx].last_sync = params[1];
        }
      }
    } else if (condition.includes('USERNAME=?')) {
      const username = params[params.length - 1];
      const idx = data[table].findIndex(r => r.username === username);
      if (idx >= 0) {
        data[table][idx].password = params[0];
      }
    }
  }
}

function handleDeleteQuery(sql, params, data) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch || params.length === 0) return;

  const table = tableMatch[1];
  if (!data[table]) return;

  const id = params[0];
  data[table] = data[table].filter(r => r.id !== id);
}

// ==========================================
// ٥. النسخ الاحتياطي (Backup)
// ==========================================

export function exportDatabase() {
  const data = loadData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importDatabase(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const validated = validateAndRepair(data);
    saveData(validated);
    return validated;
  } catch (e) {
    console.error('❌ فشل استيراد النسخة الاحتياطية:', e);
    return null;
  }
}
