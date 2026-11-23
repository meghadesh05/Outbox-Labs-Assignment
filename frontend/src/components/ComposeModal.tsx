import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Mail, Clock, ShieldAlert, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Sender } from '../types';
import { senderService, emailService } from '../services/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduledSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onScheduledSuccess }) => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<number | ''>('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualRecipients, setManualRecipients] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(50);

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [generatingSender, setGeneratingSender] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadSenders();
      // Default start time: 1 minute from now formatted for datetime-local input
      const nextMinute = new Date(Date.now() + 60000);
      nextMinute.setMinutes(nextMinute.getMinutes() - nextMinute.getTimezoneOffset());
      setStartTime(nextMinute.toISOString().slice(0, 16));
    }
  }, [isOpen]);

  const loadSenders = async () => {
    try {
      const list = await senderService.getSenders();
      setSenders(list);
      if (list.length > 0 && selectedSenderId === '') {
        setSelectedSenderId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load senders:', err);
    }
  };

  const handleGenerateEtherealSender = async () => {
    try {
      setGeneratingSender(true);
      setError(null);
      const newSender = await senderService.createEtherealSender();
      setSenders((prev) => [...prev, newSender]);
      setSelectedSenderId(newSender.id);
    } catch (err: any) {
      setError('Could not generate Ethereal sender: ' + err.message);
    } finally {
      setGeneratingSender(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      setUploadedFileName(file.name);
      const res = await emailService.parseRecipients(file);
      setRecipients(res.recipients);
      setManualRecipients(res.recipients.join('\n'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse recipients file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Merge uploaded and manual recipients
    const manualList = manualRecipients
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes('@'));

    const finalRecipients = Array.from(new Set([...recipients, ...manualList]));

    if (finalRecipients.length === 0) {
      setError('Please provide at least one recipient email address.');
      return;
    }
    if (!selectedSenderId) {
      setError('Please select an active sender.');
      return;
    }
    if (!subject.trim()) {
      setError('Email subject cannot be empty.');
      return;
    }
    if (!body.trim()) {
      setError('Email body cannot be empty.');
      return;
    }

    try {
      setSubmitting(true);
      await emailService.scheduleEmails({
        recipients: finalRecipients,
        subject,
        body,
        senderId: Number(selectedSenderId),
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        delaySeconds,
        hourlyLimit,
      });

      onScheduledSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to schedule emails');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Compose & Schedule Batch</h2>
              <p className="text-xs text-slate-500">Configure delayed BullMQ queue dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Select Dispatch Sender
              </label>
              <button
                type="button"
                onClick={handleGenerateEtherealSender}
                disabled={generatingSender}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{generatingSender ? 'Generating...' : '+ Generate New Ethereal Sender'}</span>
              </button>
            </div>
            <select
              value={selectedSenderId}
              onChange={(e) => setSelectedSenderId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email}) — {s.smtp_host}
                </option>
              ))}
            </select>
          </div>

          {/* Recipients CSV/TXT Upload */}
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
              Recipients List (CSV / TXT or Manual)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-xl p-4 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <div className="text-sm font-medium text-slate-700">
                {uploading
                  ? 'Parsing recipients...'
                  : uploadedFileName
                  ? `Uploaded: ${uploadedFileName}`
                  : 'Click to upload CSV or TXT file'}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Auto-extracts and deduplicates emails</p>
            </div>

            {/* Recipient count badge & manual input */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Or paste comma / line separated addresses:</span>
                {recipients.length > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {recipients.length} recipients detected
                  </span>
                )}
              </div>
              <textarea
                rows={2}
                value={manualRecipients}
                onChange={(e) => setManualRecipients(e.target.value)}
                placeholder="alice@example.com, bob@example.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Invitation to interview with ReachInbox"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1.5">
              Email Body
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi there,&#10;&#10;We reviewed your application and would love to schedule a technical discussion..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
            />
          </div>

          {/* Scheduling & Rate Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Stagger Delay (Seconds)
              </label>
              <input
                type="number"
                min={1}
                max={300}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Interval between emails</span>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Sender Hourly Limit
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Max per sender/hour</span>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Scheduling...</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>Schedule Dispatch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
