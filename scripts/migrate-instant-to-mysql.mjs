#!/usr/bin/env node
/**
 * Import InstantDB export JSON into MySQL.
 *
 * Export format (example):
 * {
 *   "users": [{ "id": "...", "email": "you@example.com", "password": "choose-on-import" }],
 *   "medications": [{ "id", "userId", "name", "times": [], "stockCount": null }],
 *   "logEntries": [{ "id", "userId", "medicationId", "medicationName", "dateKey", "time", "status", "updatedAt" }]
 * }
 *
 * Usage:
 *   DATABASE_URL=mysql://medtracker:pass@127.0.0.1:3306/medtracker node scripts/migrate-instant-to-mysql.mjs export.json
 */
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/migrate-instant-to-mysql.mjs export.json');
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, 'utf8'));
const pool = mysql.createPool(process.env.DATABASE_URL);

const users = data.users ?? [];
const medications = data.medications ?? [];
const logEntries = data.logEntries ?? data.log_entries ?? [];

for (const u of users) {
  const email = (u.email ?? '').trim().toLowerCase();
  if (!email) continue;
  const password = u.password ?? 'ChangeMe123!';
  const id = u.id ?? randomUUID();
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email)`,
    [id, email, hash],
  );
  console.log('user', email, id);
}

for (const m of medications) {
  const userId = m.userId ?? m.user_id;
  if (!userId || !m.id) continue;
  await pool.query(
    `INSERT INTO medications (id, user_id, name, times, stock_count) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), times = VALUES(times), stock_count = VALUES(stock_count)`,
    [
      m.id,
      userId,
      m.name,
      JSON.stringify(m.times ?? []),
      m.stockCount ?? m.stock_count ?? null,
    ],
  );
}
console.log('medications', medications.length);

for (const l of logEntries) {
  const userId = l.userId ?? l.user_id;
  if (!userId || !l.id) continue;
  await pool.query(
    `INSERT INTO log_entries
       (id, user_id, medication_id, medication_name, date_key, time, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = VALUES(updated_at)`,
    [
      l.id,
      userId,
      l.medicationId ?? l.medication_id,
      l.medicationName ?? l.medication_name,
      l.dateKey ?? l.date_key,
      l.time,
      l.status,
      l.updatedAt ?? l.updated_at,
    ],
  );
}
console.log('logEntries', logEntries.length);

await pool.end();
console.log('Done. Users must change password after import if default was used.');
