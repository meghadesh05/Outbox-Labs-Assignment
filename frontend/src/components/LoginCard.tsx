import React, { useState, useEffect } from 'react';
import { Mail, ShieldCheck, Zap, Bell, Database, ArrowRight, ExternalLink } from 'lucide-react';
import { authService } from '../services/api';
import { User } from '../types';

interface LoginCardProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({ onLoginSuccess }) => {
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [googleUrl, setGoogleUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authService.getGoogleUrl().then((res) => {
      setGoogleConfigured(res.configured);
      if (res.url) setGoogleUrl(res.url);
    });
  }, []);

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const user = await authService.demoLogin();
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/50 p-8">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-4">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ReachInbox Outbox</h1>
          <p className="text-sm text-slate-500 mt-1">Autonomous Email Dispatch & BullMQ Scheduler</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {googleConfigured ? (
            <a
              href={googleUrl || '/api/auth/google'}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-300 shadow-sm transition-all hover:shadow"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </a>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <span className="font-semibold">Note:</span> Real Google OAuth is supported. To enable Google sign-in, configure <code className="bg-amber-100 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> in <code className="bg-amber-100 px-1 py-0.5 rounded">.env</code>.
            </div>
          )}

          {/* Quick Demo Login */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Launch Demo Recruiter Session</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Feature Badges */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
            Assignment Tech Highlights
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>BullMQ Delayed Queue</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
              <Database className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>PostgreSQL & Redis</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Atomic Rate Limiter</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
              <Bell className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span>Slack OAuth Alerts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
