import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import { env } from '../config/env.js';
import { query } from '../db/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { addEmailJobToQueue, getEmailQueue } from '../queue/emailQueue.js';
import { indexEmailDocument, searchEmails } from '../services/elasticsearch.js';

export const emailRouter = Router();

// Configure multer for file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// 1. Parse CSV or TXT file to extract recipient emails
emailRouter.post('/parse-recipients', authMiddleware, upload.single('file'), async (req: Request, res: Response): Promise<any> => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const fileContent = req.file.buffer.toString('utf-8');
  const filename = req.file.originalname.toLowerCase();
  const extractedEmails = new Set<string>();

  if (filename.endsWith('.csv')) {
    try {
      const records = parse(fileContent, {
        skip_empty_lines: true,
        trim: true,
      });

      for (const row of records) {
        if (Array.isArray(row)) {
          for (const cell of row) {
            const matches = cell.match(EMAIL_REGEX);
            if (matches) {
              matches.forEach((e: string) => extractedEmails.add(e.toLowerCase()));
            }
          }
        }
      }
    } catch (parseErr) {
      // Fallback regex scan if CSV parsing fails
      const matches = fileContent.match(EMAIL_REGEX) || [];
      matches.forEach((e) => extractedEmails.add(e.toLowerCase()));
    }
  } else {
    // Plain text file (.txt)
    const matches = fileContent.match(EMAIL_REGEX) || [];
    matches.forEach((e) => extractedEmails.add(e.toLowerCase()));
  }

  const recipients = Array.from(extractedEmails);
  return res.json({
    count: recipients.length,
    recipients,
  });
});

// 2. Schedule Email Batch
emailRouter.post('/schedule', authMiddleware, async (req: Request, res: Response): Promise<any> => {
  const {
    recipients,
    subject,
    body,
    senderId,
    startTime,
    delaySeconds,
    hourlyLimit,
    idempotencyKey,
  } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'At least one valid recipient is required.' });
  }
  if (!subject || !body) {
    return res.status(400).json({ error: 'Subject and body are required.' });
  }
  if (!senderId) {
    return res.status(400).json({ error: 'Sender ID is required.' });
  }

  const userId = req.user!.id;
  const enforcedMinDelaySec = Math.max(1, Math.floor(env.MIN_DELAY_BETWEEN_EMAILS_MS / 1000));
  const configuredDelaySec = delaySeconds !== undefined ? Math.max(enforcedMinDelaySec, parseInt(delaySeconds, 10)) : enforcedMinDelaySec;
  const configuredHourlyLimit = hourlyLimit !== undefined ? parseInt(hourlyLimit, 10) : 50;

  const baseScheduledTime = startTime ? new Date(startTime).getTime() : Date.now();
  const validBaseTime = isNaN(baseScheduledTime) || baseScheduledTime < Date.now() ? Date.now() : baseScheduledTime;

  const scheduledJobs: any[] = [];
  const skippedDuplicates: string[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i].trim().toLowerCase();
    if (!recipient.match(EMAIL_REGEX)) continue;

    const emailId = crypto.randomUUID();
    const targetScheduledTime = new Date(validBaseTime + i * configuredDelaySec * 1000);
    const delayMs = Math.max(0, targetScheduledTime.getTime() - Date.now());

    // Generate unique idempotency key for duplicate prevention
    const itemKey = idempotencyKey
      ? `${idempotencyKey}_${recipient}`
      : `idem_${userId}_${recipient}_${crypto.createHash('md5').update(subject + body).digest('hex').substring(0, 12)}_${targetScheduledTime.getTime()}`;

    try {
      const insertResult = await query(
        `INSERT INTO emails (
          id, user_id, sender_id, recipient, subject, body, 
          status, scheduled_at, delay_seconds, hourly_limit, 
          bullmq_job_id, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9, $10, $11)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *`,
        [
          emailId,
          userId,
          senderId,
          recipient,
          subject,
          body,
          targetScheduledTime.toISOString(),
          configuredDelaySec,
          configuredHourlyLimit,
          `email_${emailId}`,
          itemKey,
        ]
      );

      if (insertResult.rows.length === 0) {
        skippedDuplicates.push(recipient);
        continue;
      }

      const createdEmail = insertResult.rows[0];

      // Add delayed job to BullMQ queue
      await addEmailJobToQueue(
        {
          emailId,
          userId,
          senderId,
          recipient,
          subject,
          body,
          hourlyLimit: configuredHourlyLimit,
          scheduledAt: targetScheduledTime.toISOString(),
        },
        delayMs
      );

      // Index to Elasticsearch
      await indexEmailDocument({
        id: emailId,
        user_id: userId,
        sender_id: senderId,
        recipient,
        subject,
        body,
        status: 'scheduled',
        scheduled_at: targetScheduledTime,
      });

      scheduledJobs.push(createdEmail);
    } catch (err: any) {
      console.error(`[Schedule] Error enqueuing email to ${recipient}:`, err.message);
    }
  }

  return res.json({
    success: true,
    scheduledCount: scheduledJobs.length,
    skippedCount: skippedDuplicates.length,
    firstScheduledAt: new Date(validBaseTime).toISOString(),
    delaySeconds: configuredDelaySec,
    hourlyLimit: configuredHourlyLimit,
    jobs: scheduledJobs,
  });
});

// 3. Get Scheduled Emails
emailRouter.get('/scheduled', authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT e.*, s.name as sender_name, s.email as sender_email
       FROM emails e
       LEFT JOIN senders s ON e.sender_id = s.id
       WHERE e.user_id = $1 
         AND e.status IN ('scheduled', 'rate_limited', 'sending')
       ORDER BY e.scheduled_at ASC`,
      [userId]
    );

    return res.json({ emails: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Get Sent Emails
emailRouter.get('/sent', authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT e.*, s.name as sender_name, s.email as sender_email
       FROM emails e
       LEFT JOIN senders s ON e.sender_id = s.id
       WHERE e.user_id = $1 
         AND e.status IN ('sent', 'failed')
       ORDER BY e.sent_at DESC NULLS LAST, e.created_at DESC`,
      [userId]
    );

    return res.json({ emails: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Search Emails (Elasticsearch with DB fallback)
emailRouter.get('/search', authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const q = req.query.q as string;
    if (!q || !q.trim()) {
      return res.json({ results: [] });
    }

    const userId = req.user!.id;
    const results = await searchEmails(userId, q);
    return res.json({ results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Cancel a scheduled email
emailRouter.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const emailId = req.params.id;
    const userId = req.user!.id;

    // Check ownership
    const emailRes = await query('SELECT bullmq_job_id FROM emails WHERE id = $1 AND user_id = $2', [emailId, userId]);
    if (emailRes.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found or access denied.' });
    }

    const bullmqJobId = emailRes.rows[0].bullmq_job_id;
    if (bullmqJobId) {
      const queue = getEmailQueue();
      const job = await queue.getJob(bullmqJobId);
      if (job) {
        await job.remove();
      }
    }

    await query('DELETE FROM emails WHERE id = $1', [emailId]);
    return res.json({ success: true, message: 'Email cancelled and removed.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
