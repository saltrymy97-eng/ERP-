// src/services/db.js – قاعدة بيانات Supabase السحابية
import { createClient } from '@supabase/supabase-js';

// ========== إعدادات Supabase ==========
const SUPABASE_URL = 'https://dboornlxohzwltylqceu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRib29ybmx4b2h6d2x0eWxxY2V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjI2MjA3MiwiZXhwIjoyMDk3ODM4MDcyfQ.lqqPioK_vWqJlfUnxDcmhBZqksKONIyuWA8dgDNwu1w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== API العامة ==========
export async function initDatabase() {
  console.log('✅ Supabase جاهز');
  return true;
}

export async function loadFromLocalStorage() {
  return [];
}

export function closeDatabase() {}

// ========== جلب البيانات (GET) ==========
export async function getQuery(sql, params = []) {
  try {
    const sqlUpper = sql.toUpperCase().trim();

    // COUNT
    if (sqlUpper.includes('COUNT(*)')) {
      return await handleCount(sql, sqlUpper, params);
    }

    // JOIN
    if (sqlUpper.includes('JOIN')) {
      return await handleJoin(sql, sqlUpper, params);
    }

    // SELECT بسيط
    return await handleSimpleSelect(sql, sqlUpper, params);
  } catch (e) {
    console.error('❌ getQuery Error:', e);
    return [];
  }
}

// ========== تنفيذ أوامر (INSERT/UPDATE/DELETE) ==========
export async function runQuery(sql, params = []) {
  try {
    const sqlUpper = sql.toUpperCase().trim();

    if (sqlUpper.startsWith('INSERT')) {
      return await handleInsert(sql, params);
    }
    if (sqlUpper.startsWith('UPDATE')) {
      return await handleUpdate(sql, params);
    }
    if (sqlUpper.startsWith('DELETE')) {
      return await handleDelete(sql, params);
    }
    return null;
  } catch (e) {
    console.error('❌ runQuery Error:', e);
    return null;
  }
}

// ========== معالج SELECT البسيط ==========
async function handleSimpleSelect(sql, sqlUpper, params) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return [];
  const table = tableMatch[1];

  let query = supabase.from(table).select('*');

  // WHERE status = 'active'
  if (sqlUpper.includes("STATUS='ACTIVE'")) {
    query = query.eq('status', 'active');
  }

  // WHERE date = ?
  if (sqlUpper.includes('DATE=?') && params.length > 0) {
    query = query.eq('date', params[0]);
  }

  // ORDER BY
  const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(\s+DESC)?/i);
  if (orderMatch) {
    const col = orderMatch[1].toLowerCase();
    const asc = !orderMatch[2];
    query = query.order(col, { ascending: asc });
  }

  // LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    query = query.limit(parseInt(limitMatch[1]));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ========== معالج COUNT ==========
async function handleCount(sql, sqlUpper, params) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return [{ c: 0 }];
  const table = tableMatch[1];

  let query = supabase.from(table).select('*', { count: 'exact', head: true });

  // DISTINCT
  if (sqlUpper.includes('DISTINCT')) {
    const colMatch = sql.match(/DISTINCT\s+(\w+)/i);
    if (colMatch) {
      const { data, error } = await supabase.from(table).select(colMatch[1]);
      if (error) throw error;
      const uniqueValues = new Set(data.map(r => r[colMatch[1]]));
      return [{ c: uniqueValues.size }];
    }
  }

  // WHERE status = ?
  if (sqlUpper.includes("STATUS='PRESENT'")) query = query.eq('status', 'present');
  if (sqlUpper.includes("STATUS='ABSENT'")) query = query.eq('status', 'absent');
  if (sqlUpper.includes("STATUS='LATE'")) query = query.eq('status', 'late');

  // WHERE date = ?
  if (sqlUpper.includes('DATE=?') && params.length > 0) {
    query = query.eq('date', params[0]);
  }

  const { count, error } = await query;
  if (error) throw error;
  return [{ c: count || 0 }];
}

// ========== معالج JOIN ==========
async function handleJoin(sql, sqlUpper, params) {
  // استخراج الجداول
  const tableMatches = sql.match(/FROM\s+(\w+)\s+(\w+)/i);
  if (!tableMatches) return [];
  
  const mainTable = tableMatches[1];
  const today = params[0] || new Date().toISOString().slice(0, 10);

  // إذا كان JOIN مع students و attendance
  if (sqlUpper.includes('STUDENTS') && sqlUpper.includes('ATTENDANCE')) {
    let query = supabase.from(mainTable).select('*, students!inner(*), majors(*), departments(*), colleges(*)');

    // WHERE date = ?
    if (sqlUpper.includes('DATE=?') && params.length > 0) {
      query = query.eq('date', params[0]);
    }

    // ORDER BY
    if (sqlUpper.includes('ORDER BY')) {
      const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(\s+DESC)?/i);
      if (orderMatch) {
        query = query.order(orderMatch[1].toLowerCase(), { ascending: !orderMatch[2] });
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    // دمج البيانات
    return (data || []).map(row => ({
      ...row,
      ...row.students,
      major_name: row.majors?.name,
      college_name: row.colleges?.name
    }));
  }

  // JOIN students with majors, departments, colleges
  if (sqlUpper.includes('STUDENTS') && sqlUpper.includes('MAJORS')) {
    let query = supabase.from('students')
      .select('*, majors(name), departments(name), colleges(name)')
      .eq('status', 'active');

    // ORDER BY
    if (sqlUpper.includes('ORDER BY')) {
      const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)/i);
      if (orderMatch) {
        query = query.order(orderMatch[1].toLowerCase());
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      major_name: row.majors?.name,
      department_name: row.departments?.name,
      college_name: row.colleges?.name
    }));
  }

  return [];
}

// ========== معالج INSERT ==========
async function handleInsert(sql, params) {
  const tableMatch = sql.match(/INTO\s+(\w+)/i);
  if (!tableMatch) return null;
  const table = tableMatch[1];

  const row = {};
  if (table === 'colleges') {
    row.name = params[0];
    row.status = 'active';
  } else if (table === 'departments') {
    row.name = params[0];
    row.college_id = params[1];
    row.status = 'active';
  } else if (table === 'majors') {
    row.name = params[0];
    row.department_id = params[1];
    row.fees = params[2] || 0;
    row.duration = params[3] || '4 سنوات';
    row.status = 'active';
  } else if (table === 'students') {
    row.university_id = params[0];
    row.full_name = params[1];
    row.phone = params[2] || '';
    row.major_id = params[5] || null;
    row.status = 'active';
  } else if (table === 'attendance') {
    row.student_id = params[0];
    row.date = params[1];
    row.time_in = params[2] || new Date().toLocaleTimeString('ar-SA');
    row.status = params[3] || 'present';
    row.method = params[5] || 'fingerprint';
  } else if (table === 'devices') {
    row.name = params[0];
    row.ip_address = params[1];
    row.port = params[2] || 4370;
    row.status = 'offline';
  } else if (table === 'calendar') {
    row.event = params[0];
    row.date_from = params[1];
    row.date_to = params[2];
    row.type = params[3] || 'event';
  }

  const { error } = await supabase.from(table).insert([row]);
  if (error) throw error;
  return { success: true };
}

// ========== معالج UPDATE ==========
async function handleUpdate(sql, params) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
  if (!tableMatch || params.length < 2) return null;
  const table = tableMatch[1];
  const sqlUpper = sql.toUpperCase();

  if (table === 'attendance' && sqlUpper.includes('STUDENT_ID=?') && sqlUpper.includes('DATE=?')) {
    const { error } = await supabase.from(table)
      .update({ status: params[0], time_in: params[3] || null })
      .eq('student_id', params[1])
      .eq('date', params[2]);
    if (error) throw error;
    return { success: true };
  }

  if (table === 'devices' && sqlUpper.includes('ID=?')) {
    const { error } = await supabase.from(table)
      .update({ status: params[0], last_sync: params[1] })
      .eq('id', params[2]);
    if (error) throw error;
    return { success: true };
  }

  if (table === 'colleges' && sqlUpper.includes("STATUS='INACTIVE'")) {
    const { error } = await supabase.from(table).update({ status: 'inactive' }).eq('id', params[0]);
    if (error) throw error;
    return { success: true };
  }

  return null;
}

// ========== معالج DELETE ==========
async function handleDelete(sql, params) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch || params.length === 0) return null;
  const table = tableMatch[1];

  const { error } = await supabase.from(table).delete().eq('id', params[0]);
  if (error) throw error;
  return { success: true };
}

// ========== نسخ احتياطي ==========
export function exportDatabase() {
  console.log('📥 النسخ الاحتياطي متاح عبر Supabase Dashboard');
}

export async function importDatabase(file) {
  console.log('📤 الاستيراد متاح عبر Supabase Dashboard');
}
