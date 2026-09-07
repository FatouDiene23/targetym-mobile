'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Receipt, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';
import {
  downloadMyPayslip,
  listMyPayslips,
  saveBase64File,
  type MyPaySlip,
} from '@/lib/payrollSelfServiceApi';


const PAGE_SIZE = 12;

export default function MyPayslipsPage() {
  const { t, locale } = useI18n();
  const copy = t.mySpace.payslips;
  const [items, setItems] = useState<MyPaySlip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [year, setYear] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const localeTag = ({ fr: 'fr-FR', en: 'en-US', pt: 'pt-BR' } as const)[locale];
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, index) => current - index);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listMyPayslips(page, PAGE_SIZE, year);
      setItems(result.items);
      setTotal(result.total);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : copy.loadError;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, page, year]);

  useEffect(() => { void load(); }, [load]);

  const handleDownload = async (slip: MyPaySlip) => {
    setDownloadingId(slip.id);
    try {
      saveBase64File(await downloadMyPayslip(slip.id));
      toast.success(copy.downloadSuccess);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : copy.downloadError);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatPeriod = (slip: MyPaySlip) => new Intl.DateTimeFormat(localeTag, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(slip.period_year, slip.period_month - 1, 1));

  const formatMoney = (amount: number) => new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(amount);

  const formatDate = (value: string) => new Intl.DateTimeFormat(localeTag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        <section className="overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-7 text-white shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-white/15 p-3"><Receipt className="h-7 w-7" /></div>
            <div>
              <h1 className="text-2xl font-bold">{copy.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-primary-50">{copy.subtitle}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ShieldCheck className="h-5 w-5 text-primary-600" />
              <span>{copy.confidential}</span>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              {copy.year}
              <select
                value={year ?? ''}
                onChange={(event) => {
                  setYear(event.target.value ? Number(event.target.value) : undefined);
                  setPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              >
                <option value="">{copy.allYears}</option>
                {years.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" /> {copy.loading}
            </div>
          ) : error ? (
            <div className="m-5 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
              <p>{error}</p>
              <button onClick={() => void load()} className="mt-3 font-semibold underline">{copy.retry}</button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="rounded-full bg-gray-100 p-4"><FileText className="h-8 w-8 text-gray-400" /></div>
              <h2 className="mt-4 font-semibold text-gray-800">{copy.emptyTitle}</h2>
              <p className="mt-1 max-w-md text-sm text-gray-500">{copy.emptyDescription}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {items.map((slip) => (
                  <article key={slip.id} className="rounded-xl border border-gray-100 bg-gray-50 p-5 transition hover:border-primary-200 hover:bg-primary-50/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-lg bg-primary-100 p-2.5 text-primary-700"><FileText className="h-5 w-5" /></div>
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">PDF</span>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold capitalize text-gray-900">{formatPeriod(slip)}</h2>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">{copy.netToPay}</dt><dd className="font-semibold text-gray-800">{formatMoney(slip.net_a_payer)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">{copy.publishedOn}</dt><dd className="text-gray-700">{formatDate(slip.sent_at)}</dd></div>
                    </dl>
                    <button
                      onClick={() => void handleDownload(slip)}
                      disabled={downloadingId === slip.id}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
                    >
                      {downloadingId === slip.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {copy.download}
                    </button>
                  </article>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                  <span>{copy.pageOf.replace('{page}', String(page)).replace('{total}', String(totalPages))}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      disabled={page <= 1}
                      className="rounded-lg border border-gray-200 px-3 py-2 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copy.previous}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                      disabled={page >= totalPages}
                      className="rounded-lg border border-gray-200 px-3 py-2 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copy.next}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
