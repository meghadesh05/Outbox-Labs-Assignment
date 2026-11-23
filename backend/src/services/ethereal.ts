import nodemailer, { Transporter } from 'nodemailer';
import { query } from '../db/db.js';

const transporterCache = new Map<number, Transporter>();

export async function getTransporterForSender(senderId: number): Promise<{
  transporter: Transporter;
  senderEmail: string;
  senderName: string;
}> {
  const cached = transporterCache.get(senderId);
  if (cached) {
    const senderRes = await query('SELECT name, email FROM senders WHERE id = $1', [senderId]);
    const sender = senderRes.rows[0];
    return {
      transporter: cached,
      senderEmail: sender?.email || '',
      senderName: sender?.name || 'ReachInbox Sender',
    };
  }

  const senderRes = await query(
    'SELECT id, name, email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure FROM senders WHERE id = $1',
    [senderId]
  );

  if (senderRes.rows.length === 0) {
    throw new Error(`Sender with ID ${senderId} not found in database.`);
  }

  const sender = senderRes.rows[0];
  const transporter = nodemailer.createTransport({
    host: sender.smtp_host,
    port: sender.smtp_port,
    secure: sender.smtp_secure,
    auth: {
      user: sender.smtp_user,
      pass: sender.smtp_pass,
    },
  });

  transporterCache.set(senderId, transporter);
  return {
    transporter,
    senderEmail: sender.email,
    senderName: sender.name,
  };
}

export async function sendEmailViaSender(params: {
  senderId: number;
  recipient: string;
  subject: string;
  body: string;
}): Promise<{
  messageId: string;
  previewUrl: string | false;
}> {
  const { senderId, recipient, subject, body } = params;
  const { transporter, senderEmail, senderName } = await getTransporterForSender(senderId);

  const info = await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to: recipient,
    subject: subject,
    text: body,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      ${body.replace(/\n/g, '<br/>')}
    </div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId,
    previewUrl,
  };
}

export async function createNewEtherealSender(name: string): Promise<any> {
  const testAccount = await nodemailer.createTestAccount();
  const insertRes = await query(
    `INSERT INTO senders (name, email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      name,
      testAccount.user,
      testAccount.smtp.host,
      testAccount.smtp.port,
      testAccount.user,
      testAccount.pass,
      testAccount.smtp.secure,
    ]
  );
  return insertRes.rows[0];
}
