'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Receipt, Search, CheckCircle2, XCircle, Clock, ChevronLeft,
  RefreshCw, Plus, CreditCard, Building2, FileText, AlertTriangle,
  X, ChevronDown,
} from 'lucide-react';
import {
  getAllTenants, adminGetInvoices, adminCreateInvoice, adminPayInvoice,
  adminCancelInvoice, adminChangePlan,
  type TenantListItem, type InvoiceItem,
} from '@/lib/api';
import CustomSelect from '@/components/CustomSelect';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtAmount = (amount: number, currency = 'XOF') =>
  `${new Intl.NumberFormat('fr-FR').format(amount)} ${currency}`;

function StatusBadge({ status }: { status: InvoiceItem['status'] }) {
  if (status === 'paid') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <CheckCircle2 size={11} /> Payée
    </span>
  );
  if (status === 'cancelled') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      <XCircle size={11} /> Annulée
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
      <Clock size={11} /> En attente
    </span>
  );
}

const PLANS = [
  { value: 'basique', label: 'Basique', employees: 25 },
  { value: 'professional', label: 'Professionnel', employees: 50 },
  { value: 'enterprise', label: 'Entreprise', employees: 100 },
];

// ─── Composant principal ───────────────────────────────────────────────────────
export default function BillingAdminPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');

  // Tenant sélectionné
  const [selectedTenant, setSelectedTenant] = useState<TenantListItem | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Modal créer facture
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ amount: '', currency: 'XOF', description: '', due_date: '', pdf_url: '' });
  const [creating, setCreating] = useState(false);

  // Modal payer
  const [payingInvoice, setPayingInvoice] = useState<InvoiceItem | null>(null);
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  // Modal annuler
  const [cancellingInvoice, setCancellingInvoice] = useState<InvoiceItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Modal changer plan
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [planForm, setPlanForm] = useState({ plan: '', max_employees: '', is_trial: false, trial_ends_at: '', note: '' });
  const [changingPlan, setChangingPlan] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) { router.push('/'); return; }
    const user = JSON.parse(userStr);
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    loadTenants();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTenants = useCallback(async () => {
    setTenantsLoading(true);
    try {
      const data = await getAllTenants({ page: 1, page_size: 200 });
      setTenants(data.items);
    } catch {
      toast.error('Erreur chargement des entreprises');
    } finally {
      setTenantsLoading(false);
    }
  }, []);

  const selectTenant = async (tenant: TenantListItem) => {
    setSelectedTenant(tenant);
    setPlanForm({
      plan: tenant.plan,
      max_employees: String(tenant.max_employees),
      is_trial: tenant.is_trial,
      trial_ends_at: tenant.trial_ends_at ? tenant.trial_ends_at.split('T')[0] : '',
      note: '',
    });
    setInvoicesLoading(true);
    try {
      const data = await adminGetInvoices(tenant.id);
      setInvoices(data);
    } catch {
      toast.error('Erreur chargement des factures');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const refreshInvoices = async () => {
    if (!selectedTenant) return;
    setInvoicesLoading(true);
    try {
      setInvoices(await adminGetInvoices(selectedTenant.id));
    } catch { toast.error('Erreur'); } finally { setInvoicesLoading(false); }
  };

  // ── Créer facture ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!selectedTenant) return;
    const amount = parseFloat(createForm.amount);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide'); return; }
    setCreating(true);
    try {
      await adminCreateInvoice(selectedTenant.id, {
        amount,
        currency: createForm.currency,
        description: createForm.description || undefined,
        due_date: createForm.due_date || undefined,
        pdf_url: createForm.pdf_url || undefined,
      });
      toast.success('Facture créée ✔');
      setShowCreate(false);
      setCreateForm({ amount: '', currency: 'XOF', description: '', due_date: '', pdf_url: '' });
      refreshInvoices();
    } catch (e: any) {
      toast.error(e.message || 'Erreur création');
    } finally {
      setCreating(false);
    }
  };

  // ── Payer ────────────────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!payingInvoice) return;
    setPaying(true);
    try {
      await adminPayInvoice(payingInvoice.id, payRef.trim() || undefined);
      toast.success('Facture marquée payée ✔');
      setPayingInvoice(null);
      setPayRef('');
      refreshInvoices();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setPaying(false);
    }
  };

  // ── Annuler ───────────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancellingInvoice) return;
    setCancelling(true);
    try {
      await adminCancelInvoice(cancellingInvoice.id);
      toast.success('Facture annulée');
      setCancellingInvoice(null);
      refreshInvoices();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setCancelling(false);
    }
  };

  // ── Changer plan ─────────────────────────────────────────────────────────────
  const handleChangePlan = async () => {
    if (!selectedTenant) return;
    setChangingPlan(true);
    try {
      await adminChangePlan(selectedTenant.id, {
        plan: planForm.plan,
        max_employees: planForm.max_employees ? parseInt(planForm.max_employees) : undefined,
        is_trial: planForm.is_trial,
        trial_ends_at: planForm.trial_ends_at || undefined,
        note: planForm.note || undefined,
      });
      toast.success(`Plan mis à jour → ${planForm.plan} ✔`);
      setShowChangePlan(false);
      // Rafraîchir la liste tenants
      const updated = await getAllTenants({ page: 1, page_size: 200 });
      setTenants(updated.items);
      const updatedTenant = updated.items.find(t => t.id === selectedTenant.id);
      if (updatedTenant) setSelectedTenant(updatedTenant);
    } catch (e: any) {
      toast.error(e.message || 'Erreur changement plan');
    } finally {
      setChangingPlan(false);
    }
  };

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    t.email?.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/platform-admin" className="text-gray-500 hover:text-gray-800 transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Receipt size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Facturation</h1>
              <p className="text-sm text-gray-500">Gérez les factures et plans de chaque entreprise</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* ── Liste des tenants (colonne gauche) ─────────────────────────── */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={tenantSearch}
                onChange={e => setTenantSearch(e.target.value)}
                placeholder="Rechercher une entreprise..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tenantsLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : filteredTenants.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">Aucune entreprise</p>
            ) : (
              filteredTenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTenant(t)}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition-colors hover:bg-indigo-50 ${
                    selectedTenant?.id === t.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-900 truncate">{t.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      t.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                      t.plan === 'professional' ? 'bg-blue-100 text-blue-700' :
                      t.plan === 'starter' ? 'bg-teal-100 text-teal-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {t.plan}
                    </span>
                    {t.is_trial && <span className="text-orange-500">Trial</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Détail facturation (zone principale) ───────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedTenant ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Building2 size={48} className="mb-4 opacity-20" />
              <p className="text-base">Sélectionnez une entreprise</p>
              <p className="text-sm mt-1">pour gérer ses factures et son plan</p>
            </div>
          ) : (
            <div className="max-w-4xl">
              {/* En-tête tenant */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedTenant.name}</h2>
                    <p className="text-sm text-gray-400">{selectedTenant.email || '—'} · {selectedTenant.slug}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        selectedTenant.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                        selectedTenant.plan === 'professional' ? 'bg-blue-100 text-blue-700' :
                        selectedTenant.plan === 'starter' ? 'bg-teal-100 text-teal-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        Plan : {selectedTenant.plan}
                      </span>
                      {selectedTenant.is_trial && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                          Trial — {selectedTenant.trial_days_remaining ?? 0}j restants
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {selectedTenant.employees_count} / {selectedTenant.max_employees} employés
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowChangePlan(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-colors"
                  >
                    <CreditCard size={15} />
                    Changer le plan
                  </button>
                </div>
              </div>

              {/* Stats rapides */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">Total factures</p>
                  <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">En attente</p>
                  <p className="text-2xl font-bold text-orange-600">{fmtAmount(totalPending)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">Encaissé</p>
                  <p className="text-2xl font-bold text-green-600">{fmtAmount(totalPaid)}</p>
                </div>
              </div>

              {/* Tableau factures */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-gray-400" />
                    <h3 className="font-semibold text-gray-800">Factures</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={refreshInvoices}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      <Plus size={14} /> Nouvelle facture
                    </button>
                  </div>
                </div>

                {invoicesLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-600 border-t-transparent" />
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Receipt size={40} className="mb-3 opacity-20" />
                    <p className="text-sm">Aucune facture pour ce tenant</p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="mt-3 text-xs text-indigo-600 hover:underline"
                    >
                      Créer la première facture
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <th className="px-5 py-3 text-left font-semibold">Date</th>
                          <th className="px-4 py-3 text-left font-semibold">Description</th>
                          <th className="px-4 py-3 text-right font-semibold">Montant</th>
                          <th className="px-4 py-3 text-left font-semibold">Statut</th>
                          <th className="px-4 py-3 text-left font-semibold">Réf. paiement</th>
                          <th className="px-4 py-3 text-left font-semibold">Échéance</th>
                          <th className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {invoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-gray-50/60">
                            <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{fmt(inv.invoice_date)}</td>
                            <td className="px-4 py-3.5 text-gray-700">
                              <div className="truncate max-w-[200px]">{inv.description || '—'}</div>
                              {inv.pdf_url && (
                                <a href={inv.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline">
                                  📎 PDF
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                              {fmtAmount(inv.amount, inv.currency)}
                            </td>
                            <td className="px-4 py-3.5"><StatusBadge status={inv.status} /></td>
                            <td className="px-4 py-3.5 text-gray-500 text-xs">{inv.payment_ref || '—'}</td>
                            <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{fmt(inv.due_date)}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-2">
                                {inv.status === 'pending' && (
                                  <button
                                    onClick={() => { setPayingInvoice(inv); setPayRef(''); }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                  >
                                    <CheckCircle2 size={12} /> Payer
                                  </button>
                                )}
                                {inv.status === 'pending' && (
                                  <button
                                    onClick={() => setCancellingInvoice(inv)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                  >
                                    <XCircle size={12} /> Annuler
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal : Créer facture ──────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Plus size={18} className="text-indigo-600" /> Nouvelle facture
              </h2>
              <button onClick={() => setShowCreate(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500">Pour : <strong>{selectedTenant?.name}</strong></p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Montant <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={createForm.amount}
                  onChange={e => setCreateForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="297000"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Devise</label>
                <CustomSelect
                  value={createForm.currency}
                  onChange={(v) => setCreateForm(f => ({ ...f, currency: v }))}
                  options={[
                    { value: 'XOF', label: 'XOF' },
                    { value: 'EUR', label: 'EUR' },
                    { value: 'USD', label: 'USD' },
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Frais d'installation, abonnement annuel..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date d'échéance</label>
                <input
                  type="date"
                  value={createForm.due_date}
                  onChange={e => setCreateForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">URL PDF</label>
                <input
                  value={createForm.pdf_url}
                  onChange={e => setCreateForm(f => ({ ...f, pdf_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!createForm.amount || creating}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={15} />}
                Créer la facture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Marquer payée ──────────────────────────────────────────── */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-xl"><CheckCircle2 size={20} className="text-green-600" /></div>
              <h2 className="text-lg font-bold text-gray-900">Confirmer le paiement</h2>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Montant</span>
                <span className="font-semibold">{fmtAmount(payingInvoice.amount, payingInvoice.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Description</span>
                <span className="text-gray-700">{payingInvoice.description || '—'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Référence paiement <span className="text-gray-400">(optionnel)</span></label>
              <input
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                placeholder="Ex: VIR-2026-0042, WAVE-123..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayingInvoice(null)} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button
                onClick={handlePay}
                disabled={paying}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {paying ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={15} />}
                Confirmer payée
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Annuler facture ────────────────────────────────────────── */}
      {cancellingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-xl"><AlertTriangle size={20} className="text-red-600" /></div>
              <h2 className="text-lg font-bold text-gray-900">Annuler la facture ?</h2>
            </div>
            <p className="text-sm text-gray-600">
              La facture de <strong>{fmtAmount(cancellingInvoice.amount, cancellingInvoice.currency)}</strong> sera marquée comme annulée. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancellingInvoice(null)} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                Retour
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {cancelling ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <XCircle size={15} />}
                Annuler la facture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Changer plan ───────────────────────────────────────────── */}
      {showChangePlan && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CreditCard size={18} className="text-indigo-600" /> Changer le plan
              </h2>
              <button onClick={() => setShowChangePlan(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500">Entreprise : <strong>{selectedTenant.name}</strong></p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Plan <span className="text-red-500">*</span></label>
                <CustomSelect
                  value={planForm.plan}
                  onChange={(v) => {
                    const selected = PLANS.find(p => p.value === v);
                    setPlanForm(f => ({ ...f, plan: v, max_employees: selected ? String(selected.employees) : f.max_employees }));
                  }}
                  options={PLANS.map(p => ({ value: p.value, label: `${p.label} — ${p.employees} employés` }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nb max employés</label>
                <input
                  type="number"
                  readOnly
                  value={planForm.max_employees}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fin du trial</label>
                <input
                  type="date"
                  value={planForm.trial_ends_at}
                  onChange={e => setPlanForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="is_trial"
                  checked={planForm.is_trial}
                  onChange={e => setPlanForm(f => ({ ...f, is_trial: e.target.checked }))}
                  className="h-4 w-4 accent-indigo-600"
                />
                <label htmlFor="is_trial" className="text-sm text-gray-700">En période de trial</label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Note interne <span className="text-gray-400">(optionnel)</span></label>
              <input
                value={planForm.note}
                onChange={e => setPlanForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Ex: Paiement annuel reçu par virement le 16/03/2026"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowChangePlan(false)} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button
                onClick={handleChangePlan}
                disabled={!planForm.plan || changingPlan}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {changingPlan ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CreditCard size={15} />}
                Appliquer le plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
