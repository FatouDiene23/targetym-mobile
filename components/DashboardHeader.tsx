'use client';

import { Bell, Search } from 'lucide-react';
import { useState } from 'react';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  actions?: React.ReactNode;
}

export default function DashboardHeader({ title, subtitle, showSearch = true, actions }: DashboardHeaderProps) {
  const [notifications] = useState([
    { id: 1, text: "Nouvelle candidature reçue", time: "Il y a 5 min" },
    { id: 2, text: "Objectif Q4 atteint à 80%", time: "Il y a 1h" },
    { id: 3, text: "Évaluation de performance à compléter", time: "Il y a 2h" },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-4">
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="pl-10 pr-4 py-2 w-64 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        )}

        {actions}

        {/* Notifications */}
        <div className="relative">
          <button 
            data-tour="notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                    <p className="text-sm text-gray-900">{notif.text}</p>
                    <p className="text-xs text-gray-400 mt-1">{notif.time}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 text-center border-t border-gray-100">
                <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  Voir toutes les notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center cursor-pointer">
          <span className="text-white font-medium text-sm">MR</span>
        </div>
      </div>
    </header>
  );
}
