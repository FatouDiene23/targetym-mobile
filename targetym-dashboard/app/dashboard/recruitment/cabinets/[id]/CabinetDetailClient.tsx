'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Plus, X, Brain, ChevronLeft, ExternalLink, Search, Mail, Phone, Briefcase } from 'lucide-react';
import {
  getAgency, createMission, getMissionCandidates, updateAgencyCandidateStatus, scoreAgencyCandidate,
  getToken, API_URL,
  type Agency, type AgencyMission, type AgencyCandidate,
} from '@/lib/api';
import toast from 'react-hot-toast';
import CustomSelect from '@/components/CustomSelect';

// Type minimal pour les offres chargées depuis l'API
interface JobOption {
  id: number;
  title: string;
  status: string;
  location: string;
}

async function fetchJobs(): Promise<JobOption[]> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/recruitment/jobs?page_size=100`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as JobOption[];
}

const PIPELINE_STEPS = [
  { key: 'submitted',   label: 'Soumis',      cls: 'bg-gray-100 text-gray-600' },
  { key: 'ai_scored',   label: 'Scoré IA',    cls: 'bg-blue-100 text-blue-700' },
  { key: 'shortlisted', label: 'Shortlisté',  cls: 'bg-primary-100 text-primary-700' },
  { key: 'interview',   label: 'Entretien',   cls: 'bg-yellow-100 text-yellow-700' },
  { key: 'accepted',    label: 'Accepté',     cls: 'bg-green-100 text-green-700' },
  { key: 'rejected',    label: 'Refusé',      cls: 'bg-red-100 text-red-700' },
];

const STATUS_LABELS: Record<string, string> = {
  pending:              'En attente',
  in_progress:          'En cours',
  candidates_submitted: 'Candidats soumis',
  completed:            'Terminée',
  cancelled:            'Annulée',
};

export default function AgencyDetailPage() {
  const params = useParams();
  const agencyId = Number(params.id);

  const [agency, setAgency] = useState<Agency & { missions: AgencyMission[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<AgencyMission | null>(null);
  const [missionCandidates, setMissionCandidates] = useState<AgencyCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const [showMissionModal, setShowMissionModal] = useState(false);
  const [missionForm, setMissionForm] = useState({ job_posting_id: '', brief: '', nb_profiles_requested: '1', deadline: '' });
  const [savingMission, setSavingMission] = useState(false);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobSearch, setJobSearch] = useState('');

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusCandidate, setStatusCandidate] = useState<AgencyCandidate | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => { loadAgency(); fetchJobs().then(setJobs); }, [agencyId]);

  async function loadAgency() {
    setLoading(true);
    try {
      const data = await getAgency(agencyId);
      setAgency(data as any);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function loadMissionCandidates(mission: AgencyMission) {
    setSelectedMission(mission);
    setLoadingCandidates(true);
    try {
      const data = await getMissionCandidates(mission.id);
      setMissionCandidates(data);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function handleCreateMission(e: React.FormEvent) {
    e.preventDefault();
    setSavingMission(true);
    try {
      const fd = new FormData();
      fd.append('job_posting_id', missionForm.job_posting_id);
      if (missionForm.brief) fd.append('brief', missionForm.brief);
      fd.append('nb_profiles_requested', missionForm.nb_profiles_requested);
      if (missionForm.deadline) fd.append('deadline', missionForm.deadline);
      await createMission(agencyId, fd);
      toast.success('Mission créée');
      setShowMissionModal(false);
      setMissionForm({ job_posting_id: '', brief: '', nb_profiles_requested: '1', deadline: '' });
      setJobSearch('');
      loadAgency();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSavingMission(false);
    }
  }

  async function handleUpdateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMission || !statusCandidate) return;
    setSavingStatus(true);
    try {
      const fd = new FormData();
      fd.append('status', newStatus);
      if (newStatus === 'rejected' && rejectionReason) fd.append('rejection_reason', rejectionReason);
      await updateAgencyCandidateStatus(selectedMission.id, statusCandidate.id, fd);
      toast.success('Statut mis à jour');
      setShowStatusModal(false);
      await loadMissionCandidates(selectedMission);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleAIScore(candidate: AgencyCandidate) {
    if (!selectedMission) return;
    try {
      await scoreAgencyCandidate(selectedMission.id, candidate.id);
      toast.success('Scoring IA lancé');
      await loadMissionCandidates(selectedMission);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  if (!agency) return <div className="p-6 text-red-600 font-medium">Cabinet non trouvé</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Back */}
      <a href="/dashboard/recruitment/cabinets" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Retour aux cabinets
      </a>

      {/* Header banner */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary-400 to-primary-600" />
        <div className="p-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-lg">
                {agency.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">{agency.name}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                {agency.contact_name && (
                  <span className="flex items-center gap-1">
                    <span className="w-6 h-6 bg-gray-50 rounded-lg flex items-center justify-center">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                    {agency.contact_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="w-6 h-6 bg-gray-50 rounded-lg flex items-center justify-center">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                  </span>
                  {agency.email}
                </span>
                {agency.phone && (
                  <span className="flex items-center gap-1">
                    <span className="w-6 h-6 bg-gray-50 rounded-lg flex items-center justify-center">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                    {agency.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 text-sm font-medium shadow-sm transition-colors flex-shrink-0"
            onClick={() => setShowMissionModal(true)}
          >
            <Plus className="w-4 h-4" /> Confier une offre
          </button>
        </div>
      </div>

      {/* Missions */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Missions confiées ({agency.missions?.length ?? 0})</h2>

      {(!agency.missions || agency.missions.length === 0) && (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Briefcase className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium mb-1">Aucune mission pour ce cabinet</p>
          <p className="text-xs text-gray-400 mb-4">Confiez une offre d’emploi pour démarrer</p>
          <button
            className="px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 text-sm font-medium"
            onClick={() => setShowMissionModal(true)}
          >
            Confier une offre
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
        {agency.missions?.map(m => {
          const statusLabel = STATUS_LABELS[m.status] ?? m.status;
          const submitted = (m as any).nb_candidates_submitted ?? 0;
          const total = m.nb_profiles_requested;
          const progress = total > 0 ? Math.min(100, Math.round((submitted / total) * 100)) : 0;
          const isSelected = selectedMission?.id === m.id;
          const statusCls: Record<string, string> = {
            pending: 'bg-gray-100 text-gray-600',
            in_progress: 'bg-blue-100 text-blue-700',
            candidates_submitted: 'bg-primary-100 text-primary-700',
            completed: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-600',
          };
          return (
            <div
              key={m.id}
              onClick={() => loadMissionCandidates(m)}
              className={`bg-white rounded-2xl border overflow-hidden cursor-pointer transition-all group ${
                isSelected
                  ? 'border-primary-400 ring-2 ring-primary-100 shadow-md'
                  : 'border-gray-100 shadow-sm hover:border-primary-300 hover:shadow-md'
              }`}
            >
              <div className={`h-1.5 bg-gradient-to-r ${isSelected ? 'from-primary-500 to-primary-700' : 'from-primary-300 to-primary-500 group-hover:from-primary-400 group-hover:to-primary-600'} transition-all`} />
              <div className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Briefcase className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-gray-900 leading-snug truncate">{m.job_title || `Mission #${m.id}`}</h3>
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCls[m.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>Profils soumis</span>
                    <span className="font-semibold text-gray-700">{submitted} / {total}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-primary-400 to-primary-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  {m.deadline
                    ? <span className="text-gray-400">Deadline : {new Date(m.deadline).toLocaleDateString('fr-FR')}</span>
                    : <span />
                  }
                  <span className="text-primary-600 font-medium group-hover:underline">
                    {isSelected ? 'Sélectionné' : 'Voir candidats →'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {selectedMission && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Candidats — {selectedMission.job_title || `Mission #${selectedMission.id}`}
            </h2>
          </div>

          {loadingCandidates ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : missionCandidates.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Aucun candidat soumis pour cette mission
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Candidat', 'Poste actuel', 'Exp.', 'CV', 'Pipeline', 'Score IA', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {missionCandidates.map(c => {
                    const step = PIPELINE_STEPS.find(s => s.key === c.status);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm text-gray-900">{c.first_name} {c.last_name}</div>
                          {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.current_position ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-700">
                          {c.experience_years != null ? `${c.experience_years} ans` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {c.cv_url ? (
                            <a
                              href={c.cv_url.startsWith('http') ? c.cv_url : `${API_URL}${c.cv_url}`}
                              target="_blank" rel="noopener noreferrer"
                              className="px-2 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50"
                            >
                              CV
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${step?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                            {step?.label ?? c.status}
                          </span>
                          {c.status === 'rejected' && c.rejection_reason && (
                            <div className="text-xs text-red-500 mt-1">{c.rejection_reason}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.ai_score != null ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.ai_score >= 75 ? 'bg-green-100 text-green-700' : c.ai_score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {c.ai_score}%
                            </span>
                          ) : (
                            <button
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                              onClick={() => handleAIScore(c)}
                            >
                              <Brain className="w-3 h-3" /> Scorer IA
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!['accepted', 'rejected'].includes(c.status) && (
                            <button
                              className="px-2 py-1 bg-primary-500 text-white rounded text-xs hover:bg-primary-600"
                              onClick={() => {
                                setStatusCandidate(c);
                                setNewStatus('');
                                setRejectionReason('');
                                setShowStatusModal(true);
                              }}
                            >
                              Changer statut
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL Confier une offre */}
      {showMissionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Confier une offre à {agency.name}</h2>
              <button onClick={() => setShowMissionModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateMission} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offre d'emploi *</label>
                <div className="relative mb-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher une offre..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-t-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    value={jobSearch}
                    onChange={e => setJobSearch(e.target.value)}
                  />
                </div>
                <select
                  required
                  size={Math.min(6, jobs.filter(j => !jobSearch || j.title.toLowerCase().includes(jobSearch.toLowerCase())).length + 1)}
                  className="w-full px-3 py-2 border border-t-0 border-gray-300 rounded-b-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  value={missionForm.job_posting_id}
                  onChange={e => setMissionForm(p => ({ ...p, job_posting_id: e.target.value }))}
                >
                  <option value="">-- Sélectionner une offre --</option>
                  {jobs
                    .filter(j => !jobSearch || j.title.toLowerCase().includes(jobSearch.toLowerCase()))
                    .map(j => (
                      <option key={j.id} value={j.id}>
                        {j.title} · {j.location} · {j.status}
                      </option>
                    ))
                  }
                </select>
                {jobs.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Aucune offre disponible — créez d'abord une offre dans le module Recrutement</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brief mission</label>
                <textarea
                  rows={3}
                  placeholder="Contexte, profil recherché, informations complémentaires..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  value={missionForm.brief}
                  onChange={e => setMissionForm(p => ({ ...p, brief: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nb profils demandés</label>
                  <input
                    type="number" min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={missionForm.nb_profiles_requested}
                    onChange={e => setMissionForm(p => ({ ...p, nb_profiles_requested: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={missionForm.deadline}
                    onChange={e => setMissionForm(p => ({ ...p, deadline: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowMissionModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={savingMission} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 text-sm flex items-center gap-2">
                  {savingMission && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confier l'offre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL Changement statut */}
      {showStatusModal && statusCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Changer le statut — {statusCandidate.first_name} {statusCandidate.last_name}
              </h2>
              <button onClick={() => setShowStatusModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleUpdateStatus} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau statut *</label>
                <CustomSelect
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  value={newStatus}
                  onChange={(v) => setNewStatus(v)}
                  options={[
                    { value: '', label: 'Sélectionner...' },
                    ...PIPELINE_STEPS.filter(s => s.key !== statusCandidate.status).map(s => ({ value: s.key, label: s.label })),
                  ]}
                />
              </div>
              {newStatus === 'rejected' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Raison du refus (visible par le cabinet)</label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Profil trop junior pour le poste..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowStatusModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingStatus || !newStatus}
                  className={`px-4 py-2 rounded-lg disabled:opacity-50 text-sm flex items-center gap-2 text-white ${newStatus === 'rejected' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-600'}`}
                >
                  {savingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
