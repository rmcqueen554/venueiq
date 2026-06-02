import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, X, Loader2 } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAppStore } from '../../store/appStore';
const SESSION_ID = crypto.randomUUID();

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  '/dashboard': [
    'What is our projected revenue for the next event?',
    'Which departments are underperforming right now?',
    'What operational risks should I know about tonight?',
  ],
  '/concessions': [
    'Why were concession sales down last night?',
    'What inventory should we order for Saturday\'s game?',
    'Which stands are most at risk of stocking out?',
  ],
  '/ticketing': [
    'How is ticket sales velocity tracking vs. comparable events?',
    'Which season ticket accounts are most at risk of not renewing?',
  ],
  '/security': [
    'What are the highest risk areas for tonight?',
    'What is our current crowd density situation?',
  ],
  '/sponsorship': [
    'Which sponsors are underperforming against contracted deliverables?',
    'Which sponsor contracts expire in the next 60 days?',
  ],
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

export function AIChatPanel() {
  const location = useLocation();
  const { tenant } = useAppStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestedQuestions = SUGGESTED_QUESTIONS[location.pathname] ?? SUGGESTED_QUESTIONS['/dashboard'];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendQuestion = useCallback(async (question: string) => {
    if (!question.trim() || isStreaming) return;
    setInput('');

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    const assistantMsg: Message = { role: 'assistant', content: '', loading: true };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsStreaming(true);

    try {
      const resp = await fetch(`${import.meta.env.VITE_NLQ_API_URL ?? '/api/nlq'}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          session_id: SESSION_ID,
          context_page: location.pathname,
          tenant_id: tenant?.id,
        }),
      });

      if (!resp.body) throw new Error('No stream');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'token' && event.content) {
              fullContent += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullContent, loading: false };
                return updated;
              });
            }
            if (event.type === 'done') break;
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', loading: false };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, location.pathname, tenant?.id]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-default)',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-4) var(--space-5)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>AI Advisor</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Powered by Claude</div>
        </div>
        <div style={{
          width: 8, height: 8,
          borderRadius: '50%',
          background: isStreaming ? 'var(--status-amber)' : 'var(--status-green)',
        }} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
        {messages.length === 0 ? (
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Suggested questions
            </div>
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => sendQuestion(q)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-3)',
                  marginBottom: 'var(--space-2)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  lineHeight: 'var(--leading-normal)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {q}
              </button>
            ))}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{
              marginBottom: 'var(--space-4)',
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '90%',
                background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--surface-raised)',
                border: `1px solid ${msg.role === 'user' ? 'var(--accent)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                lineHeight: 'var(--leading-relaxed)',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Thinking...
                  </span>
                ) : msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderTop: '1px solid var(--border-default)',
      }}>
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius)',
          padding: '8px 12px',
          transition: 'border-color var(--transition-fast)',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendQuestion(input);
              }
            }}
            placeholder="Ask anything about your venue..."
            rows={2}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              resize: 'none',
              fontFamily: 'var(--font-body)',
              lineHeight: 'var(--leading-normal)',
            }}
          />
          <button
            onClick={() => sendQuestion(input)}
            disabled={!input.trim() || isStreaming}
            style={{
              background: input.trim() && !isStreaming ? 'var(--accent)' : 'var(--surface-raised)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
              color: input.trim() && !isStreaming ? '#000' : 'var(--text-tertiary)',
              flexShrink: 0,
              alignSelf: 'flex-end',
            }}
          >
            <Send size={14} />
          </button>
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'center' }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
