'use client';
import { useState, useEffect } from 'react';
import {
  Loader2, Plus, X, Building2, Globe, Phone, Mail,
  ChevronRight, Pencil, ToggleLeft, ToggleRight, Briefcase,
} from 'lucide-react';
import {
  getAgencies, createAgency, updateAgency,
  getAllMissions,
  type Agency, type AgencyMission,
} from '@/lib/api';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:              { label: 'En attente',        cls: 'bg-yellow-100 text-yellow-700' },
  in_progress:          { label: 'En cours',          cls: 'bg-blue-100 text-blue-700' },
  candidates_submitted: { label: 'Candidats soumis',  cls: 'bg-primary-100 text-primary-700' },
  completed:            { label: 'Terminée',          cls: 'bg-green-100 text-green-700' },
  cancelled:            { label: 'Annulée',           cls: 'bg-gray-100 text-gray-500' },
};

const EMPTY_FORM = { name: '', email: '', contact_name: '', phone: '', website_url: '' };

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function AgencyFormModal({
  open, onClose, onSaved, editAgency,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editAgency: Agency | null;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(editAgency ? {
        name: editAgency.name,
        email: editAgency.email,
        contact_name: editAgency.contact_name ?? '',
        phone: editAgency.phone ?? '',
        website_url: editAgency.website_url ?? '',
      } : EMPTY_FORM);
    }
  }, [open, editAgency]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (editAgency) {
        await updateAgency(editAgency.id, fd);
        toast.success('Cabinet mis à jour');
      } else {
        await createAgency(fd);
        toast.success('Cabinet créé — credentials envoyés par email');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  const isEdit = !!editAgency;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isEdit ? 'Modifier le cabinet' : 'Nouveau cabinet'}
              </h2>
              <p className="text-xs text-gray-400">
                {isEdit ? editAgency.name : 'Les credentials seront envoyés par email'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du cabinet *</label>
            <input
              type="text" required
              placeholder="Ex : RH Partners Dakar"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-all"
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email {isEdit ? '' : 'de connexion *'}
            </label>
            <input
              type="email" required={!isEdit}
              placeholder="contact@cabinet.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-all"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact principal</label>
            <input
              type="text"
              placeholder="Nom et prénom"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-all"
              value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
              <input
                type="tel" placeholder="+221 77 000 00 00"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-all"
                value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Site web</label>
              <input
                type="url" placeholder="https://"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition-all"
                value={form.website_url} onChange={e => setForm(p => ({ ...p, website_url: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit" disabled={saving}
              className="px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer le cabinet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CabinetsPage() {
  const [agencies, setAgencies]     = useState<Agency[]>([]);
  const [missions, setMissions]     = useState<AgencyMission[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<'agencies' | 'missions'>('agencies');
  const [showModal, setShowModal]   = useState(false);
  const [editAgency, setEditAgency] = useState<Agency | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [a, m] = await Promise.all([getAgencies(), getAllMissions()]);
      setAgencies(a);
      setMissions(m);
    } catch (e: any) {
      toast.error(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(agency: Agency) {
    try {
      const fd = new FormData();
      fd.append('is_active', String(!agency.is_active));
      await updateAgency(agency.id, fd);
      toast.success(agency.is_active ? 'Cabinet désactivé' : 'Cabinet activé');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  }

  function openCreate() { setEditAgency(null); setShowModal(true); }
  function openEdit(agency: Agency) { setEditAgency(agency); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditAgency(null); }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="mb-1">
            <a href="/dashboard/recruitment" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              ← Recrutement
            </a>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Cabinets de recrutement</h1>
          <p className="text-gray-400 text-sm mt-1">Gérez vos cabinets partenaires et suivez les missions en cours</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 text-sm font-medium shadow-sm transition-colors"
          onClick={openCreate}
        >
          <Plus className="w-4 h-4" /> Nouveau cabinet
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('agencies')}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'agencies'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Cabinets <span className="ml-1.5 text-xs bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full">{agencies.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('missions')}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'missions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Missions <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{missions.length}</span>
        </button>
      </div>

      {/* TAB Cabinets */}
      {activeTab === 'agencies' && (
        <>
          {agencies.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 border-dashed">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-primary-300" />
              </div>
              <h3 className="text-gray-600 font-semibold mb-1">Aucun cabinet partenaire</h3>
              <p className="text-gray-400 text-sm mb-4">Commencez par ajouter un cabinet de recrutement</p>
              <button
                className="px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 text-sm font-medium"
                onClick={openCreate}
              >
                Ajouter un cabinet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {agencies.map(agency => {
                const missions_count = (agency as any).active_missions ?? 0;
                return (
                  <div
                    key={agency.id}
                    className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all group ${
                      !agency.is_active ? 'opacity-60 border-gray-100' : 'border-gray-100 shadow-sm'
                    }`}
                  >
                    {/* Card top strip */}
                    <div className="h-2 bg-gradient-to-r from-primary-400 to-primary-600" />

                    <div className="p-5">
                      {/* Avatar + name + badge */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-white font-bold text-sm">{getInitials(agency.name)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-gray-900 truncate">{agency.name}</h3>
                            <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              agency.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                agency.is_active ? 'bg-emerald-500' : 'bg-gray-400'
                              }`} />
                              {agency.is_active ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                          {agency.contact_name && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{agency.contact_name}</p>
                          )}
                        </div>
                      </div>

                      {/* Contact infos */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <span className="truncate text-xs">{agency.email}</span>
                        </div>
                        {agency.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                            <span className="text-xs">{agency.phone}</span>
                          </div>
                        )}
                        {agency.website_url && (
                          <a
                            href={agency.website_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                          >
                            <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Globe className="w-3.5 h-3.5 text-primary-500" />
                            </div>
                            <span className="text-xs truncate hover:underline">Site web</span>
                          </a>
                        )}
                      </div>

                      {/* Missions counter */}
                      <div className="flex items-center gap-2 py-3 px-3 bg-gray-50 rounded-xl mb-4">
                        <Briefcase className="w-4 h-4 text-primary-400" />
                        <span className="text-xs text-gray-600">
                          <span className="font-semibold text-gray-900">{missions_count}</span> mission{missions_count !== 1 ? 's' : ''} active{missions_count !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <a
                          href={`/dashboard/recruitment/cabinets/${agency.id}`}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-500 text-white rounded-xl text-xs font-medium hover:bg-primary-600 transition-colors"
                        >
                          Voir le détail <ChevronRight className="w-3.5 h-3.5" />
                        </a>
                        <button
                          title="Modifier"
                          onClick={() => openEdit(agency)}
                          className="w-9 h-9 flex items-center justify-center border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 hover:text-primary-600 hover:border-primary-200 transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title={agency.is_active ? 'Désactiver' : 'Activer'}
                          onClick={() => handleToggleActive(agency)}
                          className={`w-9 h-9 flex items-center justify-center border rounded-xl transition-all ${
                            agency.is_active
                              ? 'border-red-200 text-red-400 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-500 hover:bg-emerald-50'
                          }`}
                        >
                          {agency.is_active
                            ? <ToggleRight className="w-4 h-4" />
                            : <ToggleLeft className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB Missions */}
      {activeTab === 'missions' && (
        <>
          {missions.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">Aucune mission en cours</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {missions.map(m => {
                const st = STATUS_CONFIG[m.status] ?? { label: m.status, cls: 'bg-gray-100 text-gray-500' };
                const submitted = (m as any).nb_candidates_submitted ?? 0;
                const total = m.nb_profiles_requested;
                const progress = total > 0 ? Math.min(100, Math.round((submitted / total) * 100)) : 0;
                const initials = ((m as any).agency_name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <a
                    key={m.id}
                    href={`/dashboard/recruitment/cabinets/${(m as any).agency_id}`}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-primary-400 hover:shadow-md transition-all block overflow-hidden group"
                  >
                    <div className="h-1.5 bg-gradient-to-r from-primary-400 to-primary-600" />
                    <div className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-xs">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-900 truncate">{m.job_title ?? `Mission #${m.id}`}</div>
                          <div className="text-xs text-gray-400 truncate">{(m as any).agency_name ?? '—'}</div>
                        </div>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Profils soumis</span>
                          <span className="font-medium">{submitted} / {total}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-primary-400 to-primary-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        {m.deadline
                          ? <span>Deadline : {new Date(m.deadline).toLocaleDateString('fr-FR')}</span>
                          : <span />
                        }
                        <span className="text-primary-600 font-medium group-hover:underline">Voir →</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MODAL Création / Édition cabinet */}
      <AgencyFormModal
        open={showModal}
        onClose={closeModal}
        onSaved={loadData}
        editAgency={editAgency}
      />
    </div>
  );
}
