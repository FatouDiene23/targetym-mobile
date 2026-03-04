'use client';

import { useState } from 'react';
import { useLearning } from '../LearningContext';
import { hasPermission, API_URL, getAuthHeaders, categories } from '../shared';
import { Target, Plus, Clock, Users, BookOpen, ChevronRight, X, Edit2, Archive, UserPlus, Check, Loader2 } from 'lucide-react';

interface PathDetail {
  id: number;
  title: string;
  description: string;
  category: string;
  is_active: boolean;
  courses: { id: number; title: string; image_emoji: string; duration_hours: number; level: string }[];
  assigned_count: number;
  progress: number;
}

export default function PathsPage() {
  const { userRole, learningPaths, setShowCreatePath, employees, courses, refreshPaths } = useLearning();

  // Panel state
  const [selectedPath, setSelectedPath] = useState<PathDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Assign state
  const [showAssign, setShowAssign] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [assignDeadline, setAssignDeadline] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', category: '', course_ids: [] as number[] });
  const [isEditing, setIsEditing] = useState(false);

  const openDetail = async (pathId: number) => {
    setIsLoadingDetail(true);
    setSelectedPath(null);
    setShowAssign(false);
    setShowEdit(false);
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

  const closePanel = () => {
    setSelectedPath(null);
    setShowAssign(false);
    setShowEdit(false);
  };

  const openAssign = () => {
    setSelectedEmpIds([]);
    setAssignDeadline('');
    setShowAssign(true);
    setShowEdit(false);
  };

  const openEdit = () => {
    if (!selectedPath) return;
    setEditData({
      title: selectedPath.title,
      description: selectedPath.description,
      category: selectedPath.category,
      course_ids: selectedPath.courses.map(c => c.id),
    });
    setShowEdit(true);
    setShowAssign(false);
  };

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
    setShowAssign(false);
    alert(`${success}/${selectedEmpIds.length} employé(s) assigné(s) avec succès`);
    await refreshPaths();
    openDetail(selectedPath.id);
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
        setShowEdit(false);
        await refreshPaths();
        openDetail(selectedPath.id);
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
        closePanel();
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
    <div className="flex gap-4 items-start">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Parcours de Formation</h2>
            <p className="text-sm text-gray-500">Curriculums collectifs — regroupent des cours assignables à des groupes d'employés</p>
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

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
          <Target className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Parcours collectifs de formation</p>
            <p className="text-blue-600 mt-0.5">Un parcours regroupe plusieurs cours autour d'un thème (ex: "Développeur Fullstack"). Il peut être assigné à plusieurs employés à la fois. Pour un plan personnalisé lié à la carrière d'un employé, utilisez <span className="font-semibold">Plans Individuels</span>.</p>
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
              <div
                key={path.id}
                onClick={() => openDetail(path.id)}
                className={`bg-white rounded-xl p-5 shadow-sm border cursor-pointer transition-all ${
                  selectedPath?.id === path.id
                    ? 'border-primary-400 shadow-md ring-2 ring-primary-100'
                    : 'border-gray-100 hover:shadow-md hover:border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-primary-600" />
                  </div>
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
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Progression moyenne</span>
                      <span className="font-medium">{path.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div className={`h-full rounded-full ${path.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${path.progress}%` }} />
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 transition-transform ${selectedPath?.id === path.id ? 'rotate-90 text-primary-600' : 'text-gray-400'}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side panel */}
      {(selectedPath || isLoadingDetail) && (
        <div className="w-96 flex-shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
          {isLoadingDetail ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : selectedPath && (
            <>
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedPath.title}</h3>
                  <span className="text-xs text-gray-500">{selectedPath.category}</span>
                </div>
                <button onClick={closePanel} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action buttons */}
              {!showAssign && !showEdit && (
                <div className="p-4 border-b border-gray-100 flex gap-2 flex-wrap">
                  {hasPermission(userRole, 'assign_course') && (
                    <button onClick={openAssign} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                      <UserPlus className="w-4 h-4" />Assigner
                    </button>
                  )}
                  {hasPermission(userRole, 'create_path') && (
                    <>
                      <button onClick={openEdit} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">
                        <Edit2 className="w-4 h-4" />Modifier
                      </button>
                      <button onClick={handleArchive} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100">
                        <Archive className="w-4 h-4" />Archiver
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Course list */}
              {!showAssign && !showEdit && (
                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Cours inclus ({selectedPath.courses.length})
                  </p>
                  {selectedPath.courses.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Aucun cours dans ce parcours</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedPath.courses.map((course, i) => (
                        <div key={course.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <span className="text-xl leading-none">{course.image_emoji || '📚'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{course.title}</p>
                            <p className="text-xs text-gray-500">{course.duration_hours}h</p>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">#{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Users className="w-4 h-4" />{selectedPath.assigned_count} assignés</span>
                    <span className="flex items-center gap-1"><Target className="w-4 h-4" />{selectedPath.progress}% progression</span>
                  </div>
                </div>
              )}

              {/* Assign panel */}
              {showAssign && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setShowAssign(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                    <p className="font-medium text-sm text-gray-900">Assigner le parcours</p>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-600 block mb-1">Date limite (optionnel)</label>
                    <input
                      type="date"
                      value={assignDeadline}
                      onChange={e => setAssignDeadline(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    Employés ({selectedEmpIds.length} sélectionné{selectedEmpIds.length !== 1 ? 's' : ''})
                  </p>
                  <div className="space-y-1 max-h-56 overflow-y-auto border border-gray-100 rounded-lg p-1 mb-4">
                    {employees.map(emp => (
                      <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEmpIds.includes(emp.id)}
                          onChange={() => toggleEmployee(emp.id)}
                          className="rounded accent-primary-500"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-gray-500 truncate">{emp.job_title}</p>
                        </div>
                      </label>
                    ))}
                    {employees.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">Aucun employé disponible</p>
                    )}
                  </div>
                  <button
                    onClick={handleAssign}
                    disabled={selectedEmpIds.length === 0 || isAssigning}
                    className="w-full py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Confirmer l'assignation
                  </button>
                </div>
              )}

              {/* Edit panel */}
              {showEdit && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                    <p className="font-medium text-sm text-gray-900">Modifier le parcours</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Titre</label>
                      <input
                        value={editData.title}
                        onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
                      <textarea
                        value={editData.description}
                        onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Catégorie</label>
                      <select
                        value={editData.category}
                        onChange={e => setEditData(p => ({ ...p, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      >
                        {categories.filter(c => c !== 'Tous').map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Cours ({editData.course_ids.length} sélectionné{editData.course_ids.length !== 1 ? 's' : ''})
                      </label>
                      <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                        {courses.map(course => (
                          <label key={course.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editData.course_ids.includes(course.id)}
                              onChange={() => toggleCourse(course.id)}
                              className="rounded accent-primary-500 flex-shrink-0"
                            />
                            <span className="text-sm text-gray-900 truncate">{course.image_emoji} {course.title}</span>
                          </label>
                        ))}
                        {courses.length === 0 && (
                          <p className="text-sm text-gray-400 text-center py-2">Aucun cours disponible</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleEdit}
                    disabled={isEditing || !editData.title.trim()}
                    className="w-full mt-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
