// src/services/fingerprint.js – ربط أجهزة بصمة ZKTeco (SQLite محلية حقيقية)
import { getQuery, runQuery } from './db';

export async function connectDevice(device) {
  try {
    const response = await fetch(`http://${device.ip_address}:${device.port}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect' })
    });

    if (response.ok) {
      await runQuery(
        "UPDATE devices SET status = 'online', last_sync = ? WHERE id = ?",
        [new Date().toISOString(), device.id]
      );
      return { success: true, message: 'تم الاتصال' };
    }

    return { success: false, message: 'فشل الاتصال' };
  } catch (error) {
    await runQuery(
      "UPDATE devices SET status = 'offline' WHERE id = ?",
      [device.id]
    );
    return { success: false, message: error.message };
  }
}

export async function getAttendanceFromDevice(device) {
  try {
    const response = await fetch(`http://${device.ip_address}:${device.port}/api/attendance`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data: data.logs || [] };
    }

    return { success: false, data: [] };
  } catch (error) {
    return { success: false, data: [], error: error.message };
  }
}

export async function syncAllDevices() {
  const devices = await getQuery("SELECT * FROM devices WHERE status = 'online'");
  let totalSynced = 0;

  for (const device of devices) {
    const result = await getAttendanceFromDevice(device);
    if (result.success) {
      for (const log of result.data) {
        const student = await getQuery(
          "SELECT id FROM students WHERE fingerprint_data = ?",
          [log.fingerprint_id]
        );

        if (student && student.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const exists = await getQuery(
            "SELECT id FROM attendance WHERE student_id = ? AND date = ?",
            [student[0].id, today]
          );

          if (!exists || exists.length === 0) {
            await runQuery(
              "INSERT INTO attendance (student_id, date, time_in, status, method) VALUES (?, ?, ?, 'present', 'fingerprint')",
              [student[0].id, today, log.time]
            );
            totalSynced++;
          }
        }
      }
    }
  }

  return { success: true, synced: totalSynced };
}

export async function registerFingerprint(studentId, fingerprintData) {
  await runQuery(
    "UPDATE students SET fingerprint_data = ? WHERE id = ?",
    [fingerprintData, studentId]
  );
  return { success: true, message: 'تم تسجيل البصمة' };
}
