'use client';

import { AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/I18nContext';
import type { LicenseStatus } from '@/lib/api';

interface LicenseSurplusBannerProps {
  data: LicenseStatus;
}

export default function LicenseSurplusBanner({ data }: LicenseSurplusBannerProps) {
  const { t } = useI18n();

  // Don't show if no surplus and not blocked
  if (data.surplus <= 0 && !data.surplus_blocked) return null;

  const isBlocked = data.surplus_blocked;

  const message = isBlocked
    ? t.licenses.bannerBlocked
        .replace('{count}', String(data.surplus))
        .replace('{limit}', String(data.limit))
    : t.licenses.bannerGrace
        .replace('{plan}', data.plan)
        .replace('{limit}', String(data.limit))
        .replace('{count}', String(data.active_count))
        .replace('{surplus}', String(data.surplus))
        .replace('{date}', data.grace_period_ends_at
          ? new Date(data.grace_period_ends_at).toLocaleDateString()
          : '');

  return (
    <div
      className={`px-4 py-3 flex items-center justify-between gap-4 text-sm font-medium ${
        isBlocked
          ? 'bg-red-50 border-b border-red-200 text-red-800'
          : 'bg-amber-50 border-b border-amber-200 text-amber-800'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isBlocked ? (
          <XCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
        ) : (
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500" />
        )}
        <span className="truncate">{message}</span>
      </div>
      <Link
        href="/dashboard/settings?tab=licenses"
        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
          isBlocked
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-amber-600 text-white hover:bg-amber-700'
        }`}
      >
        {t.licenses.manageLicenses}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
