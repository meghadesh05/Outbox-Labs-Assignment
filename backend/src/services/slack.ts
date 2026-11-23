import { query } from '../db/db.js';

export interface SlackAlertParams {
  userId: number;
  senderName: string;
  senderEmail: string;
  senderId: number;
  hourlyLimit: number;
  attemptedCount: number;
  rescheduledUntil: Date;
}

export async function sendSlackRateLimitAlert(params: SlackAlertParams): Promise<boolean> {
  const {
    userId,
    senderName,
    senderEmail,
    senderId,
    hourlyLimit,
    attemptedCount,
    rescheduledUntil,
  } = params;

  try {
    // Look up user's Slack settings
    const userRes = await query('SELECT slack_webhook_url, slack_channel, email FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    const messageText = `🚨 *ReachInbox Rate Limit Alert*\n` +
      `Sender *${senderName}* (<${senderEmail}>) has exceeded its hourly limit!\n` +
      `• *Hourly Limit:* ${hourlyLimit} emails/hour\n` +
      `• *Attempts Recorded:* ${attemptedCount}\n` +
      `• *Status:* Remaining pending emails have been automatically rescheduled to *${rescheduledUntil.toLocaleTimeString()}* (${rescheduledUntil.toISOString()}).\n` +
      `• *Recipient Queue:* Safe & preserved in BullMQ.`;

    if (!user || !user.slack_webhook_url) {
      console.log(`[Slack] No Slack webhook configured for user ID ${userId}. Alert logged:`);
      console.log(messageText);
      return false;
    }

    console.log(`[Slack] Sending rate limit alert to Slack webhook for user ${user.email}...`);

    const response = await fetch(user.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: messageText,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 Hourly Limit Reached - Auto Rescheduled',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Sender:*\n${senderName} (${senderEmail})` },
              { type: 'mrkdwn', text: `*Hourly Limit:*\n${hourlyLimit} emails/hr` },
              { type: 'mrkdwn', text: `*Attempted Count:*\n${attemptedCount}` },
              { type: 'mrkdwn', text: `*Rescheduled Window:*\n${rescheduledUntil.toLocaleTimeString()}` },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '🤖 *ReachInbox Email Scheduler* • Safeguarding your sender reputation.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Slack] Webhook response failed with status ${response.status}: ${errText}`);
      return false;
    }

    console.log(`[Slack] Rate limit alert successfully delivered to Slack!`);
    return true;
  } catch (err: any) {
    console.error(`[Slack] Failed to deliver Slack alert:`, err.message);
    return false;
  }
}
