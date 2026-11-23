import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../db/db.js';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  slack_webhook_url?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<any> {
  const token = req.cookies?.reachinbox_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    // If running in development without auth token, attach default demo user for convenience
    const demoRes = await query('SELECT id, email, name, avatar_url, slack_webhook_url FROM users LIMIT 1');
    if (demoRes.rows.length > 0) {
      req.user = demoRes.rows[0];
      return next();
    }
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    const userRes = await query(
      'SELECT id, email, name, avatar_url, slack_webhook_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    req.user = userRes.rows[0];
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}
