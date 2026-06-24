// src/services/db.js – قاعدة بيانات محلية احترافية ومطورة (النسخة الإمبراطورية الذكية المرنة)
const DB_KEY = 'attendance_db';

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

export async function initDatabase() {
  const data = loadData();
  saveData(data);
  return data;
}

export async function loadFromLocalStorage() {
  return loadData();
}

export function closeDatabase() {}

// ========== محرك SQL المطور ==========
export function getQuery(sql, params = []) {
  const data = loadData();
  const sqlUpper = sql.toUpperCase().replace(/\s+/g, ' ').trim();

  if (/\bJOIN\b/i.test(sqlUpper)) {
    return handleJoin(sql, sqlUpper, params, data);
  }

  if (sqlUpper.includes('COUNT(')) {
    return handleCount(sql, sqlUpper, params, data);
  }

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

// ========== معالج JOIN ==========
function handleJoin(sql, sqlUpper, params, data) {
  const tableMatches = sql.match(/FROM\s+(\w+)(?:\s+(\w+))?/i);
  if (!tableMatches) return [];
  
  const mainTable = tableMatches[1];
  const mainAlias = tableMatches[2] || mainTable;
  
  const joinPattern = /(LEFT\s+)?JOIN\s+(\w+)\s+(\w+)\s+ON\s*\(?\s*(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)\s*\)?/gi;
  const joins = [];
  let match;
  
  joinPattern.lastIndex = 0;
  while ((match = joinPattern.exec(sql)) !== null) {
    joins.push({
      type: match[1] ? 'LEFT' : 'INNER',
      table: match[2],
      alias: match[3],
      leftTable: match[4],
      leftCol: match[5],
      rightTable: match[6],
      rightCol: match[7]
    });
  }

  let rows = [...(data[mainTable] || [])];

  const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i);
  if (whereMatch) {
    rows = applyFilters(rows, sql, params);
  }

  for (const join of joins) {
    const rightData = data[join.table] || [];
    
    rows = rows.map(row => {
      const isLeftMain = join.leftTable.toLowerCase() === mainAlias.toLowerCase() || join.leftTable.toLowerCase() === mainTable.toLowerCase();
      const targetLeftCol = isLeftMain ? join.leftCol : join.rightCol;
      const targetRightCol = isLeftMain ? join.rightCol : join.leftCol;

      const matched = rightData.find(r => String(r[targetRightCol]) === String(row[targetLeftCol]));
      
      if (matched) {
        const newRow = { ...row };
        for (const key of Object.keys(matched)) {
          newRow[`${join.alias}_${key}`] = matched[key];
          if (newRow[key] === undefined) {
            newRow[key] = matched[key];
          }
        }
        return newRow;
      }
      
      return join.type === 'LEFT' ? { ...row } : null;
    }).filter(Boolean);
  }

  if (sqlUpper.includes('GROUP BY')) {
    const groupMatch = sql.match(/GROUP\s+BY\s+([\w.]+)/i);
    if (groupMatch) {
      const fullGroupCol = groupMatch[1];
      const groupCol = fullGroupCol.includes('.') ? fullGroupCol.split('.')[1] : fullGroupCol;
      const aggregated = {};
      
      rows.forEach(row => {
        const key = row[groupCol] || row[fullGroupCol.replace('.', '_')] || 'unknown';
        if (!aggregated[key]) {
          aggregated[key] = { ...row, present_days: 0, absent_days: 0, late_days: 0, total_days: 0 };
        }
        if (row.status === 'present') aggregated[key].present_days++;
        if (row.status === 'absent') aggregated[key].absent_days++;
        if (row.status === 'late') { aggregated[key].late_days++; aggregated[key].present_days++; }
        
        aggregated[key].total_days++;
        aggregated[key].rate = aggregated[key].total_days > 0 ? Math.round((aggregated[key].present_days / aggregated[key].total_days) * 100) : 0;
      });
      
      rows = Object.values(aggregated);
    }
  }

  const orderMatch = sql.match(/ORDER\s+BY\s+([\w.]+)\s*(DESC)?/i);
  if (orderMatch) {
    const fullCol = orderMatch[1];
    const col = fullCol.includes('.') ? fullCol.split('.')[1] : fullCol;
    const desc = orderMatch[2];
    rows.sort((a, b) => {
      const va = a[col] !== undefined ? a[col] : (a[`${fullCol.replace('.', '_')}`] || '');
      const vb = b[col] !== undefined ? b[col] : (b[`${fullCol.replace('.', '_')}`] || '');
      if (va < vb) return desc ? 1 : -1;
      if (va > vb) return desc ? -1 : 1;
      return 0;
    });
  }

  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    rows = rows.slice(0, parseInt(limitMatch[1]));
  }

  return rows;
}

// ========== معالج COUNT ==========
function handleCount(sql, sqlUpper, params, data) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return [{ c: 0 }];
  const table = tableMatch[1];
  if (!data[table]) return [{ c: 0 }];

  let rows = [...data[table]];
  rows = applyFilters(rows, sql, params);

  if (sqlUpper.includes('DISTINCT')) {
    const colMatch = sql.match(/DISTINCT\s+(\w+)/i);
    if (colMatch) {
      const uniqueValues = new Set(rows.map(r => r[colMatch[1]]));
      return [{ c: uniqueValues.size }];
    }
  }

  return [{ c: rows.length }];
}

// ========== معالج SELECT ==========
function handleSelect(sql, sqlUpper, params, data) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return [];
  const table = tableMatch[1];
  if (!data[table]) return [];

  let rows = [...data[table]];
  rows = applyFilters(rows, sql, params);

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

  return rows;
}

// ========== الفلترة الذكية ==========
function applyFilters(rows, sql, params) {
  const sqlClean = sql.toUpperCase().replace(/\s+/g, ' ');
  
  if (sqlClean.includes("STATUS='ACTIVE'")) rows = rows.filter(r => r.status === 'active');
  if (sqlClean.includes("STATUS='PRESENT'")) rows = rows.filter(r => r.status === 'present');
  if (sqlClean.includes("STATUS='ABSENT'")) rows = rows.filter(r => r.status === 'absent');
  if (sqlClean.includes("STATUS='LATE'")) rows = rows.filter(r => r.status === 'late');

  const dateLikeMatch = sql.match(/DATE\s+LIKE\s+'([\d-]+)%'/i);
  if (dateLikeMatch) {
    const monthPrefix = dateLikeMatch[1];
    rows = rows.filter(r => r.date && r.date.startsWith(monthPrefix));
  } else if (sqlClean.includes('DATE=?') && params.length > 0) {
    rows = rows.filter(r => r.date === params[0]);
  }

  if (sqlClean.includes('STUDENT_ID=?') && params.length > 0) {
    rows = rows.filter(r => String(r.student_id) === String(params[0]));
  }

  if (sqlClean.includes('COLLEGE_ID=?') && params.length > 0) {
    rows = rows.filter(r => String(r.college_id) === String(params[0]));
  }
  if (sqlClean.includes('DEPARTMENT_ID=?') && params.length > 0) {
    const idx = sqlClean.indexOf('DEPARTMENT_ID=?') < sqlClean.indexOf('COLLEGE_ID=?') ? 0 : (params.length - 1);
    rows = rows.filter(r => String(r.department_id) === String(params[idx]));
  }

  return rows;
}

// ========== معالج INSERT الإمبراطوري المرن (يقبل أي ترتيب وأي هيكلية) ==========
function handleInsert(sql, params, data) {
  const tableMatch = sql.match(/INTO\s+(\w+)/i);
  if (!tableMatch) return;
  const table = tableMatch[1];
  if (!data[table]) data[table] = [];

  const row = { id: nextId(data), created_at: new Date().toISOString(), status: 'active' };

  // إذا تم تمرير البيانات كـ Object مباشر بدلاً من مصفوفة معماة
  if (params && !Array.isArray(params) && typeof params === 'object') {
    Object.keys(params).forEach(key => {
      row[key] = (params[key] === '' || params[key] === undefined) ? null : params[key];
    });
  } else {
    // استخراج أسماء الأعمدة المستهدفة من الاستعلام لربطها بالـ params بشكل ديناميكي مرن
    const columnsMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
    if (columnsMatch && params.length > 0) {
      const cols = columnsMatch[1].split(',').map(c => c.trim().toLowerCase());
      cols.forEach((col, idx) => {
        if (params[idx] !== undefined) {
          row[col] = (params[idx] === '' || params[idx] === undefined) ? null : params[idx];
        }
      });
    } else {
      // الـ Fallback التقليدي القديم للحفاظ على التوافقية الكاملة
      if (table === 'attendance') {
        row.student_id = params[0]; row.date = params[1]; row.time_in = params[2];
        row.status = params[3] || 'present'; row.late_minutes = params[4] || 0; row.method = params[5] || 'fingerprint';
      } else if (table === 'students') {
        row.university_id = params[0]; row.full_name = params[1]; row.phone = params[2] || ''; row.major_id = params[3] || params[5] || null;
      } else if (table === 'colleges') {
        row.name = params[0]; row.code = params[1] || '';
      } else if (table === 'departments') {
        row.name = params[0]; row.college_id = params[1]; row.code = params[2] || '';
      } else if (table === 'majors') {
        row.name = params[0]; row.department_id = params[1]; row.college_id = params[2]; row.fees = params[3] || 0; row.duration = params[4] || 4;
      } else if (params[0]) {
        row.name = params[0];
      }
    }
  }

  // دعم تكميلي ذكي: التأكد من سحب الحقول الحيوية المتقاطعة لضمان عدم حدوث قيم ميتة
  if (table === 'students') {
    if (!row.university_id && params[0]) row.university_id = params[0];
    if (!row.full_name && params[1]) row.full_name = params[1];
    // ربط تلقائي ذكي للكلية عبر التخصص المختار إذا لم يُرسل صراحة
    if (row.major_id && data.majors) {
      const major = data.majors.find(m => String(m.id) === String(row.major_id));
      if (major) {
        row.college_id = major.college_id;
        row.department_id = major.department_id;
      }
    }
  }

  data[table].push(row);
}

// ========== معالج UPDATE الإمبراطوري المرن ==========
function handleUpdate(sql, params, data) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (!tableMatch || !params || params.length === 0) return;
  const table = tableMatch[1];
  if (!data[table]) return;

  if (table === 'attendance') {
    const studentId = params[2];
    const targetDate = params[3];
    const idx = data[table].findIndex(r => r.student_id === studentId && r.date === targetDate);
    if (idx >= 0) {
      data[table][idx].status = params[0];
      data[table][idx].time_in = params[1];
      if (params[4]) data[table][idx].time_out = params[4];
    }
  } else {
    // استخراج كود الـ SET ديناميكياً لتحديث الحقول بأسمائها بغض النظر عن موقعها
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    const id = params[params.length - 1]; // الـ ID هو المعامل الأخير دائماً بالـ WHERE
    const idx = data[table].findIndex(r => r.id === id);

    if (idx >= 0 && setMatch) {
      const setFields = setMatch[1].split(',').map(f => f.split('=')[0].trim().toLowerCase());
      setFields.forEach((field, i) => {
        if (params[i] !== undefined) {
          data[table][idx][field] = params[i];
        }
      });
      
      // مزامنة أمنية حية بعد التحديث
      if (table === 'students' && data[table][idx].major_id && data.majors) {
        const major = data.majors.find(m => String(m.id) === String(data[table][idx].major_id));
        if (major) {
          data[table][idx].college_id = major.college_id;
          data[table][idx].department_id = major.department_id;
        }
      }
    } else if (idx >= 0) {
      // الـ Fallback التقليدي
      if (table === 'colleges') {
        data[table][idx].name = params[0]; data[table][idx].code = params[1] || '';
      } else if (table === 'departments') {
        data[table][idx].name = params[0]; data[table][idx].college_id = params[1]; data[table][idx].code = params[2] || '';
      } else if (table === 'majors') {
        data[table][idx].name = params[0]; data[table][idx].department_id = params[1];
        data[table][idx].college_id = params[2]; data[table][idx].fees = params[3]; data[table][idx].duration = params[4];
      }
    }
  }
}

// ========== معالج DELETE ==========
function handleDelete(sql, params, data) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch || params.length === 0) return;
  const table = tableMatch[1];
  if (!data[table]) return;

  if (table === 'attendance' && sql.toUpperCase().includes('STUDENT_ID=?')) {
    data[table] = data[table].filter(r => !(r.student_id === params[0] && r.date === params[1]));
  } else {
    data[table] = data[table].filter(r => r.id !== params[0]);
  }
}

export function exportDatabase() {
  const data = loadData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importDatabase(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    saveData(validateAndRepair(data));
    return data;
  } catch (e) { return null; }
}
