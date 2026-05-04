'use client';

import { useState, useEffect } from 'react';
import { Lock, Loader2, CheckCircle2, Clock, XCircle, Mail, Sparkles, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPayrollModuleInfo,
  requestPayrollModule,
  type AddonModuleStatus,
  type PayrollModuleInfo,
} from '@/lib/payrollApi';

interface AddonGateProps {
  /** "payroll" ou "budget_rh" */
  module: 'payroll' | 'budget_rh';
  /** Contenu à afficher si le module est actif */
  children: React.ReactNode;
}

const MODULE_CONFIG = {
  payroll: {
    title: 'Module Paie',
    subtitle: 'Gestion de la paie & bulletins de salaire',
    description:
      'Calculez automatiquement les salaires, gérez les rubriques (IPRES, IR, CNSS…), générez les bulletins et exportez vers la comptabilité.',
    features: [
      'Calcul automatique IPRES, IR, CSS et charges patronales',
      'Génération de bulletins de paie conformes',
      'Livre de paie et résumé des cotisations',
      'Export comptable et multi-devises',
    ],
    icon: '💰',
  },
  budget_rh: {
    title: 'Budget RH',
    subtitle: 'Planification et suivi budgétaire des ressources humaines',
    description:
      'Planifiez votre masse salariale, suivez les réalisés vs budgets et analysez l\'évolution des coûts RH par département.',
    features: [
      'Budget mensuel par catégorie NRG',
      'Suivi réalisé vs budget en temps réel',
      'Vue par département et par employé',
      'Import / export Excel',
    ],
    icon: '📊',
  },
} as const;

export default function AddonGate({ module, children }: AddonGateProps) {
  const [info, setInfo] = useState<PayrollModuleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const cfg = MODULE_CONFIG[module];

  useEffect(() => {
    getPayrollModuleInfo()
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  // Module actif → afficher le vrai contenu
  if (!info || info.module_status === 'active') {
    return <>{children}</>;
  }

  const status: AddonModuleStatus = info.module_status;

  async function handleRequest() {
    setRequesting(true);
    try {
      await requestPayrollModule({ message });
      toast.success('Demande envoyée ! Notre équipe vous contactera sous 24h.');
      setShowForm(false);
      setMessage('');
      // Rafraîchir le statut
      const updated = await getPayrollModuleInfo();
      setInfo(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la demande';
      if (msg.includes('déjà')) {
        toast.error('Une demande est déjà en cours de traitement.');
      } else {
        toast.error(msg);
      }
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Carte principale */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

          {/* Bannière top */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white text-center">
            <div className="text-5xl mb-3">{cfg.icon}</div>
            <h1 className="text-2xl font-bold">{cfg.title}</h1>
            <p className="text-indigo-100 text-sm mt-1">{cfg.subtitle}</p>
          </div>

          {/* Corps */}
          <div className="p-6">
            {/* Statut */}
            <StatusBadge status={status} />

            {/* Description */}
            <p className="text-gray-600 text-sm mt-4 leading-relaxed">{cfg.description}</p>

            {/* Fonctionnalités */}
            <ul className="mt-4 space-y-2">
              {cfg.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <ChevronRight size={14} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {/* Tarif estimé */}
            {info.estimated_monthly_cost != null && info.estimated_monthly_cost > 0 && (
              <div className="mt-5 bg-indigo-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-indigo-700 font-medium">Estimation mensuelle</span>
                <span className="text-indigo-900 font-bold">
                  {new Intl.NumberFormat('fr-SN', {
                    style: 'currency',
                    currency: info.pricing.currency ?? 'XOF',
                    maximumFractionDigits: 0,
                  }).format(info.estimated_monthly_cost)}
                </span>
              </div>
            )}

            {/* CTA */}
            <div className="mt-6">
              {status === 'not_requested' && !showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  <Sparkles size={16} />
                  Demander l'activation
                </button>
              )}

              {status === 'not_requested' && showForm && (
                <div className="space-y-3">
                  <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    rows={3}
                    placeholder="Message optionnel (nombre d'employés, pays, besoin spécifique…)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowForm(false)}
                      className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleRequest}
                      disabled={requesting}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      {requesting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                      {requesting ? 'Envoi…' : 'Envoyer la demande'}
                    </button>
                  </div>
                </div>
              )}

              {status === 'pending' && (
                <p className="text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-3 px-4">
                  Votre demande est en cours de traitement. Notre équipe vous contactera très prochainement.
                </p>
              )}

              {status === 'rejected' && (
                <div className="space-y-3">
                  <p className="text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl py-3 px-4">
                    Votre demande précédente a été refusée. Vous pouvez soumettre une nouvelle demande.
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    <Sparkles size={16} />
                    Nouvelle demande
                  </button>
                </div>
              )}

              {status === 'suspended' && (
                <p className="text-center text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl py-3 px-4">
                  Votre accès au module est temporairement suspendu. Contactez{' '}
                  <a href="mailto:support@targetym.com" className="text-indigo-600 underline">
                    support@targetym.com
                  </a>
                  .
                </p>
              )}
            </div>

            {/* Contact footer */}
            <p className="text-center text-xs text-gray-400 mt-4">
              Questions ? Écrivez-nous à{' '}
              <a href="mailto:support@targetym.com" className="text-indigo-500 hover:underline">
                support@targetym.com
              </a>
            </p>
          </div>
        </div>

        {/* Lock icon discret */}
        <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
          <Lock size={11} />
          Module disponible en option payante
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AddonModuleStatus }) {
  const map: Record<AddonModuleStatus, { icon: React.ReactNode; label: string; cls: string }> = {
    not_requested: {
      icon: <Lock size={13} />,
      label: 'Non souscrit',
      cls: 'bg-gray-100 text-gray-600',
    },
    pending: {
      icon: <Clock size={13} />,
      label: 'Demande en cours',
      cls: 'bg-amber-100 text-amber-700',
    },
    active: {
      icon: <CheckCircle2 size={13} />,
      label: 'Actif',
      cls: 'bg-green-100 text-green-700',
    },
    rejected: {
      icon: <XCircle size={13} />,
      label: 'Demande refusée',
      cls: 'bg-red-100 text-red-700',
    },
    suspended: {
      icon: <XCircle size={13} />,
      label: 'Suspendu',
      cls: 'bg-orange-100 text-orange-700',
    },
  };

  const { icon, label, cls } = map[status] ?? map.not_requested;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>
      {icon}
      {label}
    </span>
  );
}
