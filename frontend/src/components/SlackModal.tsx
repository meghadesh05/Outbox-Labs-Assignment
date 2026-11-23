import React, { useState, useEffect } from 'react';
import { X, Slack, ExternalLink, Send, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { slackService } from '../services/api';
import { User } from '../types';

interface SlackModalProps {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onStatusChange: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  user,
  onClose,
  onStatusChange,
}) => {
  const [authUrl, setAuthUrl] = useState<string>('');
  const [oauthConfigured, setOauthConfigured] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [channelName, setChannelName] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      slackService.getAuthUrl().then((res) => {
        setOauthConfigured(res.configured);
        if (res.url) setAuthUrl(res.url);
      });
      slackService.getStatus().then((status) => {
        if (status.channel) setChannelName(status.channel);
      });
    }
  }, [isOpen]);

  const handleConnectWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      setMessage({
        text: 'Please enter a valid Slack Incoming Webhook URL starting with https://hooks.slack.com/',
        type: 'error',
      });
      return;
    }

    try {
      setConnecting(true);
      setMessage(null);
      await slackService.connectWebhook(webhookUrl, channelName);
      setMessage({ text: 'Slack webhook connected successfully!', type: 'success' });
      onStatusChange();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.error || 'Failed to connect Slack webhook',
        type: 'error',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleTestAlert = async () => {
    try {
      setTesting(true);
      setMessage(null);
      const res = await slackService.testAlert();
      setMessage({ text: res.message || 'Test alert delivered to Slack channel!', type: 'success' });
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || err.response?.data?.error || 'Test alert delivery failed',
        type: 'error',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      setMessage(null);
      await slackService.disconnect();
      setWebhookUrl('');
      setChannelName('');
      setMessage({ text: 'Slack disconnected successfully', type: 'success' });
      onStatusChange();
    } catch (err: any) {
      setMessage({ text: 'Failed to disconnect: ' + err.message, type: 'error' });
    } finally {
      setDisconnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Slack className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Slack Alerts Integration</h2>
              <p className="text-xs text-slate-500">Hourly limit breach notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Current Status */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  user.has_slack ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`}
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {user.has_slack ? 'Slack Channel Connected' : 'Not Connected'}
                </div>
                <div className="text-xs text-slate-500">
                  {user.has_slack
                    ? user.slack_channel
                      ? `Channel: #${user.slack_channel}`
                      : 'Live incoming webhook active'
                    : 'Alerts are currently logged to server console'}
                </div>
              </div>
            </div>

            {user.has_slack && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={testing}
                  className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>{testing ? 'Sending...' : 'Test Alert'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Disconnect Slack"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* OAuth Connect */}
          {oauthConfigured ? (
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
                Option 1: Connect via Slack OAuth 2.0
              </label>
              <a
                href={authUrl}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4A154B] hover:bg-[#3D113E] text-white font-medium text-sm rounded-xl shadow-md transition-all"
              >
                <Slack className="w-4 h-4" />
                <span>Add to Slack Workspace</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
              </a>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Slack OAuth:</span> To enable 1-click Slack workspace OAuth, add <code className="bg-slate-100 px-1 py-0.5 rounded">SLACK_CLIENT_ID</code> and <code className="bg-slate-100 px-1 py-0.5 rounded">SLACK_CLIENT_SECRET</code> to <code className="bg-slate-100 px-1 py-0.5 rounded">.env</code>.
            </div>
          )}

          {/* Webhook Connect Form */}
          <form onSubmit={handleConnectWebhook} className="space-y-3 pt-3 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              {oauthConfigured ? 'Option 2: Direct Incoming Webhook' : 'Connect via Incoming Webhook'}
            </label>

            <div>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="Optional Channel Name (e.g. #ops-alerts)"
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
              />
              <button
                type="submit"
                disabled={connecting || !webhookUrl}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded-xl disabled:opacity-50 transition-colors shrink-0"
              >
                {connecting ? 'Saving...' : 'Save Webhook'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
