import { query } from '../db/db.js';
import { getEmailQueue, addEmailJobToQueue } from './emailQueue.js';

export async function reconcileScheduledJobs(): Promise<number> {
  console.log('[Reconciliation] Checking database for un-dispatched or interrupted scheduled emails...');
  const queue = getEmailQueue();

  const pendingRes = await query(
    `SELECT id, user_id, sender_id, recipient, subject, body, hourly_limit, scheduled_at, status
     FROM emails
     WHERE status IN ('scheduled', 'rate_limited')
     ORDER BY scheduled_at ASC`
  );

  let reconciledCount = 0;

  for (const email of pendingRes.rows) {
    const jobId = `email_${email.id}`;
    const existingJob = await queue.getJob(jobId);

    if (!existingJob) {
      const scheduledTime = new Date(email.scheduled_at).getTime();
      const delayMs = Math.max(0, scheduledTime - Date.now());

      await addEmailJobToQueue(
        {
          emailId: email.id,
          userId: email.user_id,
          senderId: email.sender_id,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          hourlyLimit: email.hourly_limit || 50,
          scheduledAt: email.scheduled_at,
        },
        delayMs
      );

      console.log(`[Reconciliation] Restored missing job ${jobId} (status: ${email.status}) with ${Math.round(delayMs / 1000)}s delay.`);
      reconciledCount++;
    }
  }

  console.log(`[Reconciliation] Reconciliation complete. Restored ${reconciledCount} jobs from database.`);
  return reconciledCount;
}
