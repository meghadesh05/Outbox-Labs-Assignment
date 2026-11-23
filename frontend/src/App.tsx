import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Send,
  Plus,
  Search,
  Activity,
  Layers,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { User, EmailJob } from './types';
import { authService, emailService } from './services/api';
import { LoginCard } from './components/LoginCard';
import { Navbar } from './components/Navbar';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { EmailTable } from './components/EmailTable';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Tabs & Search
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Data
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [searchResults, setSearchResults] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [isSlackOpen, setIsSlackOpen] = useState<boolean>(false);

  // Check initial user authentication
  useEffect(() => {
    authService
      .getMe()
      .then((u) => setUser(u))
      .finally(() => setAuthChecking(false));
  }, []);

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [scheduled, sent] = await Promise.all([
        emailService.getScheduledEmails(),
        emailService.getSentEmails(),
      ]);
      setScheduledEmails(scheduled);
      setSentEmails(sent);
    } catch (err: any) {
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch and auto-polling every 4 seconds
  useEffect(() => {
    if (!user) return;
    fetchEmails();

    const interval = setInterval(() => {
      // Background silent refresh
      if (!isSearching) {
        Promise.all([
          emailService.getScheduledEmails(),
          emailService.getSentEmails(),
        ]).then(([scheduled, sent]) => {
          setScheduledEmails(scheduled);
          setSentEmails(sent);
        });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [user, fetchEmails, isSearching]);

  // Handle Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await emailService.searchEmails(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleCancelEmail = async (id: string) => {
    try {
      await emailService.cancelEmail(id);
      fetchEmails();
    } catch (err: any) {
      alert('Failed to cancel email: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  const handleRefreshUser = async () => {
    const updated = await authService.getMe();
    if (updated) setUser(updated);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginCard onLoginSuccess={(u) => setUser(u)} />;
  }

  const displayedEmails = isSearching
    ? searchResults.filter((e) =>
        activeTab === 'scheduled'
          ? e.status === 'scheduled' || e.status === 'rate_limited' || e.status === 'sending'
          : e.status === 'sent' || e.status === 'failed'
      )
    : activeTab === 'scheduled'
    ? scheduledEmails
    : sentEmails;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        user={user}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{scheduledEmails.length}</div>
              <div className="text-xs font-medium text-slate-500">Scheduled Queue Jobs</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{sentEmails.length}</div>
              <div className="text-xs font-medium text-slate-500">Dispatched Via Ethereal</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">BullMQ Worker</div>
                <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Concurrency: 5
                </div>
              </div>
            </div>
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline"
            >
              Queue UI &rarr;
            </a>
          </div>
        </div>

        {/* Action Header: Tabs, Search Bar, and Compose Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-slate-200/80 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'scheduled'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Scheduled Emails</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">
                {scheduledEmails.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'sent'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Sent Emails</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-bold">
                {sentEmails.length}
              </span>
            </button>
          </div>

          {/* Search & Compose */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipients, subjects, body..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Search Notice */}
        {isSearching && (
          <div className="text-xs text-slate-500 flex items-center justify-between px-2">
            <span>
              Searching for &ldquo;<span className="font-semibold text-slate-800">{searchQuery}</span>&rdquo; (Elasticsearch full-text index)
            </span>
            <span>{displayedEmails.length} match(es)</span>
          </div>
        )}

        {/* Main Table */}
        <EmailTable
          emails={displayedEmails}
          loading={loading}
          activeTab={activeTab}
          onCancelEmail={handleCancelEmail}
          onRefresh={fetchEmails}
        />
      </main>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onScheduledSuccess={fetchEmails}
      />

      <SlackModal
        isOpen={isSlackOpen}
        user={user}
        onClose={() => setIsSlackOpen(false)}
        onStatusChange={handleRefreshUser}
      />
    </div>
  );
};
