// src/services/db.js - قاعدة بيانات Supabase السحابية
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
    // استخراج اسم الجدول من الاستعلام
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return [];
    
    const table = tableMatch[1];
    let query = supabase.from(table).select('*');

    // WHERE
    if (sql.toUpperCase().includes("STATUS='ACTIVE'")) {
      query = query.eq('status', 'active');
    }

    // WHERE date = ?
    if (sql.toUpperCase().includes('DATE=?') && params.length > 0) {
      query = query.eq('date', params[0]);
    }

    // ORDER BY
    const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)/i);
    if (orderMatch) {
      query = query.order(orderMatch[1], { ascending: true });
    }

    // LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      query = query.limit(parseInt(limitMatch[1]));
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Supabase Query Error:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('❌ getQuery Error:', e);
    return [];
  }
}

// ========== تنفيذ أوامر (INSERT/UPDATE/DELETE) ==========
export async function runQuery(sql, params = []) {
  try {
    const sqlUpper = sql.toUpperCase().trim();

    // INSERT
    if (sqlUpper.startsWith('INSERT')) {
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
      if (error) console.error('❌ Insert Error:', error);
      return { error };
    }

    // UPDATE
    if (sqlUpper.startsWith('UPDATE')) {
      const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
      if (!tableMatch) return null;
      const table = tableMatch[1];

      if (table === 'attendance' && sqlUpper.includes('STUDENT_ID=?') && sqlUpper.includes('DATE=?')) {
        const { error } = await supabase.from(table)
          .update({ status: params[0], time_in: params[3] })
          .eq('student_id', params[1])
          .eq('date', params[2]);
        if (error) console.error('❌ Update Error:', error);
        return { error };
      }

      if (table === 'devices' && sqlUpper.includes('ID=?')) {
        const { error } = await supabase.from(table)
          .update({ status: params[0], last_sync: params[1] })
          .eq('id', params[2]);
        if (error) console.error('❌ Update Error:', error);
        return { error };
      }
    }

    // DELETE
    if (sqlUpper.startsWith('DELETE')) {
      const tableMatch = sql.match(/FROM\s+(\w+)/i);
      if (!tableMatch) return null;
      const table = tableMatch[1];

      const { error } = await supabase.from(table).delete().eq('id', params[0]);
      if (error) console.error('❌ Delete Error:', error);
      return { error };
    }

    return null;
  } catch (e) {
    console.error('❌ runQuery Error:', e);
    return null;
  }
}

// ========== نسخ احتياطي ==========
export function exportDatabase() {
  console.log('📥 النسخ الاحتياطي متاح عبر Supabase Dashboard');
}

export async function importDatabase(file) {
  console.log('📤 الاستيراد متاح عبر Supabase Dashboard');
}
