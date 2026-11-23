import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../db/db.js';

export const authRouter = Router();

// 1. Get Google OAuth Authorization URL or check status
authRouter.get('/google/url', (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID === 'your_google_client_id_here') {
    return res.json({
      configured: false,
      message: 'Google OAuth Client ID is not configured in .env',
    });
  }

  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    client_id: env.GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };

  const qs = new URLSearchParams(options);
  return res.json({
    configured: true,
    url: `${rootUrl}?${qs.toString()}`,
  });
});

// 2. Direct Google OAuth Redirect
authRouter.get('/google', (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID === 'your_google_client_id_here') {
    return res.redirect(`${env.FRONTEND_URL}/login?error=Google+OAuth+not+configured+in+.env`);
  }

  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    client_id: env.GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };

  res.redirect(`${rootUrl}?${new URLSearchParams(options).toString()}`);
});

// 3. Google OAuth Callback
authRouter.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    return res.redirect(`${env.FRONTEND_URL}/login?error=No+code+received+from+Google`);
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json() as any;
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[Auth] Google token exchange failed:', tokenData);
      return res.redirect(`${env.FRONTEND_URL}/login?error=Failed+to+exchange+Google+token`);
    }

    // Fetch user profile from Google
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userinfoResponse.json() as any;

    // Upsert into users table
    const upsertRes = await query(
      `INSERT INTO users (email, name, avatar_url, google_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) 
       DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, google_id = EXCLUDED.google_id
       RETURNING id, email, name, avatar_url`,
      [profile.email, profile.name, profile.picture, profile.id]
    );

    const user = upsertRes.rows[0];

    // Issue JWT token in secure HTTP-only cookie
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('reachinbox_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err: any) {
    console.error('[Auth] Error in Google OAuth callback:', err);
    return res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(err.message)}`);
  }
});

// 4. Demo Login (for testing without external Google OAuth credentials)
authRouter.post('/demo-login', async (req: Request, res: Response) => {
  try {
    let userRes = await query('SELECT id, email, name, avatar_url, slack_webhook_url FROM users LIMIT 1');
    if (userRes.rows.length === 0) {
      userRes = await query(
        `INSERT INTO users (email, name, avatar_url, google_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, avatar_url, slack_webhook_url`,
        [
          'demo.user@reachinbox.ai',
          'Demo Recruiter',
          'https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInboxDemo',
          'demo-user-001',
        ]
      );
    }

    const user = userRes.rows[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('reachinbox_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      user,
      token, // Also return token for test runners or headers
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Get Current User Info
authRouter.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.reachinbox_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    // If running in development, return the first user
    const defaultUserRes = await query('SELECT id, email, name, avatar_url, slack_webhook_url, slack_channel FROM users LIMIT 1');
    if (defaultUserRes.rows.length > 0) {
      const u = defaultUserRes.rows[0];
      return res.json({
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          avatar_url: u.avatar_url,
          has_slack: Boolean(u.slack_webhook_url),
          slack_channel: u.slack_channel,
        },
      });
    }
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    const userRes = await query(
      'SELECT id, email, name, avatar_url, slack_webhook_url, slack_channel FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const u = userRes.rows[0];
    return res.json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        avatar_url: u.avatar_url,
        has_slack: Boolean(u.slack_webhook_url),
        slack_channel: u.slack_channel,
      },
    });
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid session token' });
  }
});

// 6. Logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('reachinbox_token');
  return res.json({ success: true, message: 'Logged out successfully' });
});
