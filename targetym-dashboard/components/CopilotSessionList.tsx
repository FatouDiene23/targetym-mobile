'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, X, Trash2, Pin, Pencil } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useCopilotContext } from '@/context/CopilotContext';
import { useI18n } from '@/lib/i18n/I18nContext';
import { getChatConversations, type ChatConversation } from '@/lib/api';

const PINS_KEY = 'tym_copilot_pins';
const DAY = 86_400_000;

function loadPins(): number[] {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

/**
 * Liste des conversations du copilote : recherche instantanée (titre + aperçu
 * côté client, contenu complet côté serveur), regroupement par ancienneté,
 * épinglage (localStorage), renommage en ligne et surlignage du terme cherché.
 */
export default function CopilotSessionList({
  onConversationSelected,
}: Readonly<{ onConversationSelected?: () => void }>) {
  const { t } = useI18n();
  const c = t.components.copilot;
  const copilot = useCopilotContext();

  const [query, setQuery] = useState('');
  const [serverResults, setServerResults] = useState<ChatConversation[] | null>(null);
  const [pinned, setPinned] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChatConversation | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setPinned(loadPins()), []);

  const togglePin = useCallback((id: number) => {
    setPinned((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      try {
        localStorage.setItem(PINS_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible : épinglage éphémère, tant pis */
      }
      return next;
    });
  }, []);

  // Recherche profonde (contenu des messages) côté serveur, débruitée. Le filtre
  // client (titre + aperçu) reste instantané en attendant la réponse.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setServerResults(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      getChatConversations(term)
        .then(setServerResults)
        .catch(() => setServerResults(null));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return copilot.conversations;
    const client = copilot.conversations.filter((conv) =>
      `${conv.title || c.untitledSession} ${conv.last_message_preview || ''}`
        .toLowerCase()
        .includes(term),
    );
    // Dès que le serveur répond, il fait foi (il voit aussi les vieux messages).
    return serverResults ?? client;
  }, [copilot.conversations, query, serverResults, c]);

  const sections = useMemo(() => {
    const pinnedSet = new Set(pinned);
    const byDate = (a: ChatConversation, b: ChatConversation) =>
      new Date(b.updated_at || b.created_at).getTime() -
      new Date(a.updated_at || a.created_at).getTime();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const bucketOf = (raw?: string): 'today' | 'week' | 'month' | 'older' => {
      const d = raw ? new Date(raw) : null;
      if (!d || Number.isNaN(d.getTime())) return 'older';
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      const diff = Math.round((startOfToday.getTime() - day.getTime()) / DAY);
      if (diff <= 0) return 'today';
      if (diff <= 7) return 'week';
      if (diff <= 31) return 'month';
      return 'older';
    };

    const order = ['today', 'week', 'month', 'older'] as const;
    const labels = {
      today: c.groupToday, week: c.groupThisWeek, month: c.groupThisMonth, older: c.groupOlder,
    };
    const byKey: Record<(typeof order)[number], ChatConversation[]> = {
      today: [], week: [], month: [], older: [],
    };
    [...matches]
      .filter((conv) => !pinnedSet.has(conv.id))
      .sort(byDate)
      .forEach((conv) => byKey[bucketOf(conv.updated_at || conv.created_at)].push(conv));

    const result: { key: string; label: string; items: ChatConversation[] }[] = [];
    const pinnedItems = matches.filter((conv) => pinnedSet.has(conv.id)).sort(byDate);
    if (pinnedItems.length) result.push({ key: 'pinned', label: c.groupPinned, items: pinnedItems });
    order.forEach((k) => byKey[k].length && result.push({ key: k, label: labels[k], items: byKey[k] }));
    return result;
  }, [matches, pinned, c]);

  const commitEdit = useCallback(async () => {
    const id = editingId;
    const title = editTitle.trim();
    setEditingId(null);
    if (id != null && title) {
      try {
        await copilot.renameConversation(id, title);
        // Garder le snapshot de recherche serveur cohérent avec la liste
        // canonique (sinon l'ancien titre reste affiché tant que la
        // recherche est active).
        setServerResults((prev) =>
          prev ? prev.map((c2) => (c2.id === id ? { ...c2, title } : c2)) : prev,
        );
      } catch {
        /* échec renommage : on garde le titre courant */
      }
    }
  }, [editingId, editTitle, copilot]);

  const highlight = useCallback(
    (text: string): ReactNode => {
      const term = query.trim();
      if (!term) return text;
      const idx = text.toLowerCase().indexOf(term.toLowerCase());
      if (idx < 0) return text;
      return (
        <>
          {text.slice(0, idx)}
          <mark className="bg-yellow-200 text-inherit rounded px-0.5">
            {text.slice(idx, idx + term.length)}
          </mark>
          {text.slice(idx + term.length)}
        </>
      );
    },
    [query],
  );

  const fmtTime = (raw?: string): string => {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString();
  };

  const hasConversations = copilot.conversations.length > 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {hasConversations && (
        <div className="p-3 pt-0">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.searchPlaceholder}
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 transition"
              aria-label={c.searchPlaceholder}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
                aria-label={c.close}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!hasConversations ? (
          <p className="text-center text-gray-400 text-sm py-8">{c.noSession}</p>
        ) : sections.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">{c.searchNoResults}</p>
        ) : (
          sections.map((grp) => (
            <div key={grp.key}>
              <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {grp.label}
              </p>
              <div className="divide-y divide-gray-100">
                {grp.items.map((conv) => {
                  const isPinned = pinned.includes(conv.id);
                  const isEditing = editingId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        if (!isEditing) {
                          copilot.selectConversation(conv.id);
                          onConversationSelected?.();
                        }
                      }}
                      className={`px-4 py-2.5 hover:bg-gray-50 cursor-pointer flex items-start justify-between gap-2 group ${
                        copilot.activeId === conv.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editTitle}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void commitEdit();
                              else if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="w-full text-sm font-medium bg-white border border-primary-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          />
                        ) : (
                          <p
                            className="text-sm font-medium truncate text-gray-900"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingId(conv.id);
                              setEditTitle(conv.title || '');
                            }}
                            title={c.renameSession}
                          >
                            {highlight(conv.title || c.untitledSession)}
                          </p>
                        )}
                        {!isEditing && (
                          <p className="text-xs text-gray-500 truncate">
                            {conv.last_message_preview
                              ? highlight(conv.last_message_preview)
                              : `${conv.message_count || 0} ${c.messages}`}
                          </p>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <span className="text-[10px] text-gray-400 mr-0.5 group-hover:hidden">
                            {fmtTime(conv.updated_at || conv.created_at)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePin(conv.id); }}
                            className={`p-1 rounded hover:bg-gray-200 transition ${
                              isPinned ? 'text-primary-600' : 'text-gray-400 opacity-0 group-hover:opacity-100'
                            }`}
                            aria-label={isPinned ? c.unpinSession : c.pinSession}
                            title={isPinned ? c.unpinSession : c.pinSession}
                          >
                            <Pin size={13} fill={isPinned ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title || ''); }}
                            className="p-1 rounded hover:bg-gray-200 text-gray-400 opacity-0 group-hover:opacity-100 transition"
                            aria-label={c.renameSession}
                            title={c.renameSession}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv); }}
                            className="p-1 rounded hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition"
                            aria-label={c.archive}
                            title={c.archive}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            const id = deleteTarget.id;
            void copilot.removeConversation(id);
            // Retirer aussi du snapshot de recherche serveur : sinon la
            // conversation supprimée reste visible (et cliquable) tant que
            // la recherche est active.
            setServerResults((prev) =>
              prev ? prev.filter((c2) => c2.id !== id) : prev,
            );
          }
        }}
        title={c.deleteConfirmTitle}
        message={`« ${deleteTarget?.title || c.untitledSession} » — ${c.deleteConfirmMessage}`}
        confirmText={c.deleteConfirm}
        cancelText={c.deleteCancel}
        danger
      />
    </div>
  );
}
