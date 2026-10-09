// src/components/Settings.js – المركز السيادي واللوحة القيادية العليا للنظام
// الإصدار: 3.2.0 - إصلاحات أمنية + استيراد Excel الذكي للمدرسين والطلاب
// مطور النظام: المهندس سالم فهمي التريمي
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuery, runQuery, initDatabase, exportDatabase, importDatabase } from '../services/db';
import { getCurrentUser, changePassword, deleteUser, getAllUsers, isAdmin } from '../services/auth';
import { loadMobileModel } from '../services/ai';
import * as XLSX from 'xlsx';

function Settings() {
  const [tab, setTab] = useState('devices');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [dbReady, setDbReady] = useState(false);

  // ========== بوابات البصمة ==========
  const [devices, setDevices] = useState([]);
  const [deviceForm, setDeviceForm] = useState({ name: '', ip_address: '', port: 4370 });
  const [isTestingId, setIsTestingId] = useState(null);

  // ========== وحدة تسجيل البصمات الـ 5 الاحتياطية ==========
  const [enrollTarget, setEnrollTarget] = useState('student');
  const [peopleList, setPeopleList] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [activeDeviceId, setActiveDeviceId] = useState('');
  const [enrollingFinger, setEnrollingFinger] = useState(null);
  const [fingerTemplates, setFingerTemplates] = useState([null, null, null, null, null]);
  const [enrollStatusText, setEnrollStatusText] = useState('');

  // ========== استيراد Excel ==========
  const [excelFile, setExcelFile] = useState(null);
  const [excelPreview, setExcelPreview] = useState(null);
  const [excelColumns, setExcelColumns] = useState({ id: '', name: '', date: '', time: '' });
  const [excelTarget, setExcelTarget] = useState('student');
  const [lateThreshold, setLateThreshold] = useState('08:15');
  const [markAbsents, setMarkAbsents] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // ========== إعدادات الذكاء الاصطناعي ==========
  const [aiConfig, setAiConfig] = useState({ api_key: '', enabled: false, model: 'openai/gpt-oss-20b' });

  // ========== التقويم الأكاديمي ==========
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [eventForm, setEventForm] = useState({ event: '', date_from: '', date_to: '', type: 'event' });

  // ========== الجداول الدراسية ==========
  const [schedules, setSchedules] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({ day: '', subject: '', teacher: '', time_from: '', time_to: '', room: '', break_time: 0, late_tolerance: 10 });

  // ========== الصلاحيات ==========
  const [users, setUsers] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const currentUser = getCurrentUser();

  // =========================================================
  // 🎬 التهيئة الأولية
  // =========================================================
  useEffect(() => {
    const setup = async () => {
      try {
        await initDatabase();
        setDbReady(true);
        await loadDevices();
        await loadCalendar();
        await loadSchedules();
        if (isAdmin()) loadUsers();

        const savedAI = localStorage.getItem('ai_config');
        if (savedAI) {
          try {
            const parsedAI = JSON.parse(savedAI);
            setAiConfig({
              api_key: '',
              enabled: parsedAI.enabled ?? false,
              model: 'openai/gpt-oss-20b'
            });
          } catch (e) { console.error("Error parsing AI config:", e); }
        }
      } catch (err) { console.error("Initialization Error:", err); }
    };
    setup();
  }, []);

  useEffect(() => { loadPeopleForEnroll(); }, [enrollTarget, dbReady]);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg); setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  // =========================================================
  // 📡 إدارة البوابات
  // =========================================================
  const loadDevices = async () => {
    const data = await getQuery("SELECT * FROM devices ORDER BY name");
    setDevices(data || []);
    if (data && data.length > 0) setActiveDeviceId(data[0].id);
  };

  const addDevice = async () => {
    if (!deviceForm.name || !deviceForm.ip_address) { showMessage('❌ يرجى ملء اسم البوابة وعنوان IP', 'error'); return; }
    await runQuery("INSERT INTO devices (name, ip_address, port, status) VALUES (?, ?, ?, 'offline')", [deviceForm.name, deviceForm.ip_address, deviceForm.port]);
    setDeviceForm({ name: '', ip_address: '', port: 4370 });
    await loadDevices();
    showMessage('✨ تم تسجيل البوابة بنجاح');
  };

  const deleteDevice = async (id) => {
    await runQuery("DELETE FROM devices WHERE id = ?", [id]);
    await loadDevices();
    showMessage('🗑️ تم إلغاء الجهاز');
  };

  const testConnection = async (device) => {
    setIsTestingId(device.id);
    showMessage(`🔌 جاري فحص الاتصال بـ ${device.name}...`, 'info');
    try {
      if (window.electronAPI && typeof window.electronAPI.testDevicePing === 'function') {
        const isOnline = await window.electronAPI.testDevicePing(device.ip_address, device.port);
        if (isOnline) {
          await runQuery("UPDATE devices SET status = 'online', last_sync = ? WHERE id = ?", [new Date().toISOString(), device.id]);
          await loadDevices();
          showMessage(`🟢 تم الاتصال بنجاح!`);
        } else throw new Error("Device offline");
      } else throw new Error("Electron API missing");
    } catch (err) {
      await runQuery("UPDATE devices SET status = 'offline' WHERE id = ?", [device.id]);
      await loadDevices();
      showMessage(`❌ فشل الاتصال بـ ${device.name}.`, 'error');
    } finally { setIsTestingId(null); }
  };

  // =========================================================
  // 🖐️ نظام تسجيل البصمات (🟢 إصلاحات أمنية)
  // =========================================================
  const loadPeopleForEnroll = async () => {
    if (!dbReady) return;
    const data = enrollTarget === 'student'
      ? await getQuery("SELECT id, full_name FROM students WHERE status = 'active' ORDER BY full_name")
      : await getQuery("SELECT id, full_name FROM teachers WHERE status = 'active' ORDER BY full_name");
    setPeopleList(data || []);
    setSelectedPersonId('');
    setFingerTemplates([null, null, null, null, null]);
  };

  const checkExistingFingerprints = async (personId) => {
    if (!personId) return;
    const table = enrollTarget === 'student' ? 'student_fingerprints' : 'teacher_fingerprints';
    const foreignKey = enrollTarget === 'student' ? 'student_id' : 'teacher_id';
    const existing = await getQuery(`SELECT finger_index, template FROM ${table} WHERE ${foreignKey} = ?`, [personId]);
    const templatesMap = [null, null, null, null, null];
    if (existing) existing.forEach(f => {
      if (f.finger_index >= 0 && f.finger_index < 5 && f.template && !f.template.includes('placeholder')) {
        templatesMap[f.finger_index] = f.template;
      }
    });
    setFingerTemplates(templatesMap);
  };

  const handlePersonChange = (e) => {
    const id = e.target.value;
    setSelectedPersonId(id);
    checkExistingFingerprints(id);
  };

  const enrollFingerprintDevice = async (fingerIndex) => {
    const activeDevice = devices.find(d => d.id === parseInt(activeDeviceId));
    if (!activeDevice) { showMessage('❌ يرجى اختيار جهاز بصمة أولاً', 'error'); return; }
    if (!selectedPersonId) { showMessage('❌ يرجى اختيار الشخص أولاً', 'error'); return; }

    setEnrollingFinger(fingerIndex);
    setEnrollStatusText(`⏳ يرجى وضع الإصبع رقم ${fingerIndex + 1} على القارئ...`);

    try {
      if (window.electronAPI && typeof window.electronAPI.enrollFinger === 'function') {
        const result = await window.electronAPI.enrollFinger({
          ip: activeDevice.ip_address,
          port: activeDevice.port,
          userId: parseInt(selectedPersonId),
          fingerId: fingerIndex
        });

        if (result && result.success) {
          if (!result.template || result.template.includes('placeholder')) {
            setEnrollStatusText(`⚠️ تم التقاط البصمة على الجهاز لكن القالب لم يُستلم. حاول مرة أخرى.`);
            showMessage('⚠️ لم يتم استلام قالب البصمة من الجهاز', 'error');
            return;
          }

          const table = enrollTarget === 'student' ? 'student_fingerprints' : 'teacher_fingerprints';
          const foreignKey = enrollTarget === 'student' ? 'student_id' : 'teacher_id';

          await runQuery(`DELETE FROM ${table} WHERE ${foreignKey} = ? AND finger_index = ?`, [selectedPersonId, fingerIndex]);
          await runQuery(`INSERT INTO ${table} (${foreignKey}, finger_index, template) VALUES (?, ?, ?)`,
            [selectedPersonId, fingerIndex, result.template]);

          const newTemplates = [...fingerTemplates];
          newTemplates[fingerIndex] = result.template;
          setFingerTemplates(newTemplates);

          setEnrollStatusText(`✅ تم تسجيل الإصبع رقم ${fingerIndex + 1} بنجاح!`);
          showMessage(`✨ تم تسجيل البصمة رقم ${fingerIndex + 1}`);
        } else {
          throw new Error(result.error || "فشل التسجيل");
        }
      } else throw new Error("Electron غير مهيأ لدعم الميزة.");
    } catch (err) {
      setEnrollStatusText(`❌ فشل التسجيل: ${err.message}`);
      showMessage(`❌ فشل: ${err.message}`, 'error');
    } finally { setEnrollingFinger(null); }
  };

  // =========================================================
  // 📊 استيراد Excel
  // =========================================================
  const detectColumns = (headers) => {
    const patterns = {
      id: [/الرقم الجامعي/i, /الرقم الوظيفي/i, /^رقم$/i, /^id$/i, /^pin$/i, /user\s*id/i, /employee\s*id/i, /^uid$/i, /^no\.?$/i, /رقم البصمة/i, /enroll/i],
      name: [/^الاسم$/i, /^اسم$/i, /^name$/i, /full\s*name/i, /اسم الطالب/i, /اسم الموظف/i, /اسم المعلم/i, /اسم المدرس/i],
      date: [/^التاريخ$/i, /^تاريخ$/i, /^date$/i, /^day$/i],
      time: [/^الوقت$/i, /^وقت$/i, /^time$/i, /clock\s*in/i, /check\s*in/i, /وقت الحضور/i, /وقت الدخول/i]
    };
    const findCol = (cat) => {
      for (const h of headers) {
        const trimmed = String(h).trim();
        for (const p of patterns[cat]) if (p.test(trimmed)) return h;
      }
      return '';
    };
    return { id: findCol('id'), name: findCol('name'), date: findCol('date'), time: findCol('time') };
  };

  const parseExcelDate = (value) => {
    if (!value) return null;
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (slashMatch) {
      let [, p1, p2, year] = slashMatch;
      if (year.length === 2) year = '20' + year;
      return `${year}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return null;
  };

  const parseExcelTime = (value) => {
    if (!value) return null;
    const str = String(value).trim();
    const match = str.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
    return null;
  };

  const handleExcelFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setImportResult(null);
    setExcelPreview(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '', header: 1 });

      if (!rows || rows.length < 2) {
        showMessage('❌ الملف فارغ أو لا يحتوي على بيانات كافية', 'error');
        return;
      }

      const headers = rows[0].map(h => String(h || '').trim());
      const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
      const detected = detectColumns(headers);
      setExcelColumns(detected);

      const preview = dataRows.slice(0, 10).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });

      setExcelPreview({ headers, rows: preview, totalRows: dataRows.length });

      const missing = [];
      if (!detected.id && !detected.name) missing.push('الرقم أو الاسم');
      if (!detected.date) missing.push('التاريخ');
      if (!detected.time) missing.push('الوقت');

      if (missing.length > 0) {
        showMessage(`⚠️ لم يتم التعرف على: ${missing.join('، ')}`, 'error');
      } else {
        const msg = [];
        if (detected.id) msg.push(`ID=${detected.id}`);
        if (detected.name) msg.push(`الاسم=${detected.name}`);
        msg.push(`التاريخ=${detected.date}`, `الوقت=${detected.time}`);
        showMessage(`✅ تم التحميل: ${dataRows.length} سجل`);
      }
    } catch (err) {
      console.error(err);
      showMessage(`❌ فشل قراءة الملف: ${err.message}`, 'error');
    }
  };

  const downloadExcelTemplate = () => {
    const template = [
      { 'الرقم': '645575', 'الاسم': 'أحمد محمد', 'التاريخ': '2026-10-09', 'الوقت': '08:15' },
      { 'الرقم': '645576', 'الاسم': 'علي سالم', 'التاريخ': '2026-10-09', 'الوقت': '08:45' },
      { 'الرقم': '', 'الاسم': 'محمد يوسف', 'التاريخ': '2026-10-09', 'الوقت': '07:55' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجلات البصمة');
    XLSX.writeFile(wb, 'قالب_استيراد_الحضور.xlsx');
    showMessage('📥 تم تحميل القالب');
  };

  const handleExcelImport = async () => {
    if (!excelFile || !excelPreview) { showMessage('❌ يرجى اختيار ملف أولاً', 'error'); return; }
    if (!excelColumns.id && !excelColumns.name) { showMessage('❌ يجب تحديد ID أو الاسم على الأقل', 'error'); return; }
    if (!excelColumns.date || !excelColumns.time) { showMessage('❌ لم يتم التعرف على التاريخ والوقت', 'error'); return; }

    setImporting(true);
    setImportResult(null);

    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });

      const isStudent = excelTarget === 'student';
      const table = isStudent ? 'attendance' : 'teacher_attendance';
      const foreignKey = isStudent ? 'student_id' : 'teacher_id';
      const sourceTable = isStudent ? 'students' : 'teachers';
      const idColumn = isStudent ? 'university_id' : 'teacher_id';
      const nameColumn = 'full_name';

      const recordsMap = {};
      const errors = [];
      let rowNumber = 1;

      for (const row of rows) {
        rowNumber++;

        const rawId = excelColumns.id ? String(row[excelColumns.id] || '').trim() : '';
        const rawName = excelColumns.name ? String(row[excelColumns.name] || '').trim() : '';
        const dateStr = parseExcelDate(row[excelColumns.date]);
        const timeStr = parseExcelTime(row[excelColumns.time]);

        if (!rawId && !rawName && !dateStr && !timeStr) continue;

        if (!dateStr || !timeStr) {
          errors.push({
            row: rowNumber,
            id: rawId || '—',
            name: rawName || '—',
            reason: !dateStr && !timeStr ? 'تاريخ ووقت غير صالحين' : (!dateStr ? 'تاريخ غير صالح' : 'وقت غير صالح')
          });
          continue;
        }

        let person = null;
        let matchMethod = '';

        if (rawId) {
          const byId = await getQuery(`SELECT id, ${nameColumn} FROM ${sourceTable} WHERE ${idColumn} = ? LIMIT 1`, [rawId]);
          if (byId && byId.length > 0) { person = byId[0]; matchMethod = 'ID'; }
        }

        if (!person && rawName) {
          const byName = await getQuery(`SELECT id, ${nameColumn} FROM ${sourceTable} WHERE ${nameColumn} = ?`, [rawName]);
          if (byName && byName.length === 1) {
            person = byName[0];
            matchMethod = 'الاسم';
          } else if (byName && byName.length > 1) {
            errors.push({
              row: rowNumber,
              id: rawId || '—',
              name: rawName,
              reason: `الاسم مكرر (${byName.length} حالات) — يُرجى استخدام الرقم`
            });
            continue;
          }
        }

        if (!person) {
          errors.push({
            row: rowNumber,
            id: rawId || '—',
            name: rawName || '—',
            reason: 'لم يُعثر على الشخص (لا بالرقم ولا بالاسم)'
          });
          continue;
        }

        const key = `${person.id}_${dateStr}`;
        if (!recordsMap[key] || timeStr < recordsMap[key].time) {
          recordsMap[key] = {
            personId: person.id,
            personName: person[nameColumn],
            date: dateStr,
            time: timeStr,
            matchedBy: matchMethod,
            row: rowNumber
          };
        }
      }

      const records = Object.values(recordsMap);
      if (records.length === 0) {
        setImportResult({
          total: 0, inserted: 0, updated: 0,
          presentCount: 0, lateCount: 0, absentCount: 0,
          matchedById: 0, matchedByName: 0,
          totalErrors: errors.length,
          errors: errors.slice(0, 20)
        });
        showMessage('⚠️ لا توجد سجلات صالحة', 'error');
        setImporting(false);
        return;
      }

      let inserted = 0, updated = 0;
      let presentCount = 0, lateCount = 0, absentCount = 0;
      let matchedById = 0, matchedByName = 0;

      for (const rec of records) {
        if (rec.matchedBy === 'ID') matchedById++; else matchedByName++;

        const status = rec.time <= lateThreshold ? 'present' : 'late';
        const exists = await getQuery(`SELECT id FROM ${table} WHERE ${foreignKey} = ? AND date = ?`, [rec.personId, rec.date]);

        if (exists && exists.length > 0) {
          await runQuery(`UPDATE ${table} SET time_in = ?, status = ?, method = 'excel' WHERE id = ?`, [rec.time, status, exists[0].id]);
          updated++;
        } else {
          await runQuery(`INSERT INTO ${table} (${foreignKey}, date, time_in, status, method) VALUES (?, ?, ?, ?, 'excel')`, [rec.personId, rec.date, rec.time, status]);
          inserted++;
        }
        if (status === 'present') presentCount++; else lateCount++;
      }

      if (markAbsents) {
        const activePeople = await getQuery(`SELECT id FROM ${sourceTable} WHERE status = 'active'`);
        const uniqueDates = [...new Set(records.map(r => r.date))];

        for (const date of uniqueDates) {
          for (const p of activePeople) {
            const exists = await getQuery(`SELECT id FROM ${table} WHERE ${foreignKey} = ? AND date = ?`, [p.id, date]);
            if (!exists || exists.length === 0) {
              await runQuery(`INSERT INTO ${table} (${foreignKey}, date, status, method) VALUES (?, ?, 'absent', 'excel-auto')`, [p.id, date]);
              absentCount++;
            }
          }
        }
      }

      setImportResult({
        total: records.length, inserted, updated,
        presentCount, lateCount, absentCount,
        matchedById, matchedByName,
        totalErrors: errors.length,
        errors: errors.slice(0, 20)
      });
      showMessage(`✅ تم: ${inserted} جديد، ${updated} محدّث، ${errors.length} خطأ`);
    } catch (err) {
      console.error(err);
      showMessage(`❌ فشل الاستيراد: ${err.message}`, 'error');
    } finally { setImporting(false); }
  };

  const resetExcelImport = () => {
    setExcelFile(null);
    setExcelPreview(null);
    setExcelColumns({ id: '', name: '', date: '', time: '' });
    setImportResult(null);
    showMessage('🔄 تم إعادة التعيين');
  };

  // =========================================================
  // 🧠 الذكاء الاصطناعي
  // =========================================================
  const saveAiConfig = async () => {
    if (!aiConfig.enabled) {
      const updatedConfig = { api_key: '', enabled: false, model: 'openai/gpt-oss-20b' };
      localStorage.setItem('ai_config', JSON.stringify(updatedConfig));
      setAiConfig(updatedConfig);
      showMessage('⚠️ تم إيقاف المستشار الذكي');
      return;
    }

    if (!aiConfig.api_key || !aiConfig.api_key.trim()) {
      showMessage('❌ يرجى كتابة مفتاح API أولاً', 'error'); return;
    }

    const updatedConfig = { api_key: '', enabled: true, model: 'openai/gpt-oss-20b' };

    if (window.electronAPI && typeof window.electronAPI.setSecret === 'function') {
      try {
        await window.electronAPI.setSecret('GROQ_API_KEY', aiConfig.api_key.trim());
      } catch (err) {
        showMessage('❌ فشل حفظ المفتاح بشكل آمن', 'error');
        return;
      }
    } else {
      localStorage.setItem('GROQ_API_KEY', aiConfig.api_key.trim());
    }

    localStorage.setItem('ai_config', JSON.stringify(updatedConfig));
    setAiConfig(updatedConfig);

    showMessage('⏳ جاري التحقق...', 'info');
    const isReady = await loadMobileModel();
    showMessage(isReady ? '🧠 تم حفظ الإعدادات بنجاح!' : '⚠️ فشل الاتصال.', isReady ? 'success' : 'error');
  };

  // =========================================================
  // 📅 التقويم
  // =========================================================
  const loadCalendar = async () => {
    const data = await getQuery("SELECT * FROM calendar ORDER BY date_from");
    setCalendarEvents(data || []);
  };

  const addEvent = async () => {
    if (!eventForm.event || !eventForm.date_from || !eventForm.date_to) { showMessage('❌ يرجى إكمال البيانات', 'error'); return; }
    await runQuery("INSERT INTO calendar (event, date_from, date_to, type) VALUES (?, ?, ?, ?)", [eventForm.event, eventForm.date_from, eventForm.date_to, eventForm.type]);
    setEventForm({ event: '', date_from: '', date_to: '', type: 'event' });
    await loadCalendar();
    showMessage('📅 تمت الإضافة');
  };

  const deleteEvent = async (id) => {
    await runQuery("DELETE FROM calendar WHERE id = ?", [id]);
    await loadCalendar();
    showMessage('🗑️ تم الحذف');
  };

  // =========================================================
  // 📚 الجداول
  // =========================================================
  const loadSchedules = async () => {
    const data = await getQuery("SELECT * FROM schedules ORDER BY day, time_from");
    setSchedules(data || []);
  };

  const addSchedule = async () => {
    if (!scheduleForm.day || !scheduleForm.subject || !scheduleForm.time_from || !scheduleForm.time_to) { showMessage('❌ يرجى إكمال الحقول', 'error'); return; }
    await runQuery("INSERT INTO schedules (day, subject, teacher, time_from, time_to, room, break_time, late_tolerance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [scheduleForm.day, scheduleForm.subject, scheduleForm.teacher, scheduleForm.time_from, scheduleForm.time_to, scheduleForm.room, scheduleForm.break_time, scheduleForm.late_tolerance]);
    setScheduleForm({ day: '', subject: '', teacher: '', time_from: '', time_to: '', room: '', break_time: 0, late_tolerance: 10 });
    await loadSchedules();
    showMessage('📚 تمت الإضافة');
  };

  const deleteSchedule = async (id) => {
    await runQuery("DELETE FROM schedules WHERE id = ?", [id]);
    await loadSchedules();
    showMessage('🗑️ تم الحذف');
  };

  // =========================================================
  // 👥 الصلاحيات
  // =========================================================
  const loadUsers = () => {
    try { setUsers(getAllUsers() || []); }
    catch (err) { setUsers([]); }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) { showMessage('❌ يرجى إدخال كلمة المرور', 'error'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { showMessage('❌ غير متطابقتين', 'error'); return; }
    const result = await changePassword(currentUser.username, passwordForm.oldPassword, passwordForm.newPassword);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleDeleteUser = async (userId) => {
    const result = await deleteUser(userId);
    showMessage(result.message, result.success ? 'success' : 'error');
    if (result.success) loadUsers();
  };

  // =========================================================
  // 💾 النسخ الاحتياطي
  // =========================================================
  const handleBackup = async () => {
    try { await exportDatabase(); showMessage('📥 تم التصدير بنجاح'); }
    catch (e) { showMessage(`❌ فشل التصدير: ${e.message}`, 'error'); }
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        showMessage('⏳ جاري الاستعادة...', 'info');
        await importDatabase(file);
        showMessage('✅ تمت الاستعادة! جاري التحديث...');
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) { showMessage(`❌ فشل: ${err.message}`, 'error'); }
      e.target.value = '';
    }
  };

  // =========================================================
  // 🎨 الواجهات
  // =========================================================
  const renderAI = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>🧠 المستشار الأكاديمي الذكي</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>مفتاح الارتكاز السحابي لـ Groq</p>
      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.2))', border: '1px solid var(--glass-border)', padding: '25px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ color: 'var(--gold-light)', fontWeight: 700 }}>🔑 مفتاح API</label>
          <input type="password" value={aiConfig.api_key || ''} onChange={e => setAiConfig({ ...aiConfig, api_key: e.target.value })} placeholder="gsk_xxx" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: '10px', color: '#fff', outline: 'none', fontFamily: 'monospace', width: '100%', marginTop: '6px', direction: 'ltr', textAlign: 'left' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block', marginTop: '6px' }}>🔒 يُخزّن المفتاح بشكل مشفّر في النظام الآمن (Safe Storage)</span>
        </div>
        <label style={{ color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
          <input type="checkbox" checked={aiConfig.enabled || false} onChange={e => setAiConfig({ ...aiConfig, enabled: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: 'var(--gold-main)' }} />
          تفعيل المستشار الذكي
        </label>
        <div style={{ background: 'rgba(6,43,30,0.4)', border: '1px solid var(--gold-main)', padding: '14px', borderRadius: '10px', color: 'var(--gold-light)', fontSize: '0.85rem', fontWeight: 700, direction: 'ltr', textAlign: 'left' }}>
          🚀 النموذج النشط: <span style={{ fontFamily: 'monospace' }}>openai/gpt-oss-20b</span>
        </div>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={saveAiConfig} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', minWidth: '200px' }}>
          💾 حفظ الإعدادات
        </motion.button>
      </div>
    </div>
  );

  const renderDevices = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>🖐️ بوابات البصمة</h3>

      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '15px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '14px', marginBottom: '25px' }}>
        <input type="text" placeholder="اسم البوابة" value={deviceForm.name || ''} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} className="glass-input" />
        <input type="text" placeholder="IP" value={deviceForm.ip_address || ''} onChange={e => setDeviceForm({ ...deviceForm, ip_address: e.target.value })} className="glass-input" style={{ textAlign: 'left' }} />
        <input type="number" placeholder="منفذ" value={deviceForm.port || ''} onChange={e => setDeviceForm({ ...deviceForm, port: parseInt(e.target.value) || 4370 })} className="glass-input" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addDevice} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', padding: '0 20px' }}>
          ➕ تعميد
        </motion.button>
      </div>

      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '25px' }}>
        <table>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}>
              <th>البوابة</th><th>IP</th><th>منفذ</th><th>الحالة</th><th>آخر فحص</th><th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(d => (
              <tr key={d.id}>
                <td>🔹 {d.name}</td>
                <td>{d.ip_address}</td>
                <td>{d.port}</td>
                <td><span style={{ color: d.status === 'online' ? 'var(--green-bright)' : '#ef4444', fontWeight: 'bold' }}>{d.status === 'online' ? '🟢 متصل' : '🔴 غير متصل'}</span></td>
                <td>{d.last_sync ? new Date(d.last_sync).toLocaleString('ar-SA') : '—'}</td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <motion.button whileTap={{ scale: 0.95 }} disabled={isTestingId !== null} onClick={() => testConnection(d)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--gold-main)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                    {isTestingId === d.id ? '⏳' : '🔌 افحص'}
                  </motion.button>
                  <button onClick={() => deleteDevice(d.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}>🗑️</button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '35px' }}>📭 لا توجد أجهزة</td></tr>}
          </tbody>
        </table>
      </div>

      {/* 📊 استيراد Excel */}
      <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(0,0,0,0.3))', border: '2px solid var(--green-bright)', borderRadius: '16px', padding: '25px', marginBottom: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h4 style={{ fontFamily: 'Amiri, serif', fontSize: '1.4rem', color: 'var(--green-bright)', margin: '0 0 8px 0' }}>📊 استيراد سجلات الحضور من Excel</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.7 }}>
              ارفع ملف Excel من جهاز ZKTeco. النظام سيقوم بـ:
              <br/>✅ مطابقة ذكية: <strong style={{ color: '#38bdf8' }}>بالرقم أولاً، ثم بالاسم</strong>.
              <br/>✅ تسجيل الحضور/التأخير تلقائياً.
              <br/>✅ (اختياري) تسجيل الغائبين تلقائياً.
            </p>
          </div>
          {(excelFile || importResult) && (
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={resetExcelImport}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              🔄 إعادة تعيين
            </motion.button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <label style={{ cursor: 'pointer', padding: '12px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--green-bright), #10b981)', color: '#041d14', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            📁 اختر ملف Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelFileChange} style={{ display: 'none' }} />
          </label>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={downloadExcelTemplate}
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gold-main)', color: 'var(--gold-light)', padding: '12px 24px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            📥 تحميل قالب
          </motion.button>
          {excelFile && (
            <span style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--green-bright)', borderRadius: '10px', color: 'var(--green-bright)', fontSize: '0.85rem', fontWeight: 700 }}>
              ✅ {excelFile.name}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={{ color: 'var(--gold-light)', fontSize: '0.85rem', display: 'block', marginBottom: '6px', fontWeight: 700 }}>🎯 نوع الاستيراد</label>
            <select value={excelTarget} onChange={e => setExcelTarget(e.target.value)} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', width: '100%' }}>
              <option value="student">🎓 سجلات الطلاب</option>
              <option value="teacher">👨‍🏫 سجلات المدرسين</option>
            </select>
          </div>
          <div>
            <label style={{ color: 'var(--gold-light)', fontSize: '0.85rem', display: 'block', marginBottom: '6px', fontWeight: 700 }}>⏰ حد التأخير</label>
            <input type="time" value={lateThreshold} onChange={e => setLateThreshold(e.target.value)} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', width: '100%' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>من تجاوز هذا الوقت → متأخر</span>
          </div>
          <div>
            <label style={{ color: 'var(--gold-light)', fontSize: '0.85rem', display: 'block', marginBottom: '6px', fontWeight: 700 }}>⚙️ خيارات إضافية</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', cursor: 'pointer', color: '#fff', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={markAbsents} onChange={e => setMarkAbsents(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#ef4444' }} />
              تسجيل الغائبين تلقائياً
            </label>
          </div>
        </div>

        {markAbsents && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px 16px', borderRadius: '10px', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '20px', fontWeight: 600 }}>
            ⚠️ <strong>تنبيه:</strong> سيتم تسجيل كل الطلاب/المدرسين النشطين غير الموجودين في الملف كغائبين في تواريخ الملف. تأكد من اكتمال البيانات.
          </div>
        )}

        {excelPreview && (
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ color: 'var(--green-bright)', margin: '0 0 12px 0', fontSize: '1rem' }}>
              📋 معاينة (أول {excelPreview.rows.length} من {excelPreview.totalRows} سجل)
            </h5>
            <div style={{ overflowX: 'auto', border: '1px solid var(--glass-border)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '400px' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}>
                    {excelPreview.headers.map((h, i) => (
                      <th key={i} style={{ padding: '10px', color: 'var(--gold-light)', textAlign: 'right', borderBottom: '1px solid rgba(214,175,55,0.2)' }}>
                        {h}
                        {excelColumns.id === h && ' 🆔'}
                        {excelColumns.name === h && ' 👤'}
                        {excelColumns.date === h && ' 📅'}
                        {excelColumns.time === h && ' ⏰'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelPreview.rows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      {excelPreview.headers.map((h, j) => (
                        <td key={j} style={{ padding: '8px 10px', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {excelPreview && (
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleExcelImport} disabled={importing}
            style={{ background: importing ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '14px 32px', borderRadius: '12px', fontWeight: 900, fontSize: '1rem', cursor: importing ? 'wait' : 'pointer', boxShadow: '0 8px 20px rgba(214,175,55,0.3)', width: '100%' }}>
            {importing ? '⏳ جاري الاستيراد...' : '🚀 بدء الاستيراد'}
          </motion.button>
        )}

        {importResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: '20px', background: 'rgba(16,185,129,0.08)', border: '1px solid var(--green-bright)', borderRadius: '12px', padding: '18px' }}>
            <h5 style={{ color: 'var(--green-bright)', margin: '0 0 12px 0', fontSize: '1rem' }}>✅ نتائج الاستيراد</h5>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', fontSize: '0.85rem', marginBottom: '15px' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>📊 إجمالي:</span> <strong style={{ color: '#fff' }}>{importResult.total}</strong></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>➕ جديد:</span> <strong style={{ color: 'var(--green-bright)' }}>{importResult.inserted}</strong></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>🔄 محدّث:</span> <strong style={{ color: '#38bdf8' }}>{importResult.updated}</strong></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>✅ حاضرون:</span> <strong style={{ color: 'var(--green-bright)' }}>{importResult.presentCount}</strong></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>🟡 متأخرون:</span> <strong style={{ color: 'var(--gold-main)' }}>{importResult.lateCount}</strong></div>
              {markAbsents && <div><span style={{ color: 'var(--text-secondary)' }}>❌ غائبون:</span> <strong style={{ color: '#ef4444' }}>{importResult.absentCount}</strong></div>}
            </div>

            <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', marginBottom: '12px', fontSize: '0.82rem' }}>
              <div style={{ color: 'var(--gold-light)', marginBottom: '6px', fontWeight: 700 }}>🎯 طرق المطابقة:</div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <span>🆔 <strong style={{ color: '#38bdf8' }}>بالرقم:</strong> {importResult.matchedById || 0}</span>
                <span>👤 <strong style={{ color: '#a78bfa' }}>بالاسم:</strong> {importResult.matchedByName || 0}</span>
              </div>
            </div>

            {importResult.totalErrors > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '14px', marginTop: '12px' }}>
                <div style={{ color: '#fca5a5', fontWeight: 800, marginBottom: '10px', fontSize: '0.9rem' }}>
                  ⚠️ {importResult.totalErrors} صف لم يُستورد
                  {importResult.totalErrors > 20 && ' (يُعرض أول 20)'}
                </div>
                <div style={{ maxHeight: '240px', overflowY: 'auto', fontSize: '0.8rem' }}>
                  {importResult.errors.map((err, i) => (
                    <div key={i} style={{
                      padding: '8px 10px', marginBottom: '6px', borderRadius: '6px',
                      background: 'rgba(0,0,0,0.25)', borderRight: '3px solid #ef4444',
                      display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '10px', alignItems: 'center'
                    }}>
                      <span style={{ color: '#fca5a5', fontWeight: 700 }}>📍 صف {err.row}</span>
                      <span style={{ color: '#e2e8f0', fontSize: '0.75rem' }}>ID: <strong>{err.id}</strong></span>
                      <span style={{ color: '#e2e8f0', fontSize: '0.75rem' }}>الاسم: <strong>{err.name}</strong></span>
                      <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>{err.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {devices.length > 0 && (
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '25px' }}>
          <h4 style={{ fontFamily: 'Amiri, serif', fontSize: '1.4rem', color: 'var(--gold-light)', margin: '0 0 10px 0' }}>🖐️ وحدة تسجيل الـ 5 بصمات الاحتياطية</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>حدد الهدف، ثم اسحب 5 بصمات من الجهاز.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ color: 'var(--gold-light)', fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>الفئة</label>
              <select value={enrollTarget} onChange={e => setEnrollTarget(e.target.value)} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', width: '100%' }}>
                <option value="student">🎓 الطلاب</option>
                <option value="teacher">👨‍🏫 المدرسون</option>
              </select>
            </div>
            <div>
              <label style={{ color: 'var(--gold-light)', fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>الاسم</label>
              <select value={selectedPersonId} onChange={handlePersonChange} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', width: '100%' }}>
                <option value="">-- اختر --</option>
                {peopleList.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: 'var(--gold-light)', fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>الجهاز</label>
              <select value={activeDeviceId} onChange={e => setActiveDeviceId(e.target.value)} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff', width: '100%' }}>
                {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.ip_address}:{d.port})</option>)}
              </select>
            </div>
          </div>

          {selectedPersonId && (
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[0, 1, 2, 3, 4].map(idx => {
                  const fingerNames = ["الإبهام الأيمن", "السبابة اليمنى", "الوسطى اليمنى", "الإبهام الأيسر", "السبابة اليسرى"];
                  const isRegistered = fingerTemplates[idx] !== null;
                  return (
                    <div key={idx} style={{ background: isRegistered ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)', border: isRegistered ? '1.5px solid var(--green-bright)' : '1px solid var(--glass-border)', borderRadius: '10px', padding: '15px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isRegistered ? 'var(--green-bright)' : '#aaa' }}>
                        {fingerNames[idx]} {isRegistered ? '✅' : '💤'}
                      </span>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={enrollingFinger !== null} onClick={() => enrollFingerprintDevice(idx)}
                        style={{ background: isRegistered ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(135deg, var(--gold-main), #b89324)', color: isRegistered ? '#fff' : '#062b1e', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}>
                        {enrollingFinger === idx ? '⚡ جاري...' : isRegistered ? 'تحديث' : '➕ التقاط'}
                      </motion.button>
                    </div>
                  );
                })}
              </div>
              {enrollStatusText && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px 15px', borderRadius: '8px', color: 'var(--gold-light)', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center' }}>
                  📢 {enrollStatusText}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCalendar = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>📅 التقويم الأكاديمي</h3>
      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr auto', gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '18px', borderRadius: '14px', marginBottom: '25px' }}>
        <input type="text" placeholder="الفعالية" value={eventForm.event || ''} onChange={e => setEventForm({ ...eventForm, event: e.target.value })} className="glass-input" />
        <input type="text" placeholder="من (2026-01-01)" value={eventForm.date_from || ''} onChange={e => setEventForm({ ...eventForm, date_from: e.target.value })} className="glass-input" />
        <input type="text" placeholder="إلى" value={eventForm.date_to || ''} onChange={e => setEventForm({ ...eventForm, date_to: e.target.value })} className="glass-input" />
        <select value={eventForm.type || 'event'} onChange={e => setEventForm({ ...eventForm, type: e.target.value })} style={{ background: '#041d14', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: '#fff' }}>
          <option value="event">📅 حدث</option><option value="holiday">🏖️ إجازة</option><option value="exam">📝 اختبار</option><option value="registration">📋 تسجيل</option><option value="results">📊 نتائج</option>
        </select>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addEvent} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', padding: '0 20px' }}>➕</motion.button>
      </div>
      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table>
          <thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>الفعالية</th><th>من</th><th>إلى</th><th>النوع</th><th>حذف</th></tr></thead>
          <tbody>
            {calendarEvents.map(e => (
              <tr key={e.id}><td>🎯 {e.event}</td><td>{e.date_from}</td><td>{e.date_to}</td><td>{e.type}</td>
              <td><button onClick={() => deleteEvent(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️</button></td></tr>
            ))}
            {calendarEvents.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '35px' }}>📭 لا توجد فعاليات</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSchedules = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)', margin: '0 0 5px 0' }}>📚 الجدول الدراسي</h3>
      <div className="form-row-lux" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.5fr 1fr 1fr 1fr auto', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-border)', padding: '18px', borderRadius: '14px', marginBottom: '25px' }}>
        <select value={scheduleForm.day || ''} onChange={e => setScheduleForm({ ...scheduleForm, day: e.target.value })} className="glass-input" style={{ background: '#041d14', color: '#fff' }}>
          <option value="">اليوم...</option>
          <option value="السبت">السبت</option><option value="الأحد">الأحد</option><option value="الاثنين">الاثنين</option>
          <option value="الثلاثاء">الثلاثاء</option><option value="الأربعاء">الأربعاء</option><option value="الخميس">الخميس</option>
        </select>
        <input type="text" placeholder="المادة" value={scheduleForm.subject || ''} onChange={e => setScheduleForm({ ...scheduleForm, subject: e.target.value })} className="glass-input" />
        <input type="text" placeholder="المحاضر" value={scheduleForm.teacher || ''} onChange={e => setScheduleForm({ ...scheduleForm, teacher: e.target.value })} className="glass-input" />
        <input type="time" value={scheduleForm.time_from || ''} onChange={e => setScheduleForm({ ...scheduleForm, time_from: e.target.value })} className="glass-input" />
        <input type="time" value={scheduleForm.time_to || ''} onChange={e => setScheduleForm({ ...scheduleForm, time_to: e.target.value })} className="glass-input" />
        <input type="text" placeholder="القاعة" value={scheduleForm.room || ''} onChange={e => setScheduleForm({ ...scheduleForm, room: e.target.value })} className="glass-input" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addSchedule} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', padding: '0 18px' }}>➕</motion.button>
      </div>
      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table>
          <thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>اليوم</th><th>المادة</th><th>المدرس</th><th>من</th><th>إلى</th><th>القاعة</th><th>إجراء</th></tr></thead>
          <tbody>
            {schedules.map(s => (
              <tr key={s.id}><td>{s.day}</td><td style={{ color: '#fff', fontWeight: 600 }}>{s.subject}</td><td>{s.teacher}</td>
              <td>{s.time_from}</td><td>{s.time_to}</td><td>{s.room}</td>
              <td><button onClick={() => deleteSchedule(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑️</button></td></tr>
            ))}
            {schedules.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '35px' }}>📭 لا توجد محاضرات</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="settings-section">
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>👥 صلاحيات الكادر</h3>

      <div className="data-table" style={{ border: '1px solid var(--glass-border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '35px', marginTop: '20px' }}>
        <table>
          <thead><tr style={{ background: 'linear-gradient(135deg, #041d14, #083d2b)' }}><th>المستخدم</th><th>الدور</th><th>تاريخ الإنشاء</th><th>سحب الصلاحية</th></tr></thead>
          <tbody>
            {Array.isArray(users) && users.map(u => (
              <tr key={u.id}>
                <td>👤 {u.username}</td><td>{u.role}</td><td>{u.created_at || 'غير محدد'}</td>
                <td>
                  {u.username !== 'admin' && isAdmin() && u.username !== currentUser.username ? (
                    <button onClick={() => handleDeleteUser(u.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🛑</button>
                  ) : <span>🔒 محمي</span>}
                </td>
              </tr>
            ))}
            {(!users || users.length === 0) && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>📭 لا يوجد مستخدمون</td></tr>}
          </tbody>
        </table>
      </div>

      <h4 style={{ fontFamily: 'Amiri, serif', color: 'var(--gold-light)' }}>🔒 تغيير كلمة المرور</h4>
      <div className="form-card-lux" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.01), rgba(0,0,0,0.15))', border: '1px solid var(--glass-border)', padding: '20px', borderRadius: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px' }}>
        <input type="password" placeholder="القديمة" value={passwordForm.oldPassword || ''} onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })} className="glass-input" />
        <input type="password" placeholder="الجديدة" value={passwordForm.newPassword || ''} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="glass-input" />
        <input type="password" placeholder="تأكيد" value={passwordForm.confirmPassword || ''} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="glass-input" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleChangePassword} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gold-main)', color: 'var(--gold-main)', padding: '12px 25px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}>🔐 تعديل</motion.button>
      </div>
    </div>
  );

  const renderBackup = () => (
    <div className="settings-section" style={{ textAlign: 'center', padding: '20px 0' }}>
      <h3 style={{ fontFamily: 'Amiri, serif', fontSize: '1.6rem', color: 'var(--gold-light)' }}>💾 النسخ الاحتياطي</h3>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '35px' }}>
        <motion.button whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={handleBackup} style={{ background: 'linear-gradient(135deg, var(--gold-main), #b89324)', color: '#062b1e', border: 'none', padding: '18px 35px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>📥 تصدير .db</motion.button>
        <motion.label whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: '#fff', padding: '18px 35px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>
          📤 استيراد
          <input type="file" accept=".db" onChange={handleRestore} style={{ display: 'none' }} />
        </motion.label>
      </div>
    </div>
  );

  return (
    <div className="settings-module">
      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: -25 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: 'linear-gradient(135deg, #041d14, #0a3d2c)', border: `1px solid ${messageType === 'error' ? '#ef4444' : messageType === 'info' ? 'var(--gold-main)' : 'var(--green-bright)'}`, padding: '14px 24px', borderRadius: '12px', marginBottom: '25px', color: '#fff', fontWeight: 600 }}>
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="tabs" style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '16px', border: '1px solid var(--glass-border)', marginBottom: '30px', overflowX: 'auto' }}>
        {[
          { id: 'devices', label: '🖐️ البصمة والتحضير' },
          { id: 'schedules', label: '📚 الجدول' },
          { id: 'ai', label: '🧠 المستشار الذكي' },
          { id: 'calendar', label: '📅 التقويم' },
          { id: 'users', label: '👥 الصلاحيات' },
          { id: 'backup', label: '💾 النسخ' }
        ].map(t => (
          <motion.button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}
            whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}
            style={{ flex: 1, padding: '12px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap', background: tab === t.id ? 'linear-gradient(135deg, var(--gold-main), #b89324)' : 'transparent', color: tab === t.id ? '#062b1e' : 'var(--text-secondary)' }}>
            {t.label}
          </motion.button>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {tab === 'devices' && renderDevices()}
        {tab === 'schedules' && renderSchedules()}
        {tab === 'ai' && renderAI()}
        {tab === 'calendar' && renderCalendar()}
        {tab === 'users' && renderUsers()}
        {tab === 'backup' && renderBackup()}
      </motion.div>
    </div>
  );
}

export default Settings;
