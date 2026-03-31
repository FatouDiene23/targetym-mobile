'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  ClipboardList, ChevronDown, ChevronRight, Loader2, CheckCircle2,
  Receipt, Users, TrendingUp, TrendingDown, Wallet, X, Printer,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import Link from 'next/link';
import Header from '@/components/Header';
import { getEmployees, getEmployee, type Employee } from '@/lib/api';
import {
  getRun, getSlips, getSlip, simulateRun, validateRun,
  formatXOF, MONTHS_FR, RUN_STATUS, getPayrollBulletinHeader,
  type PayrollRun, type PaySlip, type PaySlipLine, type PayrollBulletinHeader,
  getEmployeePayrollProfile, type EmployeePayrollProfile,
} from '@/lib/payrollApi';

// ── Composants ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-xs text-gray-400 mb-0.5">{label}</div>
        <div className="text-xl font-bold text-gray-800">{value}</div>
      </div>
    </div>
  );
}

function SlipLinesModal({
  slip,
  empName,
  run,
  onClose,
}: {
  slip: PaySlip;
  empName: string;
  run: PayrollRun;
  onClose: () => void;
}) {
  const gains = slip.lines.filter(l => l.component_type === 'earning');
  const deductions = slip.lines.filter(l => l.component_type === 'deduction');
  const patronal = slip.lines.filter(l => l.component_type === 'employer_contribution');

  const handlePrint = () => {
    (async () => {
      // Open the window first (must be in sync context to avoid popup blocker)
      const win = window.open('', '_blank', 'width=860,height=760');
      if (!win) { toast.error('Popup bloqué — autorisez les popups pour ce site'); return; }
      win.document.write('<html><body><p style="font-family:sans-serif;padding:20px;color:#6b7280;">Génération du bulletin…</p></body></html>');

      try {
        const [header, profile, employee] = await Promise.all([
          getPayrollBulletinHeader().catch(() => null),
          getEmployeePayrollProfile(slip.employee_id).catch(() => null),
          getEmployee(slip.employee_id).catch(() => null),
        ]);

        const fmt = (n: number | null | undefined) =>
          n != null ? n.toLocaleString('fr-SN') + ' XOF' : '—';

        const contractLabels: Record<string, string> = {
          cdi: 'CDI', cdd: 'CDD', stage: 'Stage', consultant: 'Consultant',
        };

        const maskBan = (s: string | null | undefined) => {
          if (!s) return '—';
          return s.length > 4 ? '*'.repeat(s.length - 4) + s.slice(-4) : s;
        };

        const tableRows = (lines: PaySlipLine[]) => lines.map(l => `
          <tr>
            <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;">${l.component_name}</td>
            <td style="padding:6px 8px;text-align:right;color:#9ca3af;border-bottom:1px solid #f3f4f6;font-size:11px;">
              ${l.base_amount != null ? `Base\u00a0: ${l.base_amount.toLocaleString('fr-SN')}` : ''}
              ${l.rate != null ? ` \u00d7 ${(l.rate * 100).toFixed(2)}%` : ''}
            </td>
            <td style="padding:6px 8px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;">${l.amount.toLocaleString('fr-SN')}</td>
          </tr>`).join('');

        const section = (title: string, color: string, lines: PaySlipLine[]) =>
          lines.length === 0 ? '' : `
          <tr><td colspan="3" style="padding:10px 8px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${color};">${title}</td></tr>
          ${tableRows(lines)}`;

        const infoRow = (label: string, value: string) =>
          `<div style="display:flex;gap:4px;margin-bottom:4px;">
            <span style="color:#9ca3af;min-width:120px;font-size:11px;">${label}</span>
            <span style="font-size:11px;font-weight:500;">${value}</span>
          </div>`;

        const hireDate = employee?.hire_date
          ? new Date(employee.hire_date).toLocaleDateString('fr-FR') : '—';

        const html = `<!DOCTYPE html><html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bulletin de paie — ${empName} — ${MONTHS_FR[run.period_month - 1]} ${run.period_year}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; padding: 24px; font-size: 13px; }
    @media print { @page { margin: 12mm; size: A4; } .no-print { display: none !important; } body { padding: 0; } }
    .page { max-width: 720px; margin: 0 auto; }

    /* En-tête employeur / titre */
    .slip-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1d4ed8; padding-bottom: 14px; margin-bottom: 16px; }
    .company-block h1 { font-size: 16px; font-weight: 800; color: #1d4ed8; margin: 0 0 4px; }
    .company-block p { margin: 0; font-size: 11px; color: #6b7280; line-height: 1.5; }
    .slip-title { text-align: right; }
    .slip-title h2 { font-size: 18px; font-weight: 800; color: #1f2937; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .slip-title p { margin: 0; font-size: 12px; color: #6b7280; }

    /* Blocs employé / contrat */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .info-block { background: #f9fafb; border-radius: 8px; padding: 12px 14px; }
    .info-block h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #9ca3af; margin: 0 0 8px; }

    /* Tableau des lignes */
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
    table th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; text-align: left; }
    table th:last-child, table td:last-child { text-align: right; }
    table th:nth-child(2), table td:nth-child(2) { text-align: right; }

    /* Récapitulatif */
    .summary { background: #f9fafb; border-radius: 8px; padding: 14px 16px; font-size: 13px; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .summary-row.total { font-size: 16px; font-weight: 800; border-top: 2px solid #1d4ed8; margin-top: 10px; padding-top: 10px; color: #1d4ed8; }
    .summary-row.sub { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    .red { color: #dc2626; } .green { color: #16a34a; }

    /* Pied de page */
    .payment-row { margin-top: 14px; padding: 10px 14px; background: #eff6ff; border-radius: 8px; font-size: 12px; color: #1d4ed8; }
    .legal { margin-top: 20px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    .no-print { margin-top: 24px; text-align: center; padding-bottom: 16px; }
    .btn-print { background: #1d4ed8; color: white; border: none; padding: 10px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="page">

    <!-- En-tête -->
    <div class="slip-header">
      <div class="company-block">
        <h1>${header?.company_name ?? 'Entreprise'}</h1>
        ${header?.company_address ? `<p>${header.company_address.replace(/\n/g, '<br>')}</p>` : ''}
        ${header?.company_phone ? `<p>Tél : ${header.company_phone}</p>` : ''}
        ${header?.ninea ? `<p>NINEA : <strong>${header.ninea}</strong></p>` : ''}
        ${header?.ipres_employer_number ? `<p>N° IPRES employeur : <strong>${header.ipres_employer_number}</strong></p>` : ''}
        ${header?.css_employer_number ? `<p>N° CSS employeur : <strong>${header.css_employer_number}</strong></p>` : ''}
        ${header?.convention_collective ? `<p>Conv. collective : ${header.convention_collective}</p>` : ''}
      </div>
      <div class="slip-title">
        <h2>Bulletin de Paie</h2>
        <p>${MONTHS_FR[run.period_month - 1]} ${run.period_year}</p>
        <p style="margin-top:6px;font-size:11px;color:#9ca3af;">Émis le ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>
    </div>

    <!-- Infos employé / contrat -->
    <div class="info-grid">
      <div class="info-block">
        <h3>Employé</h3>
        ${infoRow('Nom', empName)}
        ${infoRow('Matricule', employee?.employee_id ?? '—')}
        ${employee?.department_name ? infoRow('Service', employee.department_name) : ''}
        ${employee?.job_title ? infoRow('Poste', employee.job_title) : ''}
        ${infoRow('Date d\'entrée', hireDate)}
      </div>
      <div class="info-block">
        <h3>Contrat &amp; Rémunération</h3>
        ${infoRow('Type de contrat', contractLabels[profile?.contract_type ?? ''] ?? profile?.contract_type ?? (employee?.contract_type ?? '—'))}
        ${infoRow('Classification', profile?.classification ?? employee?.classification ?? '—')}
        ${infoRow('Parts fiscales', profile?.family_parts != null ? String(profile.family_parts) : '—')}
        ${profile?.bank_name ? infoRow('Banque', profile.bank_name) : ''}
        ${infoRow('RIB', maskBan(profile?.bank_account_number))}
      </div>
    </div>

    <!-- Lignes du bulletin -->
    <table>
      <thead>
        <tr>
          <th>Rubrique</th>
          <th style="text-align:right;">Base / Taux</th>
          <th style="text-align:right;">Montant (XOF)</th>
        </tr>
      </thead>
      <tbody>
        ${section('Gains', '#15803d', gains)}
        ${section('Retenues salariales', '#dc2626', deductions)}
        ${section('Charges patronales', '#ea580c', patronal)}
      </tbody>
    </table>

    <!-- Récapitulatif -->
    <div class="summary">
      <div class="summary-row"><span style="color:#6b7280;">Salaire brut</span><span style="font-weight:600;">${fmt(slip.brut_total)}</span></div>
      <div class="summary-row"><span style="color:#6b7280;">Cotisations salariales</span><span class="red" style="font-weight:600;">− ${fmt(slip.cotisations_salariales)}</span></div>
      <div class="summary-row"><span style="color:#6b7280;">Impôt sur le revenu (IR)</span><span class="red" style="font-weight:600;">− ${fmt(slip.ir_amount)}</span></div>
      <div class="summary-row total"><span>Net à Payer</span><span>${fmt(slip.net_a_payer)}</span></div>
      <div class="summary-row sub"><span>Charges patronales (à la charge de l'employeur)</span><span>${fmt(slip.charges_patronales)}</span></div>
    </div>

    <!-- Mode de paiement -->
    ${profile?.bank_account_number ? `
    <div class="payment-row">
      Paiement par virement bancaire — ${profile.bank_name ?? ''} — RIB : ${maskBan(profile.bank_account_number)}
    </div>` : ''}

    <!-- Mention légale -->
    <div class="legal">
      Conserver ce bulletin de paie sans limitation de durée (Code du Travail sénégalais, art. L.103).<br>
      Document généré par Targetym RH — ${new Date().toLocaleDateString('fr-FR')}
    </div>

    <div class="no-print">
      <button class="btn-print" onclick="window.print();">Imprimer / Sauvegarder en PDF</button>
    </div>
  </div>
</body></html>`;

        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
      } catch {
        win.close();
        toast.error('Erreur lors de la génération du bulletin');
      }
    })();
  };

  const LineTable = ({ lines, title, colorClass }: { lines: PaySlipLine[]; title: string; colorClass: string }) => (
    lines.length > 0 ? (
      <div>
        <h3 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${colorClass}`}>{title}</h3>
        <table className="w-full text-sm mb-3">
          <tbody>
            {lines.map(l => (
              <tr key={l.id} className="border-b border-gray-50 last:border-0">
                <td className="py-1.5 text-gray-700">{l.component_name}</td>
                <td className="py-1.5 text-right text-gray-400 text-xs">
                  {l.base_amount != null && `Base: ${l.base_amount.toLocaleString('fr-SN')}`}
                  {l.rate != null && ` × ${(l.rate * 100).toFixed(2)}%`}
                </td>
                <td className="py-1.5 text-right font-semibold text-gray-800 pl-4">
                  {l.amount.toLocaleString('fr-SN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <div>
            <h2 className="font-semibold text-gray-800">{empName}</h2>
            <p className="text-xs text-gray-400">Bulletin de paie — {MONTHS_FR[run.period_month - 1]} {run.period_year}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
              title="Imprimer / Exporter PDF"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-2">
          <LineTable lines={gains} title="Gains" colorClass="text-green-600" />
          <LineTable lines={deductions} title="Retenues salariales" colorClass="text-red-600" />
          <LineTable lines={patronal} title="Charges patronales" colorClass="text-orange-600" />

          {/* Récapitulatif */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Salaire brut</span>
              <span className="font-semibold">{formatXOF(slip.brut_total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cotisations salariales</span>
              <span className="font-semibold text-red-600">- {formatXOF(slip.cotisations_salariales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">IR</span>
              <span className="font-semibold text-red-600">- {formatXOF(slip.ir_amount)}</span>
            </div>
            <div className="border-t my-1" />
            <div className="flex justify-between text-base">
              <span className="font-bold text-gray-800">Net à payer</span>
              <span className="font-bold text-green-700">{formatXOF(slip.net_a_payer)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 pt-1">
              <span>Charges patronales</span>
              <span>{formatXOF(slip.charges_patronales)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecapPage() {
  const params = useParams();
  const runId = params.runId as string;
  const runIdNum = parseInt(runId);

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [slips, setSlips] = useState<PaySlip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [detailSlip, setDetailSlip] = useState<PaySlip | null>(null);
  const [loadingSlipId, setLoadingSlipId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; danger?: boolean }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [runData, empsData] = await Promise.all([
        getRun(runIdNum),
        getEmployees({ status: 'active', page_size: 200 }).then(r => r.items ?? []),
      ]);
      setRun(runData);
      setEmployees(empsData);

      if (runData.status === 'simulation' || runData.status === 'validated') {
        const slipsData = await getSlips(runIdNum);
        setSlips(slipsData);
      }
    } catch {
      toast.error('Erreur chargement récap');
    } finally {
      setLoading(false);
    }
  }, [runIdNum]);

  useEffect(() => { void load(); }, [load]);

  const empName = (employeeId: number) => {
    const e = employees.find(x => x.id === employeeId);
    return e ? `${e.first_name} ${e.last_name}` : `Employé #${employeeId}`;
  };

  const openDetail = async (slip: PaySlip) => {
    if (slip.lines?.length > 0) { setDetailSlip(slip); return; }
    setLoadingSlipId(slip.employee_id);
    try {
      const full = await getSlip(runIdNum, slip.employee_id);
      setSlips(prev => prev.map(s => s.employee_id === slip.employee_id ? full : s));
      setDetailSlip(full);
    } catch { toast.error('Erreur chargement bulletin'); }
    finally { setLoadingSlipId(null); }
  };

  const handleSimulate = () => {
    if (!run) return;
    setConfirmDialog({
      open: true,
      title: 'Lancer la simulation',
      message: 'Lancer la simulation de paie ? Les bulletins existants seront recalculés.',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const updated = await simulateRun(run.id);
          toast.success('Simulation terminée');
          setRun(updated);
          const slipsData = await getSlips(runIdNum);
          setSlips(slipsData);
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Erreur simulation');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleValidate = () => {
    if (!run) return;
    setConfirmDialog({
      open: true,
      title: 'Valider la paie',
      message: `Valider définitivement la paie de ${MONTHS_FR[run.period_month - 1]} ${run.period_year} ? Cette action est irréversible.`,
      danger: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const updated = await validateRun(run.id);
          toast.success('Paie validée !');
          setRun(updated);
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Erreur validation');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const status = run?.status ?? 'draft';
  const statusInfo = RUN_STATUS[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Paie" />

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Fil d'Ariane */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <Receipt className="w-4 h-4" />
          <Link href="/dashboard/paie/runs" className="hover:text-blue-600">Runs</Link>
          <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
          <span className="text-gray-700 font-medium">
            Récap — {run ? `${MONTHS_FR[run.period_month - 1]} ${run.period_year}` : '…'}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
          </div>
        ) : !run ? (
          <div className="text-center text-gray-400 py-20">Run introuvable</div>
        ) : (
          <>
            {/* En-tête */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <ClipboardList className="w-6 h-6 text-blue-600" />
                  Récap paie — {MONTHS_FR[run.period_month - 1]} {run.period_year}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  {run.employee_count != null && (
                    <span className="text-sm text-gray-400">{run.employee_count} employé{run.employee_count > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/dashboard/paie/runs/${run.id}/variables`}
                  className="text-sm text-gray-600 bg-white border rounded-lg px-4 py-2 hover:bg-gray-50 transition"
                >
                  Variables
                </Link>
                {(status === 'draft' || status === 'simulation') && (
                  <button
                    onClick={handleSimulate}
                    disabled={actionLoading}
                    className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-4 py-2 rounded-lg hover:bg-purple-100 transition disabled:opacity-60"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                    Simuler
                  </button>
                )}
                {status === 'simulation' && (
                  <button
                    onClick={handleValidate}
                    disabled={actionLoading}
                    className="flex items-center gap-2 text-sm text-white bg-green-600 px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-60"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Valider définitivement
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            {(status === 'simulation' || status === 'validated') && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard
                  label="Masse salariale brute"
                  value={formatXOF(run.total_brut)}
                  icon={TrendingUp}
                  color="bg-blue-50 text-blue-600"
                />
                <StatCard
                  label="Net total à payer"
                  value={formatXOF(run.total_net)}
                  icon={Wallet}
                  color="bg-green-50 text-green-600"
                />
                <StatCard
                  label="Charges patronales"
                  value={formatXOF(run.total_charges_patronales)}
                  icon={TrendingDown}
                  color="bg-orange-50 text-orange-600"
                />
                <StatCard
                  label="Employés"
                  value={String(run.employee_count ?? 0)}
                  icon={Users}
                  color="bg-purple-50 text-purple-600"
                />
              </div>
            )}

            {/* Bulletins */}
            {(status === 'simulation' || status === 'validated') && slips.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <h2 className="font-medium text-gray-700 text-sm">Bulletins de paie</h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Employé</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Brut</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Cotis. sal.</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">IR</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Net à payer</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Ch. patronales</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {slips.map(slip => (
                      <tr key={slip.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-800">{empName(slip.employee_id)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatXOF(slip.brut_total)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatXOF(slip.cotisations_salariales)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatXOF(slip.ir_amount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">{formatXOF(slip.net_a_payer)}</td>
                        <td className="px-4 py-3 text-right text-orange-600">{formatXOF(slip.charges_patronales)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openDetail(slip)}
                            disabled={loadingSlipId === slip.employee_id}
                            className="flex items-center gap-1 ml-auto text-xs text-blue-600 hover:underline disabled:opacity-50"
                          >
                            {loadingSlipId === slip.employee_id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <ChevronRight className="w-3 h-3" />}
                            Détail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {status === 'draft' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Run non encore simulé</p>
                <p className="text-sm mt-1">
                  Saisissez les variables puis lancez la simulation
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {detailSlip && (
        <SlipLinesModal
          slip={detailSlip}
          empName={empName(detailSlip.employee_id)}
          run={run!}
          onClose={() => setDetailSlip(null)}
        />
      )}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
      />
    </div>
  );
}