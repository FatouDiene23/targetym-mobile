'use client';

import { useState } from 'react';
import { Search, Bell, Plus, X } from 'lucide-react';
import AddModal from './AddModal';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddSuccess = () => {
    setShowAddModal(false);
    // Recharger la page pour voir les changements
    window.location.reload();
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Titre */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Recherche */}
            <div className="relative">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Rechercher"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Dropdown recherche */}
              {showSearch && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un employé (ID, nom...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 text-sm outline-none"
                      autoFocus
                    />
                    <button onClick={() => setShowSearch(false)} className="p-1 hover:bg-gray-100 rounded">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="text-center py-6 text-gray-500 text-sm">
                    <p>Tapez un ID employé ou un nom</p>
                    <p className="text-xs text-gray-400 mt-1">Ex: EMP001, Diallo...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {/* Badge notification (si besoin) */}
                {/* <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span> */}
              </button>

              {/* Dropdown notifications */}
              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 rounded">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="p-6 text-center text-gray-500">
                    <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Aucune notification</p>
                    <p className="text-xs text-gray-400 mt-1">Vous êtes à jour !</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton Ajouter */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </button>
          </div>
        </div>
      </header>

      {/* Modal Ajouter */}
      {showAddModal && (
        <AddModal 
          onClose={() => setShowAddModal(false)} 
          onSuccess={handleAddSuccess} 
        />
      )}

      {/* Overlay pour fermer les dropdowns */}
      {(showSearch || showNotifications) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowSearch(false);
            setShowNotifications(false);
          }}
        />
      )}
    </>
  );
}
