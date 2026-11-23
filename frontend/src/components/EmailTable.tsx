import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  RefreshCw,
  Mail,
  Zap,
} from 'lucide-react';
import { EmailJob } from '../types';

interface EmailTableProps {
  emails: EmailJob[];
  loading: boolean;
  activeTab: 'scheduled' | 'sent';
  onCancelEmail: (id: string) => void;
  onRefresh: () => void;
}

export const EmailTable: React.FC<EmailTableProps> = ({
  emails,
  loading,
  activeTab,
  onCancelEmail,
  onRefresh,
}) => {
  const getStatusBadge = (email: EmailJob) => {
    switch (email.status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled</span>
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Sending...</span>
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sent</span>
          </span>
        );
      case 'rate_limited':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"
            title={email.error_message || 'Rate limit reached. Automatically rescheduled.'}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Auto-Rescheduled</span>
          </span>
        );
      case 'failed':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"
            title={email.error_message || 'Dispatch failed'}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Table Head / Controls */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900">
            {activeTab === 'scheduled' ? 'Scheduled Queue' : 'Dispatched History'}
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            {emails.length}
          </span>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
          title="Refresh queue"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3.5">Recipient</th>
              <th className="px-6 py-3.5">Subject & Preview</th>
              <th className="px-6 py-3.5">Sender</th>
              <th className="px-6 py-3.5">
                {activeTab === 'scheduled' ? 'Scheduled For' : 'Sent Timestamp'}
              </th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && emails.length === 0 ? (
              // Loading Skeleton
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4">
                    <div className="h-4 bg-slate-200 rounded w-36 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-20" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-slate-200 rounded w-48 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-64" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-slate-200 rounded w-28" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-slate-200 rounded w-24" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-6 bg-slate-200 rounded-full w-20" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="h-4 bg-slate-200 rounded w-12 ml-auto" />
                  </td>
                </tr>
              ))
            ) : emails.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <div className="max-w-xs mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-semibold text-slate-800">
                      {activeTab === 'scheduled'
                        ? 'No scheduled emails in queue'
                        : 'No sent emails yet'}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {activeTab === 'scheduled'
                        ? 'Upload a CSV or compose a new email batch to schedule delayed dispatches.'
                        : 'Emails dispatched by the BullMQ worker process will appear here.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              emails.map((email) => (
                <tr key={email.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Recipient */}
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{email.recipient}</div>
                    <div className="text-[11px] text-slate-400 font-mono">ID: {email.id.slice(0, 8)}</div>
                  </td>

                  {/* Subject & Preview */}
                  <td className="px-6 py-4 max-w-xs">
                    <div className="font-medium text-slate-800 truncate">{email.subject}</div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{email.body}</div>
                  </td>

                  {/* Sender */}
                  <td className="px-6 py-4">
                    <div className="text-xs font-semibold text-slate-800">
                      {email.sender_name || 'ReachInbox Sender'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                      {email.sender_email}
                    </div>
                  </td>

                  {/* Time */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-medium text-slate-700">
                      {new Date(
                        activeTab === 'scheduled' || !email.sent_at
                          ? email.scheduled_at
                          : email.sent_at
                      ).toLocaleString()}
                    </div>
                    {email.delay_seconds > 0 && (
                      <div className="text-[10px] text-slate-400">
                        {email.delay_seconds}s stagger delay
                      </div>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(email)}</td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {/* Ethereal Preview URL */}
                      {email.ethereal_preview_url && (
                        <a
                          href={email.ethereal_preview_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                          title="View live Ethereal inbox rendering"
                        >
                          <span>Ethereal Preview</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* Cancel Job for Scheduled */}
                      {(email.status === 'scheduled' || email.status === 'rate_limited') && (
                        <button
                          onClick={() => onCancelEmail(email.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Cancel scheduled dispatch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
