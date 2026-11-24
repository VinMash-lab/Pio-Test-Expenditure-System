import React, { useState, useEffect, useRef } from 'react';
import {
  ChatMessage,
  ChatbotRole,
  CHATBOT_ROLES,
  CHAT_MODELS,
  GeminiChatService,
} from '../services/geminiChatService';
import { LegalEntityFilter } from '../types';
import { DatabaseService } from '../services/db';
import { confirmDialog } from '../services/uiFeedback';

interface GeminiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  legalEntityFilter: LegalEntityFilter;
  onNavigateToTab?: (tab: string) => void;
}

export const GeminiChatModal: React.FC<GeminiChatModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  legalEntityFilter,
  onNavigateToTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Load from sessionStorage if available
    try {
      const saved = sessionStorage.getItem('erp_gemini_chat_history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved chat history:', e);
    }
    return [
      {
        id: 'welcome-1',
        role: 'model',
        text: `**Welcome to the Gemini Financial & Procurement Advisor.**\n\nI am your AI assistant grounded in Pioneer Assurance Company Limited (PACL) and Pioneer General Insurance Limited (PGIL) financial data. How can I assist you with budget allocations, spend tracking, or procurement audits today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-4-hydrogen',
        contextAttached: true,
      },
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [selectedRole, setSelectedRole] = useState<ChatbotRole>('financial_controller');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-hydrogen');
  const [includeContext, setIncludeContext] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [entityScope, setEntityScope] = useState<LegalEntityFilter>(legalEntityFilter);
  const [showLiveSnapshot, setShowLiveSnapshot] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEntityScope(legalEntityFilter);
  }, [legalEntityFilter]);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isLoading]);

  // Persist messages in sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('erp_gemini_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat history:', e);
    }
  }, [messages]);

  const activeRoleDef = CHATBOT_ROLES[selectedRole];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Format history for API (filter out welcome system message if desired, or send all)
      const apiMessages = newHistory
        .filter(m => m.id !== 'welcome-1')
        .map(m => ({
          role: m.role,
          text: m.text,
        }));

      // Ensure at least the current user message is sent
      if (apiMessages.length === 0) {
        apiMessages.push({ role: 'user', text });
      }

      const response = await GeminiChatService.sendChatMessage({
        messages: apiMessages,
        role: selectedRole,
        model: selectedModel,
        includeContext,
        activeTab,
        entityFilter: entityScope,
      });

      const assistantMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: response.modelUsed,
        contextAttached: includeContext,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorMessage(err.message || 'Failed to communicate with Gemini. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = async () => {
    const confirmed = await confirmDialog({
      title: 'Clear Chat History',
      message: 'Clear current conversation history?',
      confirmLabel: 'Clear History',
      variant: 'warning',
    });
    if (confirmed) {
      const resetMessages: ChatMessage[] = [
        {
          id: `welcome-${Date.now()}`,
          role: 'model',
          text: `**Conversation cleared.**\n\nI am ready with your selected role: **${activeRoleDef.name}** (${activeRoleDef.title}). How may I assist you with your budget management?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: selectedModel,
          contextAttached: includeContext,
        },
      ];
      setMessages(resetMessages);
      sessionStorage.removeItem('erp_gemini_chat_history');
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleExportChat = () => {
    const transcript = messages
      .map(m => `[${m.timestamp}] ${m.role === 'user' ? 'YOU' : 'GEMINI (' + (m.modelUsed || selectedModel) + ')'}:\n${m.text}\n`)
      .join('\n---\n\n');
    
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Gemini_Chat_Transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to render basic markdown formatting cleanly
  const renderFormattedContent = (content: string) => {
    // Process markdown code blocks or lines
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h6 key={idx} className="fw-bold text-dark mt-2 mb-1">{line.replace('### ', '')}</h6>;
      }
      if (line.startsWith('## ')) {
        return <h5 key={idx} className="fw-bold text-primary mt-2 mb-1">{line.replace('## ', '')}</h5>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const bulletText = line.substring(2);
        return (
          <div key={idx} className="d-flex align-items-start ms-2 my-1">
            <span className="me-2 text-primary">•</span>
            <span>{renderInlineMarkdown(bulletText)}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <div key={idx} className="ms-2 my-1">
            {renderInlineMarkdown(line)}
          </div>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="py-1"></div>;
      }
      return <p key={idx} className="mb-1">{renderInlineMarkdown(line)}</p>;
    });
  };

  const renderInlineMarkdown = (text: string) => {
    // Basic regex for bold **text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="fw-bold text-dark">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-light text-danger px-1 rounded">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const summary = DatabaseService.getFinancialSummary(entityScope);

  if (!isOpen) return null;

  return (
    <div
      className="position-fixed"
      style={{
        zIndex: 1060,
        bottom: isMaximized ? '0' : '20px',
        right: isMaximized ? '0' : '20px',
        width: isMaximized ? '100vw' : '460px',
        maxWidth: 'calc(100vw - 30px)',
        height: isMaximized ? '100vh' : '650px',
        maxHeight: 'calc(100vh - 40px)',
        transition: 'all 0.25s ease-in-out',
      }}
    >
      <div
        className="card shadow-lg border-0 d-flex flex-column h-100 overflow-hidden"
        style={{
          borderRadius: isMaximized ? '0' : '16px',
          backgroundColor: '#ffffff',
          border: '1px solid rgba(13, 110, 253, 0.2)',
        }}
      >
        {/* Header */}
        <div
          className="card-header bg-dark text-white px-3 py-2 d-flex align-items-center justify-content-between border-0"
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white shadow-sm"
              style={{ width: '32px', height: '32px' }}
            >
              <i className={`bi ${activeRoleDef.avatarIcon} fs-6`}></i>
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold fs-6 text-white">Gemini Financial Advisor</span>
                <span className="badge bg-primary bg-opacity-75" style={{ fontSize: '0.65rem' }}>
                  AI Studio
                </span>
              </div>
              <div className="text-secondary" style={{ fontSize: '0.72rem' }}>
                {activeRoleDef.name} • {selectedModel}
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-1">
            <button
              className="btn btn-sm btn-outline-light border-0 py-1 px-2"
              onClick={handleExportChat}
              title="Export Conversation Transcript"
            >
              <i className="bi bi-download"></i>
            </button>
            <button
              className="btn btn-sm btn-outline-light border-0 py-1 px-2"
              onClick={handleClearChat}
              title="Clear Conversation"
            >
              <i className="bi bi-trash"></i>
            </button>
            <button
              className="btn btn-sm btn-outline-light border-0 py-1 px-2"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restore Size' : 'Maximize Window'}
            >
              <i className={`bi ${isMaximized ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`}></i>
            </button>
            <button
              className="btn btn-sm btn-outline-light border-0 py-1 px-2"
              onClick={onClose}
              title="Close Chat"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* Role & Model Configuration Ribbon */}
        <div className="bg-light border-bottom px-3 py-2 d-flex flex-column gap-2">
          {/* Role Pills */}
          <div className="d-flex align-items-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {(Object.keys(CHATBOT_ROLES) as ChatbotRole[]).map(roleKey => {
              const role = CHATBOT_ROLES[roleKey];
              const isSelected = selectedRole === roleKey;
              return (
                <button
                  key={roleKey}
                  type="button"
                  className={`btn btn-sm text-nowrap py-1 px-2 ${
                    isSelected
                      ? `btn-${role.badgeColor} shadow-sm text-white fw-semibold`
                      : 'btn-outline-secondary bg-white'
                  }`}
                  style={{ fontSize: '0.72rem', borderRadius: '20px' }}
                  onClick={() => setSelectedRole(roleKey)}
                  title={role.description}
                >
                  <i className={`bi ${role.avatarIcon} me-1`}></i>
                  {role.name}
                </button>
              );
            })}
          </div>

          {/* Model, Entity Scope & Live Context Controls */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pt-1 border-top" style={{ fontSize: '0.75rem' }}>
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted fw-semibold">Model:</span>
              <select
                className="form-select form-select-sm py-0 px-2 text-dark bg-white border"
                style={{ fontSize: '0.75rem', width: 'auto', height: '24px' }}
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                {CHAT_MODELS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.badge})
                  </option>
                ))}
              </select>
            </div>

            <div className="btn-group btn-group-sm" role="group" aria-label="Entity Scope">
              {(['All', 'PACL', 'PGIL'] as LegalEntityFilter[]).map(ent => (
                <button
                  key={ent}
                  type="button"
                  className={`btn py-0 px-2 ${entityScope === ent ? 'btn-primary fw-semibold' : 'btn-outline-secondary bg-white'}`}
                  style={{ fontSize: '0.7rem', height: '24px' }}
                  onClick={() => setEntityScope(ent)}
                >
                  {ent}
                </button>
              ))}
            </div>

            <div className="form-check form-switch m-0 d-flex align-items-center gap-1">
              <input
                className="form-check-input mt-0"
                type="checkbox"
                id="toggleContext"
                checked={includeContext}
                onChange={e => setIncludeContext(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <label
                className="form-check-label text-muted user-select-none"
                htmlFor="toggleContext"
                title="Attaches real-time financial metrics, active filters, and current screen data"
              >
                {includeContext ? (
                  <span className="text-success fw-semibold">
                    <i className="bi bi-broadcast me-1"></i>Live Context
                  </span>
                ) : (
                  <span className="text-secondary">Context Off</span>
                )}
              </label>
            </div>
          </div>

          {/* Context Badge Ribbon + Live Snapshot Toggle */}
          {includeContext && (
            <div className="d-flex flex-column gap-1">
              <div className="d-flex align-items-center gap-2 bg-white rounded border px-2 py-1" style={{ fontSize: '0.7rem' }}>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                  <i className="bi bi-window-sidebar me-1"></i>Screen: {activeTab.toUpperCase()}
                </span>
                <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
                  <i className="bi bi-buildings me-1"></i>Scope: {entityScope}
                </span>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 ms-auto text-decoration-none fw-semibold"
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => setShowLiveSnapshot(prev => !prev)}
                >
                  <i className={`bi ${showLiveSnapshot ? 'bi-chevron-up' : 'bi-database-check'} me-1`}></i>
                  {showLiveSnapshot ? 'Hide Snapshot' : 'Live Snapshot'}
                </button>
              </div>

              {showLiveSnapshot && (
                <div className="bg-white rounded border p-2 d-flex flex-column gap-2" style={{ fontSize: '0.72rem' }}>
                  <div className="row g-1 text-center">
                    <div className="col-3">
                      <div className="bg-light rounded p-1 border">
                        <div className="text-muted" style={{ fontSize: '0.62rem' }}>Allocated</div>
                        <div className="fw-bold text-dark text-truncate">
                          {(summary.totalBudget || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="bg-light rounded p-1 border">
                        <div className="text-muted" style={{ fontSize: '0.62rem' }}>Spent</div>
                        <div className="fw-bold text-primary text-truncate">
                          {(summary.totalSpend || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="bg-light rounded p-1 border">
                        <div className="text-muted" style={{ fontSize: '0.62rem' }}>Balance</div>
                        <div className="fw-bold text-success text-truncate">
                          {(summary.remainingBalance || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="bg-light rounded p-1 border">
                        <div className="text-muted" style={{ fontSize: '0.62rem' }}>LPOs</div>
                        <div className="fw-bold text-dark text-truncate">
                          {(summary.committedSpend || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  {onNavigateToTab && (
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm py-0 px-2 w-100"
                        style={{ fontSize: '0.7rem' }}
                        onClick={() => {
                          onNavigateToTab('budget_vs_actual');
                          onClose();
                        }}
                      >
                        <i className="bi bi-bar-chart-line me-1"></i>View Variance
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm py-0 px-2 w-100"
                        style={{ fontSize: '0.7rem' }}
                        onClick={() => {
                          onNavigateToTab('data_validation');
                          onClose();
                        }}
                      >
                        <i className="bi bi-shield-check me-1"></i>Run Audit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Messages Scrollable Thread */}
        <div
          className="card-body p-3 overflow-y-auto flex-grow-1"
          style={{
            backgroundColor: '#f8fafc',
            scrollBehavior: 'smooth',
          }}
        >
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`d-flex flex-column mb-3 ${isUser ? 'align-items-end' : 'align-items-start'}`}
              >
                <div className="d-flex align-items-center gap-1 mb-1">
                  {!isUser && (
                    <span className="badge bg-primary-subtle text-primary px-1 py-0" style={{ fontSize: '0.65rem' }}>
                      <i className={`bi ${activeRoleDef.avatarIcon} me-1`}></i>
                      {activeRoleDef.name}
                    </span>
                  )}
                  <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                    {msg.timestamp}
                  </span>
                  {!isUser && msg.modelUsed && (
                    <span className="badge bg-light text-muted border px-1 py-0" style={{ fontSize: '0.62rem' }}>
                      {msg.modelUsed}
                    </span>
                  )}
                  {!isUser && (
                    <button
                      className="btn btn-link text-muted p-0 ms-1 border-0"
                      onClick={() => handleCopyMessage(msg.id, msg.text)}
                      title="Copy response text"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className={`bi ${copiedMessageId === msg.id ? 'bi-check-lg text-success' : 'bi-clipboard'}`}></i>
                    </button>
                  )}
                </div>

                <div
                  className={`p-3 rounded-3 shadow-sm ${
                    isUser
                      ? 'bg-primary text-white'
                      : 'bg-white text-dark border'
                  }`}
                  style={{
                    maxWidth: '88%',
                    fontSize: '0.86rem',
                    lineHeight: '1.5',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    wordBreak: 'break-word',
                  }}
                >
                  {isUser ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  ) : (
                    <div>{renderFormattedContent(msg.text)}</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading wave indicator */}
          {isLoading && (
            <div className="d-flex flex-column align-items-start mb-3">
              <div className="d-flex align-items-center gap-1 mb-1">
                <span className="badge bg-primary-subtle text-primary px-1 py-0" style={{ fontSize: '0.65rem' }}>
                  <i className="bi bi-cpu me-1"></i>Thinking...
                </span>
                <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                  {selectedModel}
                </span>
              </div>
              <div
                className="bg-white border rounded-3 p-3 shadow-sm d-flex align-items-center gap-2"
                style={{ borderRadius: '16px 16px 16px 2px', fontSize: '0.85rem' }}
              >
                <div className="spinner-grow spinner-grow-sm text-primary" role="status"></div>
                <span className="text-muted">Analyzing financial records & synthesizing response...</span>
              </div>
            </div>
          )}

          {/* Error notice */}
          {errorMessage && (
            <div className="alert alert-danger py-2 px-3 my-2 d-flex align-items-center justify-content-between" style={{ fontSize: '0.78rem' }}>
              <div>
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {errorMessage}
              </div>
              <button className="btn btn-sm btn-link text-danger p-0" onClick={() => setErrorMessage(null)}>
                Dismiss
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts Accordion / Quick Chips */}
        <div className="bg-light px-3 py-2 border-top">
          <div className="d-flex align-items-center justify-content-between mb-1">
            <span className="text-muted fw-semibold" style={{ fontSize: '0.7rem' }}>
              <i className="bi bi-lightbulb me-1 text-warning"></i>Suggested Questions for {activeRoleDef.name}:
            </span>
          </div>
          <div className="d-flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {activeRoleDef.suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-outline-secondary btn-sm bg-white text-nowrap py-1 px-2 text-start"
                style={{ fontSize: '0.72rem', borderRadius: '12px' }}
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Input Footer */}
        <div className="card-footer bg-white border-top p-3">
          <div className="input-group">
            <textarea
              ref={inputRef}
              className="form-control"
              placeholder={`Ask ${activeRoleDef.name} about budgets, allocations, LPOs...`}
              rows={2}
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              style={{
                resize: 'none',
                fontSize: '0.85rem',
                borderRadius: '8px 0 0 8px',
              }}
            />
            <button
              className="btn btn-primary d-flex align-items-center justify-content-center px-3"
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputMessage.trim()}
              title="Send message (Enter)"
              style={{ borderRadius: '0 8px 8px 0' }}
            >
              {isLoading ? (
                <span className="spinner-border spinner-border-sm" role="status"></span>
              ) : (
                <i className="bi bi-send-fill fs-6"></i>
              )}
            </button>
          </div>
          <div className="d-flex align-items-center justify-content-between mt-2" style={{ fontSize: '0.68rem' }}>
            <span className="text-muted">
              Press <strong>Enter</strong> to send • <strong>Shift + Enter</strong> for line break
            </span>
            <span className="text-muted">
              Grounded in KES • PACL/PGIL Enterprise Data
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
