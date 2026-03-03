'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle, X, Send, Trash2, Plus, Mail, MessageSquare, Loader2
} from 'lucide-react';
import {
  getChatConversations, sendChatMessage, deleteChatConversation,
  getChatConversation, getChatbotStatus,
  type ChatConversation, type ChatMessage, type ChatConversationWithMessages
} from '@/lib/api';

export default function AIChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversationWithMessages | null>(null);
  const [showConversationList, setShowConversationList] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Vérifier si le chatbot est activé
  useEffect(() => {
    checkChatbotStatus();
  }, []);

  const checkChatbotStatus = async () => {
    try {
      const status = await getChatbotStatus();
      console.log('Chatbot status:', status);
      setIsEnabled(status.enabled);
    } catch (error) {
      console.error('Erreur vérification chatbot:', error);
      // Activer quand même pour le debug
      setIsEnabled(true);
    }
  };

  // Charger les conversations quand on ouvre le chat
  useEffect(() => {
    if (isOpen && isEnabled) {
      loadConversations();
    }
  }, [isOpen, isEnabled]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await getChatConversations();
      setConversations(data);
      
      // Si pas de conversation active, charger la plus récente
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
      
      // Scroll vers le bas après chargement
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Erreur chargement conversation:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    const userMessage = message.trim();
    setMessage('');
    setSending(true);

    try {
      // Envoyer le message (créera une nouvelle conversation si nécessaire)
      const response = await sendChatMessage({
        content: userMessage,
        conversation_id: activeConversation?.id
      });

      // Si nouvelle conversation, recharger la liste
      if (!activeConversation) {
        await loadConversations();
      } else {
        // Sinon, recharger juste la conversation active
        await loadConversation(response.conversation_id);
      }
    } catch (error: any) {
      alert(error.message || 'Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleNewConversation = () => {
    setActiveConversation(null);
    setShowConversationList(false);
    setMessage('');
    inputRef.current?.focus();
  };

  const handleDeleteConversation = async (conversationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Supprimer cette conversation ?')) return;

    try {
      await deleteChatConversation(conversationId);
      
      // Si c'était la conversation active, la désélectionner
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
      }
      
      await loadConversations();
    } catch (error: any) {
      alert(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Si le chatbot n'est pas activé, afficher quand même en mode debug
  // if (!isEnabled) return null;

  return (
    <>
      {/* Bouton flottant */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 z-50"
          aria-label="Ouvrir le chatbot"
        >
          <MessageCircle size={28} />
        </button>
      )}

      {/* Fenêtre du chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <MessageCircle size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Assistant Targetym</h3>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConversationList(!showConversationList)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Historique"
              >
                <MessageSquare size={18} />
              </button>
              <button
                onClick={handleNewConversation}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Nouvelle conversation"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Liste des conversations (sidebar) */}
          {showConversationList && (
            <div className="border-b border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Aucune conversation
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`px-4 py-3 hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-between group ${
                        activeConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {!isEnabled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 font-medium">⚠️ Chatbot non configuré</p>
                <p className="text-xs text-yellow-700 mt-1">
                  La clé API Anthropic n'est pas configurée sur Railway.
                </p>
              </div>
            )}
            {!activeConversation ? (
              <div className="h-full flex items-center justify-center text-center px-6">
                <div>
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle size={32} className="text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Bonjour ! 👋</h4>
                  <p className="text-sm text-gray-600">
                    Je suis votre assistant RH. Posez-moi des questions sur vos congés, 
                    objectifs, tâches, ou formations !
                  </p>
                </div>
              </div>
            ) : (
              <>
                {activeConversation.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${
                        msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}>
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
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
            )}
          </div>

          {/* Boutons de contact */}
          <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 flex items-center gap-2 text-xs">
            <span className="text-gray-600">Besoin de parler à un agent ?</span>
            <a
              href="mailto:support@targetym.com"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
            >
              <Mail size={14} />
              Email
            </a>
            <span className="text-gray-300">|</span>
            <a
              href="https://wa.me/33XXXXXXXXX"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-green-600 hover:text-green-700 font-medium"
            >
              <MessageSquare size={14} />
              WhatsApp
            </a>
          </div>

          {/* Zone de saisie */}
          <div className="p-4 bg-white border-t border-gray-200 rounded-b-2xl">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Posez votre question..."
                className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                style={{
                  minHeight: '42px',
                  maxHeight: '120px',
                  height: 'auto',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || sending}
                className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                {sending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
