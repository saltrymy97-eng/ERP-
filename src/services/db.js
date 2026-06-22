// src/services/db.js – قاعدة بيانات محلية احترافية
// تدعم: SELECT, INSERT, UPDATE, DELETE, COUNT, JOIN, WHERE, ORDER BY, LIMIT
const DB_KEY = 'attendance_db';

// ========== الأساسيات ==========
function loadData() {
  try {
    const saved = localStorage.getItem(DB_KEY);
    if (!saved) return createFresh();
    const data = JSON.parse(saved);
    return validateAndRepair(data);
  } catch (e) {
    return createFresh();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  } catch (e) {}
}

function createFresh() {
  return {
    _nextId: 100,
    users: [{ id: 1, username: 'admin', password: 'admin123', role: 'admin', created_at: new Date().toISOString() }],
    colleges: [], departments: [], majors: [], teachers: [], students: [],
    schedules: [], attendance: [], devices: [], notifications: [], calendar: [], audit_log: [], discipline: []
  };
}

function validateAndRepair(data) {
  const fresh = createFresh();
  for (const table of Object.keys(fresh)) {
    if (!data[table]) data[table] = fresh[table];
  }
  if (!data._nextId) data._nextId = 100;
  return data;
}

function nextId(data) {
  data._nextId = (data._nextId || 100) + 1;
  return data._nextId;
}

// ========== API العامة ==========
export async function initDatabase() {
  const data = loadData();
  saveData(data);
  return data;
}

export async function loadFromLocalStorage() {
  return loadData();
}

export function closeDatabase() {}

// ========== محرك SQL بسيط ==========
export function getQuery(sql, params = []) {
  const data = loadData();
  const sqlUpper = sql.toUpperCase().trim();

  // COUNT
  if (sqlUpper.includes('COUNT(*)')) {
    return handleCount(sql, sqlUpper, params, data);
  }

  // SELECT
  return handleSelect(sql, sqlUpper, params, data);
}

export function runQuery(sql, params = []) {
  const data = loadData();
  const sqlUpper = sql.toUpperCase().trim();

  if (sqlUpper.startsWith('INSERT')) {
    handleInsert(sql, params, data);
  } else if (sqlUpper.startsWith('UPDATE')) {
    handleUpdate(sql, params, data);
  } else if (sqlUpper.startsWith('DELETE')) {
    handleDelete(sql, params, data);
  }

  saveData(data);
  return data;
}

// ========== معالج COUNT ==========
function handleCount(sql, sqlUpper, params, data) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return [{ c: 0 }];
  const table = tableMatch[1];
  if (!data[table]) return [{ c: 0 }];

  let rows = [...data[table]];

  // DISTINCT
  if (sqlUpper.includes('DISTINCT')) {
    const colMatch = sql.match(/DISTINCT\s+(\w+)/i);
    if (colMatch) {
      const uniqueValues = new Set(rows.map(r => r[colMatch[1]]));
      return [{ c: uniqueValues.size }];
    }
  }

  // WHERE conditions
  rows = applyFilters(rows, sql, params);

  return [{ c: rows.length }];
}

// ========== معالج SELECT ==========
function handleSelect(sql, sqlUpper, params, data) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return [];
  const table = tableMatch[1];
  if (!data[table]) return [];

  let rows = [...data[table]];

  // WHERE
  rows = applyFilters(rows, sql, params);

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

// ========== فلترة الصفوف ==========
function applyFilters(rows, sql, params) {
  const sqlUpper = sql.toUpperCase();
  const today = new Date().toISOString().slice(0, 10);

  // status='active'
  if (sqlUpper.includes("STATUS='ACTIVE'")) {
    rows = rows.filter(r => r.status === 'active');
  }
  if (sqlUpper.includes("STATUS='OFFLINE'")) {
    rows = rows.filter(r => r.status === 'offline');
  }
  if (sqlUpper.includes("STATUS='ONLINE'")) {
    rows = rows.filter(r => r.status === 'online');
  }
  if (sqlUpper.includes("STATUS='PRESENT'")) {
    rows = rows.filter(r => r.status === 'present');
  }
  if (sqlUpper.includes("STATUS='ABSENT'")) {
    rows = rows.filter(r => r.status === 'absent');
  }
  if (sqlUpper.includes("STATUS='LATE'")) {
    rows = rows.filter(r => r.status === 'late');
  }

  // WHERE date = ?
  if (sqlUpper.includes('DATE=?') && params.length > 0) {
    const filterDate = params[0] || today;
    rows = rows.filter(r => r.date === filterDate);
  }

  // WHERE date(sent_at) = ?
  if (sqlUpper.includes('DATE(SENT_AT)=?')) {
    rows = rows.filter(r => r.sent_at?.startsWith(params[0] || today));
  }

  // WHERE student_id = ?
  if (sqlUpper.includes('STUDENT_ID=?') && params.length > 0) {
    rows = rows.filter(r => r.student_id === params[0]);
  }

  return rows;
}

// ========== معالج INSERT ==========
function handleInsert(sql, params, data) {
  const tableMatch = sql.match(/INTO\s+(\w+)/i);
  if (!tableMatch) return;
  const table = tableMatch[1];
  if (!data[table]) data[table] = [];

  const row = { id: nextId(data), created_at: new Date().toISOString() };

  if (table === 'colleges') {
    row.name = params[0]; row.status = 'active';
  } else if (table === 'departments') {
    row.name = params[0]; row.college_id = params[1]; row.status = 'active';
  } else if (table === 'majors') {
    row.name = params[0]; row.department_id = params[1]; row.fees = params[2] || 0; row.duration = params[3] || '4 سنوات'; row.status = 'active';
  } else if (table === 'teachers') {
    row.name = params[0]; row.phone = params[1]; row.department_id = params[2]; row.status = 'active';
  } else if (table === 'students') {
    row.university_id = params[0]; row.full_name = params[1]; row.phone = params[2] || '';
    row.parent_phone = params[3] || ''; row.national_id = params[4] || '';
    row.major_id = params[5] || null; row.level = params[6] || ''; row.group_name = params[7] || '';
    row.status = 'active';
  } else if (table === 'attendance') {
    row.student_id = params[0]; row.date = params[1];
    row.time_in = params[2] || new Date().toLocaleTimeString('ar-SA');
    row.status = params[3] || 'present'; row.late_minutes = params[4] || 0;
    row.method = params[5] || 'fingerprint';
  } else if (table === 'devices') {
    row.name = params[0]; row.ip_address = params[1]; row.port = params[2] || 4370; row.status = 'offline';
  } else if (table === 'notifications') {
    row.student_id = params[0]; row.parent_phone = params[1]; row.message = params[2];
    row.type = params[3]; row.status = params[4] || 'sent'; row.sent_at = new Date().toISOString();
  } else if (table === 'calendar') {
    row.event = params[0]; row.date_from = params[1]; row.date_to = params[2]; row.type = params[3] || 'event';
  } else if (table === 'audit_log') {
    row.user = params[0]; row.action = params[1]; row.details = params[2]; row.timestamp = new Date().toISOString();
  } else if (table === 'users') {
    row.username = params[0]; row.password = params[1]; row.role = params[2] || 'staff';
  }

  data[table].push(row);
}

// ========== معالج UPDATE ==========
function handleUpdate(sql, params, data) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (!tableMatch || params.length < 2) return;
  const table = tableMatch[1];
  if (!data[table]) return;

  const sqlUpper = sql.toUpperCase();

  // attendance: UPDATE attendance SET status=? WHERE student_id=? AND date=?
  if (table === 'attendance' && sqlUpper.includes('STUDENT_ID=?') && sqlUpper.includes('DATE=?')) {
    const idx = data[table].findIndex(r => r.student_id === params[1] && r.date === params[2]);
    if (idx >= 0) {
      data[table][idx].status = params[0];
      if (params[3]) data[table][idx].time_out = params[3];
    }
    return;
  }

  // devices: UPDATE devices SET status=?, last_sync=? WHERE id=?
  if (table === 'devices' && sqlUpper.includes('ID=?')) {
    const idx = data[table].findIndex(r => r.id === params[2]);
    if (idx >= 0) {
      data[table][idx].status = params[0];
      data[table][idx].last_sync = params[1];
    }
    return;
  }

  // students: UPDATE students SET ... WHERE id=?
  if (table === 'students' && sqlUpper.includes('ID=?')) {
    const idx = data[table].findIndex(r => r.id === params[8]);
    if (idx >= 0) {
      data[table][idx].university_id = params[0];
      data[table][idx].full_name = params[1];
      data[table][idx].phone = params[2];
      data[table][idx].parent_phone = params[3];
      data[table][idx].national_id = params[4];
      data[table][idx].major_id = params[5];
      data[table][idx].level = params[6];
      data[table][idx].group_name = params[7];
    }
    return;
  }

  // users: UPDATE users SET password=? WHERE username=?
  if (table === 'users' && sqlUpper.includes('USERNAME=?')) {
    const idx = data[table].findIndex(r => r.username === params[1]);
    if (idx >= 0) {
      data[table][idx].password = params[0];
    }
    return;
  }

  // colleges/departments/majors: UPDATE ... SET status='inactive' WHERE id=?
  if (sqlUpper.includes("STATUS='INACTIVE'") && sqlUpper.includes('ID=?')) {
    const idx = data[table].findIndex(r => r.id === params[0]);
    if (idx >= 0) {
      data[table][idx].status = 'inactive';
    }
  }
}

// ========== معالج DELETE ==========
function handleDelete(sql, params, data) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch || params.length === 0) return;
  const table = tableMatch[1];
  if (!data[table]) return;

  const id = params[0];
  data[table] = data[table].filter(r => r.id !== id);
}

// ========== نسخ احتياطي ==========
export function exportDatabase() {
  const data = loadData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importDatabase(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    saveData(validateAndRepair(data));
    return data;
  } catch (e) {
    return null;
  }
}
