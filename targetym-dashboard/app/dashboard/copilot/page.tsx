'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, FileText, Loader2, Paperclip, Plus, Send, ShieldOff, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import ChatMessageContent from '@/components/ChatMessageContent';
import { useCopilotAccess } from '@/hooks/useCopilotAccess';
import {
  approveCopilotPending, createChatConversation, deleteChatConversation, extractPdfText,
  getChatConversation, getChatConversations, rejectCopilotPending, streamCopilotMessage,
  type ChatConversation, type ChatMessage, type CopilotPendingAction,
} from '@/lib/api';

type LocalMessage = ChatMessage & { pendingActions?: CopilotPendingAction[]; streaming?: boolean };

export default function CopilotPage() {
  const { canUseCopilot, checked } = useCopilotAccess();
  const [sessions, setSessions] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSessions = async () => {
    try { setSessions(await getChatConversations()); } catch { setError('Impossible de charger l’historique.'); }
  };
  useEffect(() => { if (canUseCopilot) void loadSessions(); }, [canUseCopilot]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);

  const selectSession = async (id: number) => {
    try {
      const session = await getChatConversation(id);
      setActiveId(id);
      setMessages(session.messages.map((message) => ({ ...message, pendingActions: message.pending_actions || [] })));
      setHistoryOpen(false);
      setError('');
    } catch { setError('Impossible de charger cette session.'); }
  };
  const newSession = () => { setActiveId(null); setMessages([]); setDraft(''); setAttachment(null); setHistoryOpen(false); setError(''); };
  const removeSession = async (id: number) => {
    try {
      await deleteChatConversation(id);
      if (activeId === id) newSession();
      await loadSessions();
    } catch { setError('Impossible de supprimer cette session.'); }
  };

  const attachFile = async (file?: File) => {
    if (!file) return;
    setAttaching(true); setError('');
    try {
      const result = await extractPdfText(file);
      setAttachment({ name: file.name, text: result.text });
    } catch { setError('Le fichier ne peut pas être lu.'); }
    finally { setAttaching(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || streaming) return;
    setDraft(''); setError(''); setStreaming(true);
    let conversationId = activeId;
    try {
      if (!conversationId) {
        const conversation = await createChatConversation(content.slice(0, 60));
        conversationId = conversation.id; setActiveId(conversation.id);
      }
      const timestamp = new Date().toISOString();
      const localUser: LocalMessage = { id: -Date.now(), conversation_id: conversationId, role: 'user', content, created_at: timestamp };
      const assistantId = -(Date.now() + 1);
      setMessages((previous) => [...previous, localUser, { id: assistantId, conversation_id: conversationId!, role: 'assistant', content: '', created_at: timestamp, streaming: true, pendingActions: [] }]);
      let finalText = '';
      await streamCopilotMessage({ message: content, conversation_id: conversationId, page_path: '/dashboard/copilot', file_text: attachment?.text, file_name: attachment?.name }, (event) => {
        if (event.type === 'token') {
          const token = event.text || event.content || ''; finalText += token;
          setMessages((previous) => previous.map((message) => message.id === assistantId ? { ...message, content: message.content + token } : message));
        }
        if (event.type === 'pending') {
          const pending = event.pending_actions || (event.tool_result ? [event.tool_result] : []);
          setMessages((previous) => previous.map((message) => message.id === assistantId ? { ...message, pendingActions: pending } : message));
        }
        if (event.type === 'done') {
          finalText = event.reply || event.text || finalText;
          if (event.conversation_id) { conversationId = event.conversation_id; setActiveId(event.conversation_id); }
          setMessages((previous) => previous.map((message) => message.id === assistantId ? { ...message, content: finalText, pendingActions: event.pending_actions || message.pendingActions, streaming: false } : message));
        }
      });
      setAttachment(null); await loadSessions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Le Copilote est indisponible.');
      setMessages((previous) => previous.map((message) => message.streaming ? { ...message, streaming: false } : message));
    } finally { setStreaming(false); }
  };

  const resolvePending = async (messageId: number, pending: CopilotPendingAction, approve: boolean) => {
    const id = pending.pending_id || pending.id;
    if (!id) return;
    try {
      if (approve) await approveCopilotPending(id); else await rejectCopilotPending(id);
      setMessages((previous) => previous.map((message) => message.id === messageId ? { ...message, pendingActions: (message.pendingActions || []).filter((item) => (item.pending_id || item.id) !== id) } : message));
    } catch { setError('Cette action n’a pas pu être traitée.'); }
  };

  if (!checked) return <div className="min-h-[60vh] bg-slate-50" />;
  if (!canUseCopilot) return <Forbidden />;

  return (
    <div className="fixed inset-0 z-[10000] flex h-[100dvh] flex-col bg-[#f5f8fa]">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm sm:px-6">
        <div className="mr-auto flex min-w-0 items-center gap-2"><Sparkles className="text-primary-600" size={23} /><h1 className="truncate text-xl font-bold text-slate-900">Copilote AI</h1><span className="rounded-full border border-secondary-200 bg-secondary-50 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-primary-700">BETA</span></div>
        <button onClick={() => setHistoryOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600"><Clock3 size={17} /><span className="hidden sm:inline">Historique</span></button>
        <button onClick={newSession} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-600 px-3 text-sm font-semibold text-white shadow-sm"><Plus size={18} /><span className="hidden sm:inline">Nouvelle session</span></button>
      </header>

      <main className="relative min-h-0 flex-1 p-2 sm:p-4">
        <section className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 sm:p-6">
            {messages.length === 0 && <Welcome />}
            {messages.map((message) => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[92%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-primary-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-900'}`}><ChatMessageContent content={message.content || (message.streaming ? 'Réflexion en cours…' : '')} isUser={message.role === 'user'} />{message.streaming && <Loader2 className="mt-2 animate-spin text-primary-600" size={16} />}{message.pendingActions?.map((pending, index) => <div key={pending.pending_id || pending.id || index} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-900">{pending.display_label || pending.label || 'Validation requise'}</p><p className="mt-1 text-xs text-amber-800">Confirmez avant que le Copilote exécute cette action.</p><div className="mt-2 flex gap-2"><button onClick={() => resolvePending(message.id, pending, true)} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white">Valider</button><button onClick={() => resolvePending(message.id, pending, false)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900">Refuser</button></div></div>)}</div></div>)}
            <div ref={endRef} />
          </div>
          {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
          {attachment && <div className="flex items-center gap-2 border-t border-primary-100 bg-primary-50 px-4 py-2 text-xs text-primary-800"><FileText size={14} /><span className="flex-1 truncate">{attachment.name}</span><button onClick={() => setAttachment(null)} aria-label="Retirer le fichier"><X size={15} /></button></div>}
          <div className="border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"><div className="flex items-end gap-2"><input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx" className="hidden" onChange={(event) => void attachFile(event.target.files?.[0])} /><button onClick={() => fileRef.current?.click()} disabled={attaching || streaming} className="rounded-xl border border-slate-300 p-3 text-slate-500 disabled:opacity-50">{attaching ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}</button><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Demandez quelque chose au Copilote…" rows={1} className="max-h-28 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" /><button onClick={() => void send()} disabled={!draft.trim() || streaming} className="rounded-xl bg-primary-600 p-3 text-white disabled:opacity-50"><Send size={18} /></button></div></div>
        </section>
      </main>
      {historyOpen && <History sessions={sessions} activeId={activeId} onClose={() => setHistoryOpen(false)} onSelect={selectSession} onDelete={removeSession} />}
    </div>
  );
}

function Welcome() { return <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center"><div className="mb-4 rounded-2xl bg-primary-50 p-4 text-primary-600"><Sparkles size={32} /></div><h2 className="text-lg font-bold text-slate-900">Bonjour, je suis votre Copilote AI</h2><p className="mt-2 max-w-md text-sm text-slate-500">Je peux vous aider à analyser, préparer et réaliser vos opérations RH. Toute action sensible vous sera soumise pour validation.</p></div>; }
function Forbidden() { return <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-6 text-center"><div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><ShieldOff className="mx-auto mb-3 text-slate-400" size={30} /><p className="font-medium text-slate-700">Le Copilote n’est pas activé pour votre profil.</p></div></div>; }
function History({ sessions, activeId, onClose, onSelect, onDelete }: { sessions: ChatConversation[]; activeId: number | null; onClose: () => void; onSelect: (id: number) => void; onDelete: (id: number) => void }) { return <div className="absolute inset-0 z-20 bg-slate-950/20" onClick={onClose}><aside className="h-full w-[min(360px,92vw)] overflow-y-auto bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center"><h2 className="font-bold text-slate-900">Historique</h2><button onClick={onClose} className="ml-auto rounded-lg p-2 text-slate-500"><X size={19} /></button></div>{sessions.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Aucune session.</p> : <div className="space-y-2">{sessions.map((session) => <div key={session.id} className={`flex items-center gap-2 rounded-xl border p-3 ${session.id === activeId ? 'border-primary-200 bg-primary-50' : 'border-slate-100'}`}><button onClick={() => onSelect(session.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-medium text-slate-800">{session.title || 'Nouvelle session'}</p><p className="mt-1 text-xs text-slate-400">{session.message_count || 0} messages</p></button><button onClick={() => onDelete(session.id)} className="text-xs text-red-500">Suppr.</button></div>)}</div>}</aside></div>; }
