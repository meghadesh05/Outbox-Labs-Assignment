import { Router, Request, Response } from 'express';
import { query } from '../db/db.js';
import { createNewEtherealSender } from '../services/ethereal.js';
import { authMiddleware } from '../middleware/auth.js';

export const senderRouter = Router();

// 1. Get all configured senders
senderRouter.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, name, email, smtp_host, smtp_port, smtp_secure, created_at FROM senders ORDER BY id ASC'
    );
    return res.json({ senders: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Generate a new Ethereal SMTP sender on the fly
senderRouter.post('/ethereal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const senderName = name || `Ethereal Sender ${Date.now().toString().slice(-4)}`;
    const sender = await createNewEtherealSender(senderName);
    return res.json({ success: true, sender });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Add custom SMTP sender
senderRouter.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, email, host, port, user, pass, secure } = req.body;

    if (!name || !email || !host || !port || !user || !pass) {
      return res.status(400).json({ error: 'All SMTP configuration fields are required.' });
    }

    const insertRes = await query(
      `INSERT INTO senders (name, email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, smtp_host, smtp_port, smtp_secure, created_at`,
      [name, email, host, parseInt(port, 10), user, pass, Boolean(secure)]
    );

    return res.json({ success: true, sender: insertRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
