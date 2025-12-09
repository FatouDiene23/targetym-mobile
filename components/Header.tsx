'use client';

import { Bell, Search, Plus } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className={`relative ${searchOpen ? 'w-64' : 'w-auto'} transition-all`}>
          {searchOpen ? (
            <div className="flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                autoFocus
                onBlur={() => setSearchOpen(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Quick Add */}
        <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter
        </button>
      </div>
    </header>
  );
}
