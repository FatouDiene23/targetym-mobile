'use client';

// ============================================
// LEARNING MODULE - Fournisseurs de Formation
// File: app/dashboard/learning/providers/page.tsx
// ============================================

import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLearning } from '../LearningContext';
import { hasPermission } from '../shared';
import { Plus, Edit, Ban, Globe, Mail, Phone, User, Tag, CheckCircle } from 'lucide-react';

export default function ProvidersPage() {
  const {
    userRole, providers,
    showCreateProvider, setShowCreateProvider,
    setShowEditProvider,
    deactivateProvider,
  } = useLearning();

  const isAdmin = hasPermission(userRole, 'create_course');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; danger?: boolean }>({ open: false, title: '', message: '', onConfirm: () => {} });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès réservé aux administrateurs et RH.</p>
      </div>
    );
  }

  const activeProviders = providers.filter(p => p.is_active);
  const inactiveProviders = providers.filter(p => !p.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{activeProviders.length} fournisseur{activeProviders.length !== 1 ? 's' : ''} actif{activeProviders.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreateProvider(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium"
        >
          <Plus className="w-4 h-4" />
          Ajouter un fournisseur
        </button>
      </div>

      {/* Liste des fournisseurs actifs */}
      {providers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">🏢</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun fournisseur</h3>
          <p className="text-gray-500 mb-6">Ajoutez vos organismes de formation pour les associer aux formations du catalogue.</p>
          <button onClick={() => setShowCreateProvider(true)} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
            Ajouter un fournisseur
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Fournisseurs actifs ({activeProviders.length})</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {activeProviders.map((provider) => (
                <div key={provider.id} className="px-6 py-4 flex items-start gap-4">
                  {/* Badge type */}
                  <div className={`mt-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${provider.type === 'interne' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {provider.type === 'interne' ? 'Interne' : 'Externe'}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{provider.name}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      {provider.contact_name && (
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{provider.contact_name}</span>
                      )}
                      {provider.email && (
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{provider.email}</span>
                      )}
                      {provider.phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{provider.phone}</span>
                      )}
                      {provider.website && (
                        <a href={provider.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline">
                          <Globe className="w-3.5 h-3.5" />{provider.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                    {provider.specialties && (
                      <div className="mt-1.5 flex items-start gap-1 text-xs text-gray-400">
                        <Tag className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{provider.specialties}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setShowEditProvider(provider)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDialog({ open: true, title: 'Désactiver le fournisseur', message: `Désactiver "${provider.name}" ? Il ne sera plus disponible pour de nouvelles formations.`, danger: true, onConfirm: () => deactivateProvider(provider.id) })}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Désactiver"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fournisseurs désactivés */}
          {inactiveProviders.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden opacity-60">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-500">Fournisseurs désactivés ({inactiveProviders.length})</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {inactiveProviders.map((provider) => (
                  <div key={provider.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 shrink-0">
                      {provider.type === 'interne' ? 'Interne' : 'Externe'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-500 line-through">{provider.name}</p>
                    </div>
                    <button
                      onClick={() => setShowEditProvider(provider)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Réactiver via modifier"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
      />
    </div>
  );
}