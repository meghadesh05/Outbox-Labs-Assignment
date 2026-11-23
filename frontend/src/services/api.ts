import axios from 'axios';
import { User, Sender, EmailJob } from '../types';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export const authService = {
  async getMe(): Promise<User | null> {
    try {
      const res = await api.get<{ user: User }>('/auth/me');
      return res.data.user;
    } catch {
      return null;
    }
  },

  async getGoogleUrl(): Promise<{ configured: boolean; url?: string; message?: string }> {
    const res = await api.get('/auth/google/url');
    return res.data;
  },

  async demoLogin(): Promise<User> {
    const res = await api.post<{ success: boolean; user: User }>('/auth/demo-login');
    return res.data.user;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};

export const senderService = {
  async getSenders(): Promise<Sender[]> {
    const res = await api.get<{ senders: Sender[] }>('/senders');
    return res.data.senders;
  },

  async createEtherealSender(name?: string): Promise<Sender> {
    const res = await api.post<{ success: boolean; sender: Sender }>('/senders/ethereal', { name });
    return res.data.sender;
  },
};

export const emailService = {
  async parseRecipients(file: File): Promise<{ count: number; recipients: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ count: number; recipients: string[] }>('/emails/parse-recipients', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async scheduleEmails(data: {
    recipients: string[];
    subject: string;
    body: string;
    senderId: number;
    startTime: string;
    delaySeconds: number;
    hourlyLimit: number;
    idempotencyKey?: string;
  }): Promise<{ scheduledCount: number; skippedCount: number; firstScheduledAt: string }> {
    const res = await api.post('/emails/schedule', data);
    return res.data;
  },

  async getScheduledEmails(): Promise<EmailJob[]> {
    const res = await api.get<{ emails: EmailJob[] }>('/emails/scheduled');
    return res.data.emails;
  },

  async getSentEmails(): Promise<EmailJob[]> {
    const res = await api.get<{ emails: EmailJob[] }>('/emails/sent');
    return res.data.emails;
  },

  async searchEmails(query: string): Promise<EmailJob[]> {
    const res = await api.get<{ results: EmailJob[] }>(`/emails/search?q=${encodeURIComponent(query)}`);
    return res.data.results;
  },

  async cancelEmail(id: string): Promise<void> {
    await api.delete(`/emails/${id}`);
  },
};

export const slackService = {
  async getStatus(): Promise<{ connected: boolean; channel?: string; team?: string }> {
    const res = await api.get('/slack/status');
    return res.data;
  },

  async getAuthUrl(): Promise<{ configured: boolean; url?: string; message?: string }> {
    const res = await api.get('/slack/auth-url');
    return res.data;
  },

  async connectWebhook(webhookUrl: string, channelName?: string): Promise<{ success: boolean; channel: string }> {
    const res = await api.post('/slack/connect-webhook', { webhookUrl, channelName });
    return res.data;
  },

  async disconnect(): Promise<void> {
    await api.post('/slack/disconnect');
  },

  async testAlert(): Promise<{ success: boolean; message: string }> {
    const res = await api.post('/slack/test-alert');
    return res.data;
  },
};
