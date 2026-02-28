'use client';

import { useLearning } from '../LearningContext';
import { hasPermission } from '../shared';
import { Target, Plus, Clock, Users, BookOpen, ChevronRight } from 'lucide-react';

export default function PathsPage() {
  const { userRole, learningPaths, setShowCreatePath } = useLearning();

  return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Parcours de Formation</h2>
                <p className="text-sm text-gray-500">Parcours structurés de montée en compétences</p>
              </div>
              <div className="flex gap-3">
                <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
                  <p className="text-lg font-bold text-primary-600">{learningPaths.length}</p>
                  <p className="text-xs text-gray-500">Parcours</p>
                </div>
                <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
                  <p className="text-lg font-bold text-blue-600">{learningPaths.reduce((s, p) => s + (p.duration_hours || 0), 0)}h</p>
                  <p className="text-xs text-gray-500">Heures totales</p>
                </div>
                {hasPermission(userRole, 'create_path') && (
                  <button onClick={() => setShowCreatePath(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                    <Plus className="w-4 h-4 mr-2" />Créer un Parcours
                  </button>
                )}
              </div>
            </div>
            {learningPaths.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucun parcours créé</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {learningPaths.map((path) => (
                  <div key={path.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center"><Target className="w-6 h-6 text-primary-600" /></div>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">{path.category}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{path.title}</h4>
                    <p className="text-sm text-gray-500 mb-4">{path.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <span className="flex items-center"><BookOpen className="w-4 h-4 mr-1" />{path.courses_count} cours</span>
                      <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{path.duration_hours}h</span>
                      <span className="flex items-center"><Users className="w-4 h-4 mr-1" />{path.assigned_count} assignés</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Progression moyenne</span><span className="font-medium">{path.progress}%</span></div>
                        <div className="h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${path.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${path.progress}%` }} /></div>
                      </div>
                      <button className="text-primary-600 hover:text-primary-700"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

  );
}
