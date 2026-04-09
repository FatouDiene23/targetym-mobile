'use client';

import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  MessageCircle, X, Send, Trash2, Plus, Mail, MessageSquare, Loader2, Zap, Paperclip, FileText
} from 'lucide-react';
import {
  getChatConversations, sendChatMessage, deleteChatConversation,
  getChatConversation, getChatbotStatus,
  sendAgentMessage, executeAgentAction, extractPdfText,
  type ChatConversation, type ChatMessage, type ChatConversationWithMessages,
  type AgentActionPreviewData,
} from '@/lib/api';
import ChatMessageContent from './ChatMessageContent';
import ConfirmDialog from './ConfirmDialog';
import AgentActionPreview from './AgentActionPreview';

// Pages avec outils d'action spécifiques (labels d'affichage)
const AGENT_PAGES_LABELS: Record<string, string> = {
  '/dashboard/onboarding': 'Onboarding',
  '/dashboard/performance/objectives': 'OKR',
  '/dashboard/learning': 'Formation',
  '/dashboard/recruitment': 'Recrutement',
};

// Rôles globalement autorisés à utiliser l'agent (sur TOUTES les pages)
const AGENT_ALLOWED_ROLES = ['rh', 'admin', 'dg', 'manager'];

// Dérive un label lisible depuis le pathname
function getAgentContext(pathname: string): string {
  for (const [prefix, label] of Object.entries(AGENT_PAGES_LABELS)) {
    if (pathname.startsWith(prefix)) return label;
  }
  // Label générique basé sur le dernier segment de l'URL
  const segments = pathname.replace('/dashboard/', '').split('/');
  const last = segments[segments.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1) || 'Général';
}

// L'agent est disponible sur toutes les pages pour les rôles autorisés
function canUseAgent(role: string): boolean {
  return AGENT_ALLOWED_ROLES.includes(role);
}

const LS_AGENT_KEY = (pathname: string) =>
  `targetym_agent_${pathname.replace(/\//g, '_')}`;

// Tour persistant localement
interface AgentTurn {
  id: string;
  userText: string;
  reply: string;
  action_preview: AgentActionPreviewData | null;
  timestamp: Date;
}

export default function AIChatBox() {
  const pathname = usePathname();
  const agentContext: string = getAgentContext(pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  // Rôle et nom de l'utilisateur connecte (lu depuis localStorage)
  const [userRole, setUserRole] = useState<string>('employee');
  const [userName, setUserName] = useState<string>('');

  // Mode agent — uniquement si le rôle le permet pour cette page
  const [agentMode, setAgentMode] = useState(false);
  const [agentTurns, setAgentTurns] = useState<AgentTurn[]>([]);

  // Fichier PDF attaché
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [fileText, setFileText] = useState<string>('');
  const [cvTmpPath, setCvTmpPath] = useState<string | null>(null);
  const [cvFilename, setCvFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversationWithMessages | null>(null);
  const [showConversationList, setShowConversationList] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; danger?: boolean;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Lire le rôle et le nom depuis localStorage au montage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setUserRole(u.role || 'employee');
        const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || u.email || '';
        setUserName(fullName);
      }
    } catch {}
  }, []);

  // Construire le message WhatsApp selon le rôle
  const getWhatsAppLink = () => {
    const roleLabels: Record<string, string> = {
      rh: 'Responsable RH',
      admin: 'Administrateur',
      dg: 'Direction Générale',
      manager: 'Manager',
      employee: 'Employé',
    };
    const roleLabel = roleLabels[userRole] || 'Utilisateur';
    const nameText = userName ? ` ${userName}` : '';
    const msg = `Bonjour, je suis${nameText} (${roleLabel}) sur la plateforme Targetym. J'ai besoin d'assistance.`;
    return `https://wa.me/221787100606?text=${encodeURIComponent(msg)}`;
  };

  // Activer agent mode si le rôle le permet (disponible sur toutes les pages)
  useEffect(() => {
    if (canUseAgent(userRole)) setAgentMode(true);
    else setAgentMode(false);
  }, [pathname, userRole]);

  // Restaurer l'historique agent depuis localStorage (par page)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_AGENT_KEY(pathname));
      if (stored) {
        const parsed = JSON.parse(stored);
        setAgentTurns(
          parsed.map((t: any) => ({ ...t, timestamp: new Date(t.timestamp) }))
        );
      } else {
        setAgentTurns([]);
      }
    } catch {
      setAgentTurns([]);
    }
  }, [pathname]);

  // Persister les turns en localStorage à chaque mise à jour
  useEffect(() => {
    if (agentTurns.length === 0) return;
    try {
      localStorage.setItem(LS_AGENT_KEY(pathname), JSON.stringify(agentTurns));
    } catch {}
  }, [agentTurns, pathname]);

  useEffect(() => {
    checkChatbotStatus();
  }, []);

  const checkChatbotStatus = async () => {
    try {
      const status = await getChatbotStatus();
      setIsEnabled(status.enabled);
    } catch {
      setIsEnabled(true);
    }
  };

  useEffect(() => {
    if (isOpen && isEnabled && !agentMode) {
      loadConversations();
    }
  }, [isOpen, isEnabled, agentMode]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await getChatConversations();
      setConversations(data);
      if (!activeConversation && data.length > 0) {
        await loadConversation(data[0].id);
      }
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (conversationId: number) => {
    try {
      const conv = await getChatConversation(conversationId);
      setActiveConversation(conv);
      setShowConversationList(false);
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Erreur chargement conversation:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ============================================================
  // ENVOI MESSAGE AGENT
  // ============================================================
  const handleSendAgentMessage = async () => {
    if (!message.trim() || sending) return;
    const userText = message.trim();
    setMessage('');
    setSending(true);

    try {
      // Extraire PDF si nécessaire — toujours ré-extraire pour avoir tous les fichiers
      let resolvedFileText = '';
      if (attachedFiles.length > 0) {
        setExtractingPdf(true);
        try {
          let combinedText = '';
          for (const file of attachedFiles) {
            try {
              const extracted = await extractPdfText(file);
              if (extracted.text) combinedText += extracted.text + '\n\n';
              if (extracted.cv_tmp_path) setCvTmpPath(extracted.cv_tmp_path);
              if (extracted.cv_filename) setCvFilename(extracted.cv_filename);
            } catch {
              toast(`Impossible d'extraire "${file.name}". Continuez avec les autres fichiers.`, { icon: '⚠️' });
            }
          }
          resolvedFileText = combinedText.trim();
          if (!resolvedFileText) {
            toast('PDF(s) attaché(s) mais non lisible(s) (scan ?). Copiez-collez les informations directement.', { icon: '⚠️' });
          }
        } finally {
          setExtractingPdf(false);
        }
      }

      // Historique pour Claude
      const history = agentTurns.flatMap((t) => [
        { role: 'user', content: t.userText },
        { role: 'assistant', content: t.reply },
      ]);

      const result = await sendAgentMessage({
        message: userText,
        page_path: pathname,
        file_text: resolvedFileText || undefined,
        conversation_history: history,
      });

      const turn: AgentTurn = {
        id: crypto.randomUUID(),
        userText,
        reply: result.reply,
        action_preview: result.action_preview,
        timestamp: new Date(),
      };
      setAgentTurns((prev) => [...prev, turn]);
      setTimeout(() => scrollToBottom(), 50);
    } catch (error: any) {
      console.error('Agent error:', error);
      const turn: AgentTurn = {
        id: crypto.randomUUID(),
        userText,
        reply: `❌ Erreur : ${error.message || "Impossible de contacter l'assistant"}`,
        action_preview: null,
        timestamp: new Date(),
      };
      setAgentTurns((prev) => [...prev, turn]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleValidateAction = async (turn: AgentTurn) => {
    if (!turn.action_preview) return;
    // Peut lever une exception → capturée par AgentActionPreview pour afficher l'erreur
    const actionData = (turn.action_preview.tool_name === 'generate_candidate' && cvTmpPath)
      ? { ...turn.action_preview.data, cv_tmp_path: cvTmpPath, cv_filename: cvFilename }
      : turn.action_preview.data;
    const result = await executeAgentAction({
      action_type: turn.action_preview.tool_name,
      data: actionData,
    });
    // Retirer l'action preview
    setAgentTurns((prev) =>
      prev.map((t) => t.id === turn.id ? { ...t, action_preview: null } : t)
    );
    // Ajouter un turn de confirmation dans le chat
    const confirmTurn: AgentTurn = {
      id: crypto.randomUUID(),
      userText: '',
      reply: `✅ **${result.message || 'Insertion réussie !'}**`,
      action_preview: null,
      timestamp: new Date(),
    };
    setAgentTurns((prev) => [...prev, confirmTurn]);
    setTimeout(() => scrollToBottom(), 50);

    // Notifier la page courante pour qu'elle rafraîchisse ses données
    const actionType = turn.action_preview?.tool_name;
    if (actionType === 'generate_candidate' || actionType === 'generate_job_posting') {
      window.dispatchEvent(new CustomEvent('recruitment:data-changed'));
    }
  };

  const handleCancelAction = (turnId: string) => {
    setAgentTurns((prev) =>
      prev.map((t) => t.id === turnId ? { ...t, action_preview: null } : t)
    );
  };

  // ============================================================
  // ENVOI MESSAGE CLASSIQUE
  // ============================================================
  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;
    if (agentMode) return handleSendAgentMessage();

    const userMessage = message.trim();
    setMessage('');
    setSending(true);

    try {
      const response = await sendChatMessage({
        content: userMessage,
        conversation_id: activeConversation?.id
      });

      if (!activeConversation) {
        await loadConversations();
      } else {
        await loadConversation(response.conversation_id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleNewConversation = () => {
    setActiveConversation(null);
    setShowConversationList(false);
    setMessage('');
    setAgentTurns([]);
    setAttachedFiles([]);
    setFileText('');
    setCvTmpPath(null);
    setCvFilename(null);
    // Effacer l'historique agent persistant pour cette page
    try { localStorage.removeItem(LS_AGENT_KEY(pathname)); } catch {}
    inputRef.current?.focus();
  };

  const handleDeleteConversation = async (conversationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer la conversation',
      message: 'Voulez-vous vraiment supprimer cette conversation ?',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteChatConversation(conversationId);
          if (activeConversation?.id === conversationId) setActiveConversation(null);
          await loadConversations();
        } catch (error: any) {
          toast.error(error.message || 'Erreur lors de la suppression');
        }
      },
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls', '.csv'];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files || []);
    const validFiles = allFiles.filter(f => ACCEPTED_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext)));
    const rejected = allFiles.filter(f => !ACCEPTED_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (rejected.length > 0) toast.error('Formats acceptés : PDF, DOCX, DOC, TXT, XLSX, XLS, CSV.');
    if (validFiles.length === 0) return;
    setAttachedFiles(prev => [...prev, ...validFiles]);
    setFileText(''); // reset, sera extrait à l'envoi
    setCvTmpPath(null);
    setCvFilename(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {/* Bouton flottant */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-all hover:scale-110 z-50"
          aria-label="Ouvrir le chatbot"
        >
          <MessageCircle size={28} />
        </button>
      )}

      {/* Fenêtre du chat */}
      {isOpen && (
        <div id="ai-chatbox" className="fixed inset-x-2 bottom-16 top-14 lg:inset-auto lg:right-6 lg:bottom-6 lg:w-[420px] lg:h-[620px] rounded-2xl bg-white shadow-2xl flex flex-col z-50 border border-gray-200">

          {/* Header */}
          <div className={`${agentMode ? 'bg-gradient-to-r from-primary-600 to-primary-700' : 'bg-gradient-to-r from-primary-500 to-primary-700'} text-white px-4 py-3 lg:px-5 lg:py-4 rounded-t-2xl flex items-center justify-between`}>
            <div className="flex items-center gap-2 lg:gap-3 min-w-0">
              <div className="bg-white/20 p-1.5 lg:p-2 rounded-lg shrink-0">
                {agentMode ? <Zap size={20} /> : <MessageCircle size={20} />}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm lg:text-base leading-tight">
                  {agentMode ? 'Targetym AI' : 'Targetym AI'}
                </h3>
                {agentMode && (
                  <p className="text-[10px] lg:text-[11px] text-white/70 truncate">Génération · Prévisualisation · Insertion</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Bouton toggle agent : visible uniquement si le rôle permet le mode agent sur cette page */}
              {canUseAgent(userRole) && (
                <button
                  onClick={() => { setAgentMode(!agentMode); setAgentTurns([]); }}
                  className={`p-2 rounded-lg text-xs transition-colors flex items-center gap-1 ${agentMode ? 'bg-white/20 hover:bg-white/30' : 'hover:bg-white/10'}`}
                  title={agentMode ? 'Passer en chat classique' : 'Passer en mode agent'}
                >
                  <Zap size={15} />
                </button>
              )}
              {!agentMode && (
                <>
                  <button
                    onClick={() => setShowConversationList(!showConversationList)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Historique"
                  >
                    <MessageSquare size={17} />
                  </button>
                </>
              )}
              <button
                onClick={handleNewConversation}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Nouvelle conversation"
              >
                <Plus size={17} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X size={19} />
              </button>
            </div>
          </div>

          {/* Liste conversations (mode classique) */}
          {!agentMode && showConversationList && (
            <div className="border-b border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Aucune conversation</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`px-4 py-3 hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-between group ${
                        activeConversation?.id === conv.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-gray-900">
                          {conv.title || 'Conversation sans titre'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {conv.message_count || 0} message{(conv.message_count || 0) > 1 ? 's' : ''}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="p-1.5 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Zone des messages */}
          <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4 bg-gray-50">
            {!isEnabled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 font-medium">⚠️ Chatbot non configuré</p>
                <p className="text-xs text-yellow-700 mt-1">La clé API Anthropic n'est pas configurée.</p>
              </div>
            )}

            {/* ---- MODE AGENT ---- */}
            {agentMode ? (
              agentTurns.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center px-4 lg:px-6">
                  <div>
                    <div className="bg-primary-100 w-14 lg:w-16 h-14 lg:h-16 rounded-full flex items-center justify-center mx-auto mb-3 lg:mb-4">
                      <Zap size={28} className="text-primary-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">Mode Agent — {agentContext || 'Général'}</h4>
                    <p className="text-xs lg:text-sm text-gray-600">
                      Décrivez ce que vous souhaitez créer. Je générerai le contenu et vous pourrez le valider avant l&apos;insertion.
                    </p>
                    <p className="text-[11px] lg:text-xs text-gray-400 mt-2">
                      💡 Joignez un PDF pour me donner plus de contexte
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {agentTurns.map((turn) => (
                    <div key={turn.id} className="space-y-2">
                      {/* User - masqué si turn de confirmation système (userText vide) */}
                      {turn.userText && (
                        <div className="flex justify-end">
                          <div className="max-w-[85%] bg-primary-600 text-white rounded-2xl px-4 py-2.5">
                            <p className="text-sm">{turn.userText}</p>
                            <p className="text-[11px] text-indigo-200 mt-1">
                              {turn.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Assistant */}
                      <div className="flex justify-start">
                        <div className="max-w-[90%] bg-white text-gray-900 border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm">
                          <ChatMessageContent content={turn.reply} isUser={false} />
                          {/* Prévisualisation de l'action */}
                          {turn.action_preview && (
                            <AgentActionPreview
                              preview={turn.action_preview}
                              onValidate={() => handleValidateAction(turn)}
                              onCancel={() => handleCancelAction(turn.id)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {(sending || extractingPdf) && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-sm">
                            {extractingPdf ? 'Lecture du PDF...' : 'Agent en réflexion...'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )
            ) : (
              /* ---- MODE CLASSIQUE ---- */
              !activeConversation ? (
                <div className="h-full flex items-center justify-center text-center px-4 lg:px-6">
                  <div>
                    <div className="bg-primary-100 w-14 lg:w-16 h-14 lg:h-16 rounded-full flex items-center justify-center mx-auto mb-3 lg:mb-4">
                      <MessageCircle size={28} className="text-primary-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">Bonjour ! 👋</h4>
                    <p className="text-xs lg:text-sm text-gray-600">
                      Je suis votre assistant RH. Posez-moi des questions sur vos congés,
                      objectifs, tâches, ou formations !
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {activeConversation.messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-primary-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
                      }`}>
                        <ChatMessageContent content={msg.content} isUser={msg.role === 'user'} />
                        <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-sm">Réflexion en cours...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )
            )}
          </div>

          {/* Boutons de contact (mode classique seulement) */}
          {!agentMode && (
            <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 flex items-center gap-2 text-xs">
              <span className="text-gray-600">Besoin d'un agent ?</span>
              <a href="mailto:support@agiltym.com" className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium">
                <Mail size={14} />Email
              </a>
              <span className="text-gray-300">|</span>
              <a
                href={getWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-green-600 hover:text-green-700 font-medium"
              >
                <MessageSquare size={14} />WhatsApp
              </a>
            </div>
          )}

          {/* Fichiers attachés (mode agent) */}
          {agentMode && attachedFiles.length > 0 && (
            <div className="px-4 py-1.5 bg-primary-50 border-t border-primary-100 flex flex-col gap-1">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-primary-700">
                  <FileText size={13} />
                  <span className="flex-1 truncate">{file.name}</span>
                  <button
                    onClick={() => {
                      setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
                      setFileText('');
                      if (attachedFiles.length === 1) { setCvTmpPath(null); setCvFilename(null); }
                    }}
                    className="text-primary-400 hover:text-red-500"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Zone de saisie */}
          <div className="p-3 lg:p-4 bg-white border-t border-gray-200 rounded-b-2xl">
            <div className="flex items-end gap-2">
              {/* Upload PDF (mode agent seulement) */}
              {agentMode && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2.5 rounded-xl border transition-colors flex-shrink-0 ${
                      attachedFiles.length > 0
                        ? 'bg-primary-100 border-primary-300 text-primary-700'
                        : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                    title="Joindre un fichier (PDF, Excel, CSV, DOCX, TXT)"
                  >
                    <Paperclip size={18} />
                  </button>
                </>
              )}

              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={agentMode ? 'Décrivez ce que vous souhaitez générer...' : 'Posez votre question...'}
                className={`flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
                  agentMode
                    ? 'border-primary-300 focus:ring-primary-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
                rows={1}
                style={{ minHeight: '42px', maxHeight: '120px', height: 'auto' }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = t.scrollHeight + 'px';
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || sending}
                className={`p-2.5 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 ${
                  agentMode ? 'bg-primary-600 hover:bg-primary-700' : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
          danger={confirmDialog.danger}
        />
      )}
    </>
  );
}
