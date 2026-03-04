'use client';

import { useState } from 'react';
import { useLearning } from '../LearningContext';
import { hasPermission, API_URL, getAuthHeaders, categories } from '../shared';
import { Target, Plus, Clock, Users, BookOpen, ChevronRight, X, Edit2, Archive, UserPlus, Check, Loader2, Search, ArrowLeft } from 'lucide-react';

interface PathDetail {
  id: number;
  title: string;
  description: string;
  category: string;
  is_active: boolean;
  courses: { id: number; title: string; image_emoji: string; duration_hours: number }[];
  assigned_count: number;
  progress: number;
}

type ModalView = 'detail' | 'assign' | 'edit';

export default function PathsPage() {
  const { userRole, learningPaths, setShowCreatePath, employees, courses, refreshPaths } = useLearning();

  // Modal state
  const [selectedPath, setSelectedPath] = useState<PathDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [modalView, setModalView] = useState<ModalView>('detail');

  // Assign state
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [assignDeadline, setAssignDeadline] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Edit state
  const [editData, setEditData] = useState({ title: '', description: '', category: '', course_ids: [] as number[] });
  const [isEditing, setIsEditing] = useState(false);

  const openModal = async (pathId: number) => {
    setIsLoadingDetail(true);
    setSelectedPath(null);
    setModalView('detail');
    try {
      const res = await fetch(`${API_URL}/api/learning/paths/${pathId}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setSelectedPath(data);
    } catch (e) {
      console.error('Error fetching path detail:', e);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setSelectedPath(null);
    setIsLoadingDetail(false);
  };

  const openAssign = () => {
    setSelectedEmpIds([]);
    setAssignDeadline('');
    setEmpSearch('');
    setModalView('assign');
  };

  const openEdit = () => {
    if (!selectedPath) return;
    setEditData({
      title: selectedPath.title,
      description: selectedPath.description,
      category: selectedPath.category,
      course_ids: selectedPath.courses.map(c => c.id),
    });
    setModalView('edit');
  };

  const filteredEmployees = employees.filter(emp =>
    `${emp.first_name} ${emp.last_name} ${emp.job_title}`.toLowerCase().includes(empSearch.toLowerCase())
  );

  const toggleEmployee = (id: number) => {
    setSelectedEmpIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const toggleCourse = (id: number) => {
    setEditData(prev => ({
      ...prev,
      course_ids: prev.course_ids.includes(id)
        ? prev.course_ids.filter(c => c !== id)
        : [...prev.course_ids, id],
    }));
  };

  const handleAssign = async () => {
    if (!selectedPath || selectedEmpIds.length === 0) return;
    setIsAssigning(true);
    let success = 0;
    for (const empId of selectedEmpIds) {
      try {
        const res = await fetch(`${API_URL}/api/learning/assignments/`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ employee_id: empId, learning_path_id: selectedPath.id, deadline: assignDeadline || null }),
        });
        if (res.ok) success++;
      } catch (e) { console.error(e); }
    }
    setIsAssigning(false);
    setModalView('detail');
    alert(`${success}/${selectedEmpIds.length} employé(s) assigné(s) avec succès`);
    await refreshPaths();
    openModal(selectedPath.id);
  };

  const handleEdit = async () => {
    if (!selectedPath) return;
    setIsEditing(true);
    try {
      const res = await fetch(`${API_URL}/api/learning/paths/${selectedPath.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        setModalView('detail');
        await refreshPaths();
        openModal(selectedPath.id);
      } else {
        const err = await res.json();
        alert('Erreur: ' + (err.detail || 'Impossible de modifier'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsEditing(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedPath) return;
    if (!confirm(`Archiver le parcours "${selectedPath.title}" ?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/learning/paths/${selectedPath.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        closeModal();
        await refreshPaths();
      } else {
        const err = await res.json();
        alert('Erreur: ' + (err.detail || "Impossible d'archiver"));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Stats */}
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
            <p className="text-lg font-bold text-primary-600">{learningPaths.length}</p>
            <p className="text-xs text-gray-500">Parcours</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 text-center">
            <p className="text-lg font-bold text-blue-600">{learningPaths.reduce((s, p) => s + (p.duration_hours || 0), 0)}h</p>
            <p className="text-xs text-gray-500">Heures totales</p>
          </div>
          {hasPermission(userRole, 'create_path') && (
            <button onClick={() => setShowCreatePath(true)} className="ml-auto flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
              <Plus className="w-4 h-4 mr-2" />Créer un Parcours
            </button>
          )}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
          <Target className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Parcours collectifs de formation</p>
            <p className="text-blue-600 mt-0.5">Un parcours regroupe plusieurs cours autour d'un thème (ex: "Développeur Fullstack"). Il peut être assigné à plusieurs employés à la fois. Pour un plan personnalisé lié à la carrière d'un employé, utilisez <span className="font-semibold">Plans Individuels</span>.</p>
          </div>
        </div>

        {/* Cards grid — toujours pleine largeur */}
        {learningPaths.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Aucun parcours créé</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {learningPaths.map((path) => (
              <div
                key={path.id}
                onClick={() => openModal(path.id)}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                    <Target className="w-6 h-6 text-primary-600" />
                  </div>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">{path.category}</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{path.title}</h4>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{path.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="flex items-center"><BookOpen className="w-4 h-4 mr-1" />{path.courses_count} cours</span>
                  <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{path.duration_hours}h</span>
                  <span className="flex items-center"><Users className="w-4 h-4 mr-1" />{path.assigned_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Progression</span>
                      <span className="font-medium text-gray-700">{path.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-full rounded-full ${path.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${path.progress}%` }} />
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {(selectedPath || isLoadingDetail) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {isLoadingDetail ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : selectedPath && (
              <>
                {/* Modal header */}
                <div className="flex items-start justify-between p-6 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    {modalView !== 'detail' && (
                      <button onClick={() => setModalView('detail')} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedPath.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full font-medium">{selectedPath.category}</span>
                        <span className="text-xs text-gray-400">{selectedPath.courses.length} cours · {selectedPath.assigned_count} assignés</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal body — scrollable */}
                <div className="flex-1 overflow-y-auto">

                  {/* Detail view */}
                  {modalView === 'detail' && (
                    <div className="p-6 space-y-5">
                      {selectedPath.description && (
                        <p className="text-sm text-gray-600">{selectedPath.description}</p>
                      )}

                      {/* Progress */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Progression moyenne</span>
                          <span className="font-semibold text-gray-900">{selectedPath.progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div className={`h-full rounded-full ${selectedPath.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${selectedPath.progress}%` }} />
                        </div>
                      </div>

                      {/* Course list */}
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cours inclus ({selectedPath.courses.length})</p>
                        {selectedPath.courses.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-xl">Aucun cours dans ce parcours</p>
                        ) : (
                          <div className="space-y-2">
                            {selectedPath.courses.map((course, i) => (
                              <div key={course.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <span className="text-xl leading-none w-8 text-center">{course.image_emoji || '📚'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{course.title}</p>
                                  <p className="text-xs text-gray-400">{course.duration_hours}h</p>
                                </div>
                                <span className="text-xs text-gray-300 flex-shrink-0 font-mono">#{i + 1}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Assign view */}
                  {modalView === 'assign' && (
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Date limite (optionnel)</label>
                        <input
                          type="date"
                          value={assignDeadline}
                          onChange={e => setAssignDeadline(e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Employés</label>
                          {selectedEmpIds.length > 0 && (
                            <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                              {selectedEmpIds.length} sélectionné{selectedEmpIds.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Search */}
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Rechercher un employé..."
                            value={empSearch}
                            onChange={e => setEmpSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                          />
                        </div>

                        {/* Employee list */}
                        <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-100 rounded-xl p-1">
                          {filteredEmployees.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">Aucun employé trouvé</p>
                          ) : filteredEmployees.map(emp => (
                            <label key={emp.id} className="flex items-center gap-3 p-2.5 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedEmpIds.includes(emp.id)}
                                onChange={() => toggleEmployee(emp.id)}
                                className="rounded accent-primary-500"
                              />
                              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-primary-700">
                                  {emp.first_name[0]}{emp.last_name[0]}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                                <p className="text-xs text-gray-400 truncate">{emp.job_title}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Edit view */}
                  {modalView === 'edit' && (
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Titre</label>
                        <input
                          value={editData.title}
                          onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Description</label>
                        <textarea
                          value={editData.description}
                          onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Catégorie</label>
                        <select
                          value={editData.category}
                          onChange={e => setEditData(p => ({ ...p, category: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                        >
                          {categories.filter(c => c !== 'Tous').map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cours</label>
                          <span className="text-xs text-gray-400">{editData.course_ids.length} sélectionné{editData.course_ids.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                          {courses.map(course => (
                            <label key={course.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editData.course_ids.includes(course.id)}
                                onChange={() => toggleCourse(course.id)}
                                className="rounded accent-primary-500 flex-shrink-0"
                              />
                              <span className="text-base leading-none">{course.image_emoji}</span>
                              <span className="text-sm text-gray-900 truncate">{course.title}</span>
                              <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{course.duration_hours}h</span>
                            </label>
                          ))}
                          {courses.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Aucun cours disponible</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal footer */}
                <div className="p-4 border-t border-gray-100 flex-shrink-0">
                  {modalView === 'detail' && (
                    <div className="flex gap-2">
                      {hasPermission(userRole, 'assign_course') && (
                        <button onClick={openAssign} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600">
                          <UserPlus className="w-4 h-4" />Assigner
                        </button>
                      )}
                      {hasPermission(userRole, 'create_path') && (
                        <>
                          <button onClick={openEdit} className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200">
                            <Edit2 className="w-4 h-4" />Modifier
                          </button>
                          <button onClick={handleArchive} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100">
                            <Archive className="w-4 h-4" />Archiver
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {modalView === 'assign' && (
                    <button
                      onClick={handleAssign}
                      disabled={selectedEmpIds.length === 0 || isAssigning}
                      className="w-full py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Confirmer l'assignation {selectedEmpIds.length > 0 && `(${selectedEmpIds.length})`}
                    </button>
                  )}

                  {modalView === 'edit' && (
                    <button
                      onClick={handleEdit}
                      disabled={isEditing || !editData.title.trim()}
                      className="w-full py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Enregistrer les modifications
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
