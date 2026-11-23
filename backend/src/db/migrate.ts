import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { query, initDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrate() {
  await initDb();

  console.log('[DB] Running migrations...');
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Split by statements and execute
  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await query(statement);
    } catch (err: any) {
      console.error(`[DB] Error executing statement: ${statement.substring(0, 40)}...`, err.message);
    }
  }

  console.log('[DB] Database tables created or verified.');

  // Seed default demo user if none exists
  try {
    const userRes = await query('SELECT id FROM users LIMIT 1');
    if (userRes.rows.length === 0) {
      console.log('[DB] Seeding initial demo user...');
      await query(
        `INSERT INTO users (email, name, avatar_url, google_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [
          'demo.user@reachinbox.ai',
          'Demo Recruiter',
          'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInboxDemo',
          'demo-google-id-001',
        ]
      );
    }
  } catch (err: any) {
    console.warn('[DB] User seed warning:', err.message);
  }

  // Seed initial Ethereal SMTP senders if none exist
  try {
    const senderRes = await query('SELECT id FROM senders LIMIT 1');
    if (senderRes.rows.length === 0) {
      console.log('[DB] Generating real Ethereal SMTP sender accounts via Nodemailer...');
      
      const account1 = await nodemailer.createTestAccount();
      await query(
        `INSERT INTO senders (name, email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'ReachInbox Sales Team',
          account1.user,
          account1.smtp.host,
          account1.smtp.port,
          account1.user,
          account1.pass,
          account1.smtp.secure,
        ]
      );
      console.log(`[DB] Created Ethereal Sender 1: ${account1.user}`);

      const account2 = await nodemailer.createTestAccount();
      await query(
        `INSERT INTO senders (name, email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'ReachInbox Talent Acquisition',
          account2.user,
          account2.smtp.host,
          account2.smtp.port,
          account2.user,
          account2.pass,
          account2.smtp.secure,
        ]
      );
      console.log(`[DB] Created Ethereal Sender 2: ${account2.user}`);
    }
  } catch (err: any) {
    console.warn('[DB] Ethereal sender seed warning:', err.message);
  }

  console.log('[DB] Migrations and seeding completed successfully.');
}
