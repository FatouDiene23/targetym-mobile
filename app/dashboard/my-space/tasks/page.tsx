'use client';

import { ClipboardList, Clock } from 'lucide-react';

export default function MyTasksPage() {
  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mes Tâches</h1>
          <p className="text-gray-500 mt-1">Gérez vos tâches et suivez votre progression</p>
        </div>

        {/* Coming Soon */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ClipboardList className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Module en développement</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Le module de gestion des tâches sera bientôt disponible. 
            Vous pourrez gérer vos tâches quotidiennes, suivre votre progression et collaborer avec votre équipe.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Prochainement disponible
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
            <h3 className="font-medium text-gray-900 mb-2">📋 Liste de tâches</h3>
            <p className="text-sm text-gray-500">Créez et organisez vos tâches par priorité</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
            <h3 className="font-medium text-gray-900 mb-2">📊 Suivi de progression</h3>
            <p className="text-sm text-gray-500">Visualisez votre avancement en temps réel</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
            <h3 className="font-medium text-gray-900 mb-2">🔔 Rappels</h3>
            <p className="text-sm text-gray-500">Recevez des notifications pour les échéances</p>
          </div>
        </div>
      </div>
    </div>
  );
}
