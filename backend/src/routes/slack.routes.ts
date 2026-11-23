import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import { query } from '../db/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendSlackRateLimitAlert } from '../services/slack.js';

export const slackRouter = Router();

// 1. Get Slack OAuth URL
slackRouter.get('/auth-url', authMiddleware, (req: Request, res: Response) => {
  if (!env.SLACK_CLIENT_ID || env.SLACK_CLIENT_ID === 'your_slack_client_id_here') {
    return res.json({
      configured: false,
      message: 'Slack OAuth is not configured with SLACK_CLIENT_ID in .env. You can connect directly using an Incoming Webhook URL.',
    });
  }

  const rootUrl = 'https://slack.com/oauth/v2/authorize';
  const options = {
    client_id: env.SLACK_CLIENT_ID,
    scope: 'incoming-webhook,chat:write',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: String(req.user?.id || 1),
  };

  return res.json({
    configured: true,
    url: `${rootUrl}?${new URLSearchParams(options).toString()}`,
  });
});

// 2. Slack OAuth Callback
slackRouter.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const userId = state ? parseInt(state, 10) : 1;

  if (!code) {
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=No+code+provided`);
  }

  try {
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI,
      }),
    });

    const data = await tokenRes.json() as any;

    if (!data.ok) {
      console.error('[Slack] OAuth access exchange failed:', data);
      return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(data.error || 'Failed to authorize Slack')}`);
    }

    const webhookUrl = data.incoming_webhook?.url;
    const channel = data.incoming_webhook?.channel;
    const teamName = data.team?.name;
    const teamId = data.team?.id;
    const accessToken = data.access_token;

    await query(
      `UPDATE users 
       SET slack_webhook_url = $1, 
           slack_channel = $2, 
           slack_team_name = $3, 
           slack_team_id = $4, 
           slack_access_token = $5 
       WHERE id = $6`,
      [webhookUrl, channel, teamName, teamId, accessToken, userId]
    );

    console.log(`[Slack] Successfully connected Slack for user ID ${userId} (Channel: ${channel}, Team: ${teamName})`);
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_connected=true`);
  } catch (err: any) {
    console.error('[Slack] Error in callback:', err);
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(err.message)}`);
  }
});

// 3. Connect Slack via Direct Webhook URL
slackRouter.post('/connect-webhook', authMiddleware, async (req: Request, res: Response) => {
  const { webhookUrl, channelName } = req.body;

  if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
    return res.status(400).json({ error: 'Valid Slack webhook URL starting with https://hooks.slack.com/ is required.' });
  }

  try {
    const userId = req.user!.id;
    await query(
      `UPDATE users 
       SET slack_webhook_url = $1, 
           slack_channel = $2, 
           slack_team_name = $3 
       WHERE id = $4`,
      [webhookUrl, channelName || 'custom-channel', 'Connected Workspace', userId]
    );

    return res.json({
      success: true,
      message: 'Slack webhook successfully saved.',
      channel: channelName || 'custom-channel',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Disconnect Slack
slackRouter.post('/disconnect', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await query(
      `UPDATE users 
       SET slack_webhook_url = NULL, 
           slack_channel = NULL, 
           slack_team_name = NULL, 
           slack_team_id = NULL, 
           slack_access_token = NULL 
       WHERE id = $1`,
      [userId]
    );

    return res.json({ success: true, message: 'Slack disconnected successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Get Slack Status
slackRouter.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userRes = await query(
      'SELECT slack_webhook_url, slack_channel, slack_team_name FROM users WHERE id = $1',
      [req.user!.id]
    );
    const u = userRes.rows[0];
    return res.json({
      connected: Boolean(u?.slack_webhook_url),
      channel: u?.slack_channel || null,
      team: u?.slack_team_name || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Test Slack Alert
slackRouter.post('/test-alert', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const delivered = await sendSlackRateLimitAlert({
      userId,
      senderId: 1,
      senderName: 'Test ReachInbox Sender',
      senderEmail: 'test.sender@ethereal.email',
      hourlyLimit: 50,
      attemptedCount: 51,
      rescheduledUntil: new Date(Date.now() + 3600000),
    });

    if (!delivered) {
      return res.status(400).json({
        success: false,
        message: 'Could not deliver test alert. Please verify your Slack connection or webhook URL.',
      });
    }

    return res.json({
      success: true,
      message: 'Test alert sent to Slack successfully!',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
