import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData, getEmailQueue } from './emailQueue.js';
import { createRedisConnection } from '../services/redis.js';
import { env } from '../config/env.js';
import { query } from '../db/db.js';
import { checkAndConsumeRateLimit } from '../services/rateLimiter.js';
import { sendEmailViaSender } from '../services/ethereal.js';
import { sendSlackRateLimitAlert } from '../services/slack.js';
import { indexEmailDocument } from '../services/elasticsearch.js';

let emailWorker: Worker | null = null;

export function startEmailWorker(): Worker {
  if (emailWorker) return emailWorker;

  const connection = createRedisConnection();

  console.log(`[Worker] Starting BullMQ Email Worker with concurrency = ${env.WORKER_CONCURRENCY}...`);

  emailWorker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId, userId, senderId, recipient, subject, body, hourlyLimit } = job.data;
      console.log(`[Worker] Processing Job ${job.id} for email ${emailId} -> ${recipient}`);

      // 1. Idempotency Check: Check if already sent in DB
      const existingRes = await query('SELECT status, ethereal_preview_url FROM emails WHERE id = $1', [emailId]);
      if (existingRes.rows.length === 0) {
        console.warn(`[Worker] Email ${emailId} not found in database. Skipping job.`);
        return { skipped: true, reason: 'Email not found in DB' };
      }

      const emailRecord = existingRes.rows[0];
      if (emailRecord.status === 'sent') {
        console.log(`[Worker] Email ${emailId} is already marked as 'sent'. Skipping duplicate execution.`);
        return { skipped: true, reason: 'Already sent' };
      }

      // 2. Atomic Rate Limit Check via Redis Lua
      const limit = hourlyLimit || 50;
      const rateCheck = await checkAndConsumeRateLimit(senderId, limit);

      if (!rateCheck.allowed) {
        console.warn(
          `[Worker] ⚠️ Rate limit exceeded for Sender ID ${senderId} (${rateCheck.currentCount}/${limit}). Rescheduling email ${emailId}.`
        );

        const rescheduledUntil = new Date(Date.now() + rateCheck.rescheduleDelayMs);

        // Update database status
        await query(
          `UPDATE emails 
           SET status = 'rate_limited', 
               scheduled_at = $1, 
               error_message = $2, 
               updated_at = NOW() 
           WHERE id = $3`,
          [
            rescheduledUntil.toISOString(),
            `Hourly rate limit of ${limit} reached. Rescheduled to ${rescheduledUntil.toLocaleTimeString()}`,
            emailId,
          ]
        );

        // Send Slack notification if needed
        if (rateCheck.shouldNotifySlack) {
          const senderRes = await query('SELECT name, email FROM senders WHERE id = $1', [senderId]);
          const sender = senderRes.rows[0];
          await sendSlackRateLimitAlert({
            userId,
            senderId,
            senderName: sender?.name || 'Sender',
            senderEmail: sender?.email || 'unknown',
            hourlyLimit: limit,
            attemptedCount: rateCheck.currentCount,
            rescheduledUntil,
          });
        }

        // Reschedule job in BullMQ queue
        const queue = getEmailQueue();
        await queue.add('send-email', job.data, {
          delay: rateCheck.rescheduleDelayMs,
          jobId: `email_${emailId}_resched_${Date.now()}`,
        });

        return {
          status: 'rate_limited',
          rescheduledUntil,
          delayMs: rateCheck.rescheduleDelayMs,
        };
      }

      // 3. Mark DB as 'sending'
      await query("UPDATE emails SET status = 'sending', updated_at = NOW() WHERE id = $1", [emailId]);

      // 4. Send Email via Nodemailer & Ethereal SMTP
      try {
        const sendResult = await sendEmailViaSender({
          senderId,
          recipient,
          subject,
          body,
        });

        console.log(`[Worker] ✅ Email ${emailId} sent successfully to ${recipient}! Message ID: ${sendResult.messageId}`);
        if (sendResult.previewUrl) {
          console.log(`[Worker] 🔗 Ethereal Preview URL: ${sendResult.previewUrl}`);
        }

        // 5. Update DB to 'sent'
        await query(
          `UPDATE emails 
           SET status = 'sent', 
               sent_at = NOW(), 
               ethereal_preview_url = $1, 
               error_message = NULL,
               updated_at = NOW() 
           WHERE id = $2`,
          [sendResult.previewUrl || null, emailId]
        );

        // 6. Index to Elasticsearch
        await indexEmailDocument({
          id: emailId,
          user_id: userId,
          sender_id: senderId,
          recipient,
          subject,
          body,
          status: 'sent',
          scheduled_at: job.data.scheduledAt,
          sent_at: new Date(),
          ethereal_preview_url: sendResult.previewUrl || null,
        });

        return {
          status: 'sent',
          messageId: sendResult.messageId,
          previewUrl: sendResult.previewUrl,
        };
      } catch (sendError: any) {
        console.error(`[Worker] ❌ Failed to send email ${emailId}:`, sendError.message);

        await query(
          "UPDATE emails SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2",
          [sendError.message, emailId]
        );

        throw sendError;
      }
    },
    {
      connection,
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  emailWorker.on('completed', (job: Job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  emailWorker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  emailWorker.on('error', (err: Error) => {
    console.error(`[Worker] Worker error:`, err.message);
  });

  return emailWorker;
}
