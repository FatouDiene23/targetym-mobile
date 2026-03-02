'use client';

import { useLearning } from './LearningContext';
import { hasPermission, getLevelColor, getLevelLabel, categories } from './shared';
import {
  BookOpen, Search, Plus, User, Users, Eye, FileWarning, MessageSquarePlus
} from 'lucide-react';
import PageTourTips, { RestartPageTipsButton } from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { learningTips } from '@/config/pageTips';

export default function CatalogPage() {
  const {
    userRole, stats, courses, selectedCategory, setSelectedCategory,
    searchQuery, setSearchQuery, setSelectedCourse, setShowCreateCourse,
    setShowAssignModal, setShowRequestCourse
  } = useLearning();

  const { showTips, dismissTips, resetTips } = usePageTour('learning');

  return (
    <div>
      {showTips && (
        <PageTourTips
          tips={learningTips}
          onDismiss={dismissTips}
          pageTitle="Catalogue de Formations"
        />
      )}
      <RestartPageTipsButton onClick={resetTips} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Catalogue de Formations</h2>
          <p className="text-sm text-gray-500">Toutes les formations disponibles</p>
        </div>
        <div data-tour="learning-stats" className="flex gap-3">
          <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
            <p className="text-lg font-bold text-primary-600">{stats?.total_courses ?? 0}</p>
            <p className="text-xs text-gray-500">Formations</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
            <p className="text-lg font-bold text-green-600">{stats?.completion_rate ?? 0}%</p>
            <p className="text-xs text-gray-500">Complétion</p>
          </div>
          {(stats?.pending_validation ?? 0) > 0 && (
            <div className="bg-amber-50 rounded-xl px-4 py-2.5 border border-amber-200 text-center">
              <p className="text-lg font-bold text-amber-600">{stats!.pending_validation}</p>
              <p className="text-xs text-amber-600">À valider</p>
            </div>
          )}
        </div>
      </div>
      <div data-tour="learning-filters" className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Rechercher une formation..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${selectedCategory === cat ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{cat}</button>
          ))}
        </div>
        {hasPermission(userRole, 'create_course') && (
          <button onClick={() => setShowCreateCourse(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
            <Plus className="w-4 h-4 mr-2" />Ajouter
          </button>
        )}
        {hasPermission(userRole, 'assign_course') && (
          <button onClick={() => setShowAssignModal(true)} className="flex items-center px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600">
            <User className="w-4 h-4 mr-2" />Assigner
          </button>
        )}
        {hasPermission(userRole, 'request_course') && (
          <button 
            data-tour="request-course"
            onClick={() => setShowRequestCourse(true)} 
            className="flex items-center px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600"
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />Demander
          </button>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune formation trouvée</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courses.map((course) => (
            <div key={course.id} onClick={() => setSelectedCourse(course)} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
              <div className="h-32 bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-5xl relative">
                {course.image_emoji || '📚'}
                {course.is_mandatory && <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded">Obligatoire</span>}
                {course.requires_certificate && <span className="absolute top-2 left-2 px-2 py-0.5 bg-purple-500 text-white text-xs font-medium rounded flex items-center gap-1"><FileWarning className="w-3 h-3" />Certif.</span>}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Eye className="w-12 h-12 text-white drop-shadow-lg" />
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(course.level)}`}>{getLevelLabel(course.level)}</span>
                  <span className="text-xs text-gray-500">{course.duration_hours}h</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2">{course.title}</h4>
                <p className="text-xs text-gray-500 mb-3">{course.provider || 'Interne'}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm"><Users className="w-4 h-4 text-gray-400 mr-1" /><span className="text-gray-600">{course.enrolled}</span></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{course.completion_rate}%</span>
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${course.completion_rate}%` }} /></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
