'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock3, Plus, Settings, ShieldOff, X,
} from 'lucide-react';
import CopilotConversation from '@/components/CopilotConversation';
import CopilotSessionList from '@/components/CopilotSessionList';
import { ThemeToggle } from '@/components/Header';
import { useCopilotContext } from '@/context/CopilotContext';
import { useCopilotAccess } from '@/hooks/useCopilotAccess';
import { useI18n } from '@/lib/i18n/I18nContext';

export default function CopilotPage() {
  const router = useRouter();
  const { t } = useI18n();
  const c = t.components.copilot;
  const { canUseCopilot } = useCopilotAccess();
  const copilot = useCopilotContext();
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (canUseCopilot) void copilot.loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseCopilot]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${c.title} · Beta | Targetym`;
    return () => { document.title = previousTitle; };
  }, [c.title]);

  useEffect(() => {
    if (!historyOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHistoryOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [historyOpen]);

  const startNewSession = () => {
    copilot.newConversation();
    setHistoryOpen(false);
  };

  const closeCopilot = () => {
    if (window.history.length > 1) router.back();
    else router.push('/dashboard');
  };

  return (
    <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[10000] flex h-[min(82dvh,820px)] flex-col overflow-hidden rounded-[26px] border border-white/90 bg-[#f5f8fa] shadow-[0_32px_80px_-42px_rgba(15,23,42,0.55),0_14px_32px_-24px_rgba(6,108,108,0.32)] ring-1 ring-slate-200/70 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(780px,calc(100dvh-3rem))] sm:w-[min(920px,calc(100vw-3rem))]">
      <header className="relative z-30 flex flex-wrap items-center gap-3 border-b border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)] sm:px-6 sm:py-4">
        <div className="mr-1 flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-xl font-bold tracking-[-0.025em] text-slate-900 sm:text-2xl">
            {c.title}
          </h1>
          <span className="rounded-full border border-secondary-200 bg-secondary-50 px-2.5 py-1 text-[10px] font-extrabold tracking-[0.1em] text-primary-700">
            BETA
          </span>
        </div>

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          disabled={!canUseCopilot}
          aria-expanded={historyOpen}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
        >
          <Clock3 size={18} />
          <span className="hidden sm:inline">{c.history}</span>
        </button>

        <button
          type="button"
          onClick={startNewSession}
          disabled={!canUseCopilot}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-500 px-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(6,108,108,0.85)] transition hover:-translate-y-0.5 hover:bg-primary-600 hover:shadow-[0_12px_24px_-10px_rgba(6,108,108,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:px-5"
        >
          <Plus size={19} />
          <span className="hidden sm:inline">{c.newSession}</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/dashboard/copilot/config"
            className="inline-flex h-11 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 sm:px-3"
          >
            <Settings size={19} />
            <span className="hidden md:inline">{c.config.openConfig}</span>
          </Link>
          <button
            type="button"
            onClick={closeCopilot}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            aria-label={c.close}
            title={c.close}
          >
            <X size={21} />
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {historyOpen && canUseCopilot && (
          <div className="absolute inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label={c.history}>
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-slate-950/15 backdrop-blur-[1px]"
              onClick={() => setHistoryOpen(false)}
              aria-label={c.close}
            />
            <aside className="relative flex h-full w-[min(360px,92vw)] flex-col border-r border-slate-200 bg-white shadow-[20px_0_60px_-24px_rgba(15,23,42,0.35)]">
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <Clock3 size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{c.history}</h2>
                  <p className="text-xs text-slate-400">{c.searchPlaceholder}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  aria-label={c.close}
                >
                  <X size={19} />
                </button>
              </div>
              <div className="min-h-0 flex-1 pt-3">
                <CopilotSessionList onConversationSelected={() => setHistoryOpen(false)} />
              </div>
            </aside>
          </div>
        )}

        {canUseCopilot && !copilot.forbidden ? (
          <section className="h-full px-2 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
            <div className="relative mx-auto h-full w-full max-w-[1500px]">
              <div
                aria-hidden="true"
                className="absolute inset-x-8 bottom-0 top-5 rounded-[32px] bg-primary-950/10 blur-2xl"
              />
              <div className="relative h-full overflow-hidden rounded-[26px] border border-white/90 bg-white shadow-[0_32px_80px_-42px_rgba(15,23,42,0.55),0_14px_32px_-24px_rgba(6,108,108,0.32),0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70">
                <CopilotConversation copilot={copilot} variant="fullscreen" />
              </div>
            </div>
          </section>
        ) : (
          <ForbiddenBlock label={c.forbidden} />
        )}
      </div>
    </div>
  );
}

function ForbiddenBlock({ label }: Readonly<{ label: string }>) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.35)]">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <ShieldOff size={26} className="text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
      </div>
    </div>
  );
}
