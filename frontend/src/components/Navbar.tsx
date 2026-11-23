import React from 'react';
import { Mail, Slack, Activity, LogOut } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  user: User;
  onOpenSlackModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onOpenSlackModal, onLogout }) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">ReachInbox</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Scheduler
                </span>
              </div>
            </div>
          </div>

          {/* Right Tools & User Info */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Bull Board Quick Monitor */}
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Open BullMQ Queue Monitor Dashboard"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bull Board</span>
            </a>

            {/* Slack Connection Pill */}
            <button
              onClick={onOpenSlackModal}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                user.has_slack
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Slack className={`w-3.5 h-3.5 ${user.has_slack ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span>{user.has_slack ? 'Slack Connected' : 'Connect Slack'}</span>
              {user.has_slack && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200">
              <img
                src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                alt={user.name}
                className="w-9 h-9 rounded-full ring-2 ring-indigo-600/20 object-cover bg-slate-100"
              />
              <div className="hidden sm:block text-left">
                <div className="text-sm font-semibold text-slate-800 leading-tight">{user.name}</div>
                <div className="text-xs text-slate-400 truncate max-w-[150px]">{user.email}</div>
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
