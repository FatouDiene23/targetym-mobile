'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  getCabinetMission, updateMissionUrl, submitCabinetCandidate, deleteCabinetCandidate,
  type AgencyMission, type AgencyCandidate, API_URL,
} from '@/lib/api';
import Header from '@/components/Header';
import { Loader2, Plus, X, ChevronLeft, ExternalLink, Link2, Pencil, Trash2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const PIPELINE_STEPS = [
  { key: 'submitted',   label: 'Soumis',     headerCls: 'bg-gray-200 text-gray-700',        countCls: 'bg-gray-300 text-gray-700',      colCls: 'bg-gray-50',          cardBorder: 'border-gray-200' },
  { key: 'ai_scored',   label: 'Scoré IA',   headerCls: 'bg-blue-100 text-blue-700',        countCls: 'bg-blue-200 text-blue-800',      colCls: 'bg-blue-50/50',       cardBorder: 'border-blue-100' },
  { key: 'shortlisted', label: 'Shortlisté', headerCls: 'bg-primary-100 text-primary-700',  countCls: 'bg-primary-200 text-primary-800', colCls: 'bg-primary-50/50',   cardBorder: 'border-primary-100' },
  { key: 'interview',   label: 'Entretien',  headerCls: 'bg-yellow-100 text-yellow-700',    countCls: 'bg-yellow-200 text-yellow-800',  colCls: 'bg-yellow-50/50',     cardBorder: 'border-yellow-100' },
  { key: 'accepted',    label: 'Accepté',    headerCls: 'bg-green-100 text-green-700',      countCls: 'bg-green-200 text-green-800',    colCls: 'bg-green-50/50',      cardBorder: 'border-green-100' },
  { key: 'rejected',    label: 'Refusé',     headerCls: 'bg-red-100 text-red-600',          countCls: 'bg-red-200 text-red-700',        colCls: 'bg-red-50/50',        cardBorder: 'border-red-100' },
];

export default function CabinetMissionDetailPage() {
  const params = useParams();
  const missionId = Number(params.id);

  const [mission, setMission] = useState<AgencyMission & { candidates: AgencyCandidate[]; pipeline_steps: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // URL annonce
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  // Ajouter candidat
  const [showAddModal, setShowAddModal] = useState(false);
  const [candidateForm, setCandidateForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    current_position: '', experience_years: '', agency_notes: '',
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadMission(); }, [missionId]);

  async function loadMission() {
    setLoading(true);
    try {
      const data = await getCabinetMission(missionId);
      setMission(data as any);
      setUrlValue(data.agency_job_url ?? '');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveUrl(e: React.FormEvent) {
    e.preventDefault();
    setSavingUrl(true);
    try {
      await updateMissionUrl(missionId, urlValue);
      toast.success('URL enregistrée');
      setEditingUrl(false);
      loadMission();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSavingUrl(false);
    }
  }

  async function handleSubmitCandidate(e: React.FormEvent) {
    e.preventDefault();
    setSavingCandidate(true);
    try {
      const fd = new FormData();
      fd.append('first_name', candidateForm.first_name);
      fd.append('last_name', candidateForm.last_name);
      if (candidateForm.email) fd.append('email', candidateForm.email);
      if (candidateForm.phone) fd.append('phone', candidateForm.phone);
      if (candidateForm.current_position) fd.append('current_position', candidateForm.current_position);
      if (candidateForm.experience_years) fd.append('experience_years', candidateForm.experience_years);
      if (candidateForm.agency_notes) fd.append('agency_notes', candidateForm.agency_notes);
      if (cvFile) fd.append('cv', cvFile);
      await submitCabinetCandidate(missionId, fd);
      toast.success('Candidat soumis');
      setShowAddModal(false);
      setCandidateForm({ first_name: '', last_name: '', email: '', phone: '', current_position: '', experience_years: '', agency_notes: '' });
      setCvFile(null);
      loadMission();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSavingCandidate(false);
    }
  }

  async function handleDeleteCandidate(c: AgencyCandidate) {
    if (!confirm(`Retirer ${c.first_name} ${c.last_name} ?`)) return;
    try {
      await deleteCabinetCandidate(missionId, c.id);
      toast.success('Candidat retiré');
      loadMission();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  if (!mission) return <div className="p-6 text-red-600 font-medium">Mission non trouvée</div>;

  const canAddCandidates = !['completed', 'cancelled'].includes(mission.status);

  // Grouper les candidats par statut pour le pipeline
  const byStatus: Record<string, AgencyCandidate[]> = {};
  PIPELINE_STEPS.forEach(s => { byStatus[s.key] = []; });
  (mission.candidates ?? []).forEach(c => {
    if (byStatus[c.status]) byStatus[c.status].push(c);
    else byStatus['submitted'].push(c);
  });

  const jobTitle = mission.job?.title ?? `Mission #${mission.id}`;
  const jobSubtitle = [mission.job?.location, mission.job?.contract_type, mission.deadline ? `Deadline : ${new Date(mission.deadline).toLocaleDateString('fr-FR')}` : null].filter(Boolean).join(' · ');

  return (
    <div className="max-w-[1400px] mx-auto">
      <Header title={jobTitle} subtitle={jobSubtitle} />

      <div className="p-6 space-y-6">
        {/* Back + actions */}
        <div className="flex items-center justify-between">
          <a href="/dashboard/cabinet/missions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Retour aux missions
          </a>
          {canAddCandidates && (
            <button
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 shadow-sm transition-colors"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4" /> Soumettre un candidat
            </button>
          )}
        </div>

        {/* Brief + URL annonce */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mission.brief && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-primary-500" />
                </div>
                <h3 className="font-semibold text-sm text-gray-900">Brief de la mission</h3>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{mission.brief}</p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center">
                <Link2 className="w-3.5 h-3.5 text-primary-500" />
              </div>
              <h3 className="font-semibold text-sm text-gray-900">Votre annonce publiée</h3>
            </div>
            {editingUrl ? (
              <form onSubmit={handleSaveUrl} className="flex gap-2">
                <input
                  type="url"
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="https://..."
                  value={urlValue}
                  onChange={e => setUrlValue(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  disabled={savingUrl}
                  className="px-3 py-2 bg-primary-500 text-white text-sm rounded-xl hover:bg-primary-600 disabled:opacity-50 flex items-center gap-1"
                >
                  {savingUrl && <Loader2 className="w-3 h-3 animate-spin" />} Enregistrer
                </button>
                <button type="button" className="px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50" onClick={() => setEditingUrl(false)}>
                  Annuler
                </button>
              </form>
            ) : mission.agency_job_url ? (
              <div className="flex items-center gap-2">
                <a
                  href={mission.agency_job_url}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 hover:underline truncate"
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{mission.agency_job_url}</span>
                </a>
                <button
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600"
                  onClick={() => setEditingUrl(true)}
                  title="Modifier"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-3">Renseignez l'URL de votre annonce publiée</p>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 border-dashed text-gray-600 text-sm rounded-xl hover:border-primary-400 hover:text-primary-600 transition-colors"
                  onClick={() => setEditingUrl(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter l'URL
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Pipeline candidats
            <span className="ml-2 text-sm font-normal text-gray-400">
              {mission.candidates?.length ?? 0} / {mission.nb_profiles_requested} demandés
            </span>
          </h2>
        </div>

        {/* Kanban */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {PIPELINE_STEPS.map(step => {
              const cands = byStatus[step.key] ?? [];
              return (
                <div key={step.key} className="w-52 flex-shrink-0">
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${step.headerCls}`}>
                    <span className="font-semibold text-xs">{step.label}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${step.countCls}`}>{cands.length}</span>
                  </div>
                  {/* Cards */}
                  <div className={`rounded-xl p-2 space-y-2 min-h-[80px] ${step.colCls}`}>
                    {cands.map(c => (
                      <div key={c.id} className={`bg-white rounded-xl border ${step.cardBorder} p-3 shadow-sm`}>
                        <div className="font-semibold text-sm text-gray-900">{c.first_name} {c.last_name}</div>
                        {c.current_position && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate">{c.current_position}</div>
                        )}
                        {c.experience_years != null && (
                          <div className="text-xs text-gray-400">{c.experience_years} an{c.experience_years > 1 ? 's' : ''} exp.</div>
                        )}
                        {c.ai_score != null && (
                          <div className={`inline-flex items-center gap-1 mt-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                            c.ai_score >= 75 ? 'bg-green-100 text-green-700' : c.ai_score >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
                          }`}>
                            IA {c.ai_score}%
                          </div>
                        )}
                        {c.status === 'rejected' && c.rejection_reason && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                            <span className="font-semibold">Motif :</span> {c.rejection_reason}
                          </div>
                        )}
                        <div className="flex gap-1.5 mt-2">
                          {c.cv_url && (
                            <a
                              href={c.cv_url.startsWith('http') ? c.cv_url : `${API_URL}${c.cv_url}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors"
                            >
                              <FileText className="w-3 h-3" /> CV
                            </a>
                          )}
                          {c.status === 'submitted' && (
                            <button
                              className="flex-shrink-0 w-6 h-6 flex items-center justify-center border border-red-200 text-red-400 rounded-lg hover:bg-red-50 transition-colors"
                              onClick={() => handleDeleteCandidate(c)}
                              title="Retirer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {cands.length === 0 && (
                      <div className="text-center text-xs text-gray-300 py-6 border border-dashed border-gray-200 rounded-xl">
                        Aucun
                      </div>
                    )}
                  </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* MODAL Soumettre candidat */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900">Soumettre un candidat</h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitCandidate} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Prénom *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    required
                    value={candidateForm.first_name}
                    onChange={e => setCandidateForm(p => ({ ...p, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    required
                    value={candidateForm.last_name}
                    onChange={e => setCandidateForm(p => ({ ...p, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    value={candidateForm.email}
                    onChange={e => setCandidateForm(p => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    value={candidateForm.phone}
                    onChange={e => setCandidateForm(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Poste actuel</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    value={candidateForm.current_position}
                    onChange={e => setCandidateForm(p => ({ ...p, current_position: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Années d'expérience</label>
                  <input
                    type="number" min="0"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    value={candidateForm.experience_years}
                    onChange={e => setCandidateForm(p => ({ ...p, experience_years: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes sur le candidat</label>
                <textarea
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  rows={2}
                  placeholder="Points forts, contexte de recherche..."
                  value={candidateForm.agency_notes}
                  onChange={e => setCandidateForm(p => ({ ...p, agency_notes: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">CV (PDF, DOC, DOCX)</label>
                <input
                  ref={fileInputRef}
                  type="file" accept=".pdf,.doc,.docx"
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-xs file:text-gray-600 file:bg-gray-50 hover:file:bg-gray-100 file:cursor-pointer"
                  onChange={e => setCvFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50"
                  onClick={() => setShowAddModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingCandidate}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
                >
                  {savingCandidate && <Loader2 className="w-4 h-4 animate-spin" />}
                  Soumettre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
