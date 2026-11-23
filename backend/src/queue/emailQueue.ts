import { Queue } from 'bullmq';
import { createRedisConnection } from '../services/redis.js';

export const EMAIL_QUEUE_NAME = 'email-dispatch-queue';

let emailQueue: Queue;

export function getEmailQueue(): Queue {
  if (!emailQueue) {
    const connection = createRedisConnection();
    emailQueue = new Queue(EMAIL_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 5000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    emailQueue.on('error', (err) => {
      console.error('[Queue] BullMQ Queue Error:', err.message);
    });
  }

  return emailQueue;
}

export interface EmailJobData {
  emailId: string;
  userId: number;
  senderId: number;
  recipient: string;
  subject: string;
  body: string;
  hourlyLimit: number;
  scheduledAt: string;
}

export async function addEmailJobToQueue(jobData: EmailJobData, delayMs: number) {
  const queue = getEmailQueue();
  const calculatedDelay = Math.max(0, delayMs);
  
  const job = await queue.add('send-email', jobData, {
    delay: calculatedDelay,
    jobId: `email_${jobData.emailId}`,
  });

  return job;
}
