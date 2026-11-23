export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  has_slack: boolean;
  slack_channel?: string;
}

export interface Sender {
  id: number;
  name: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  created_at: string;
}

export interface EmailJob {
  id: string;
  user_id: number;
  sender_id: number;
  sender_name?: string;
  sender_email?: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'scheduled' | 'sending' | 'sent' | 'rate_limited' | 'failed';
  scheduled_at: string;
  sent_at?: string | null;
  delay_seconds: number;
  hourly_limit: number;
  bullmq_job_id?: string;
  ethereal_preview_url?: string | null;
  error_message?: string | null;
  created_at: string;
}
