'use client';

import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/Header';
import {
  Banknote,
  CreditCard,
  HandCoins,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  EMPLOYEE_FINANCE_STATUS,
  MONTHS_FR,
  employeeFinanceApi,
  formatMoney,
  type EmployeeFinanceRequest,
  type EmployeeFinanceRequestType,
} from '@/lib/employeeFinanceApi';
import CustomSelect from '@/components/CustomSelect';

function StatusBadge({ status }: { status: EmployeeFinanceRequest['status'] }) {
  const cfg = EMPLOYEE_FINANCE_STATUS[status] ?? EMPLOYEE_FINANCE_STATUS.pending_hr;
  return <span className={`rounded px-2 py-1 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function RequestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const now = new Date();
  const [type, setType] = useState<EmployeeFinanceRequestType>('advance');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [installments, setInstallments] = useState('3');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await employeeFinanceApi.createMyRequest({
        request_type: type,
        amount_requested: Number(amount),
        reason: reason || undefined,
        first_payroll_year: year,
        first_payroll_month: month,
        installments_count: type === 'loan' ? Number(installments) : undefined,
      });
      toast.success('Demande envoyée');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-lg font-semibold text-gray-900">Nouvelle demande</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('advance')}
              className={`rounded border p-3 text-sm font-medium ${type === 'advance' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}
            >
              <HandCoins className="mx-auto mb-1 h-5 w-5" />
              Avance
            </button>
            <button
              type="button"
              onClick={() => setType('loan')}
              className={`rounded border p-3 text-sm font-medium ${type === 'loan' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}
            >
              <CreditCard className="mx-auto mb-1 h-5 w-5" />
              Prêt
            </button>
          </div>
          <label className="block text-sm text-gray-700">
            Montant demandé
            <input
              type="number"
              min={1}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block text-sm text-gray-700">
            Motif
            <textarea
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm text-gray-700">
              Année retenue
              <input
                type="number"
                min={2020}
                max={2099}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
            <label className="block text-sm text-gray-700">
              Mois retenue
              <CustomSelect
                className="mt-1 w-full"
                value={String(month)}
                onChange={(v) => setMonth(Number(v))}
                options={MONTHS_FR.map((label, index) => ({ value: String(index + 1), label }))}
              />
            </label>
            {type === 'loan' && (
              <label className="block text-sm text-gray-700">
                Mensualités
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                />
              </label>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Envoyer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MyEmployeeFinancePage() {
  const [requests, setRequests] = useState<EmployeeFinanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRequests(await employeeFinanceApi.listMyRequests());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Header title="Mes avances & prêts" subtitle="Demandes personnelles et suivi des remboursements" />
      <main className="bg-gray-50 p-6">
        <div className="mb-5 flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Nouvelle demande
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement...
          </div>
        ) : (
          <div className="grid gap-4">
            {loadError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {loadError}
              </div>
            )}
            {requests.map((request) => (
              <article key={request.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded bg-primary-50 p-2 text-primary-600">
                      {request.request_type === 'advance' ? <HandCoins className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">{request.request_type === 'advance' ? 'Avance sur salaire' : 'Prêt employé'}</h2>
                      <p className="mt-1 text-sm text-gray-500">{request.reason || 'Aucun motif renseigné'}</p>
                    </div>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">Montant demandé</p>
                    <p className="font-medium text-gray-900">{formatMoney(request.amount_requested, request.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Montant approuvé</p>
                    <p className="font-medium text-gray-900">{formatMoney(request.amount_approved, request.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Première retenue</p>
                    <p className="font-medium text-gray-900">{MONTHS_FR[request.first_payroll_month - 1]} {request.first_payroll_year}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Solde restant</p>
                    <p className="font-medium text-gray-900">{formatMoney(request.remaining_amount, request.currency)}</p>
                  </div>
                </div>
              </article>
            ))}
            {requests.length === 0 && (
              <div className="rounded-lg border border-gray-200 bg-white py-16 text-center text-gray-400">
                Aucune demande pour le moment
              </div>
            )}
          </div>
        )}
      </main>
      {showModal && <RequestModal onClose={() => setShowModal(false)} onCreated={load} />}
    </div>
  );
}
