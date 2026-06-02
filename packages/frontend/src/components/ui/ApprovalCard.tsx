import React, { useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';

interface AgentOutputItem {
  id: string;
  agent_name: string;
  output_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

interface ApprovalCardProps {
  item: AgentOutputItem;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
}

export function ApprovalCard({ item, onApprove, onReject }: ApprovalCardProps) {
  const [status, setStatus] = useState<'pending' | 'approving' | 'rejecting' | 'approved' | 'rejected'>('pending');

  const handleApprove = async () => {
    setStatus('approving');
    try { await onApprove?.(item.id); setStatus('approved'); }
    catch { setStatus('pending'); }
  };

  const handleReject = async () => {
    setStatus('rejecting');
    try { await onReject?.(item.id); setStatus('rejected'); }
    catch { setStatus('pending'); }
  };

  const agentLabel = item.agent_name.replace(/_/g, ' ').replace(/agent/gi, '').trim();

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: `1px solid ${status === 'approved' ? 'var(--status-green)' : status === 'rejected' ? 'var(--border-default)' : 'var(--status-amber)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      marginBottom: 'var(--space-4)',
      opacity: status === 'rejected' ? 0.5 : 1,
      transition: 'all var(--transition-normal)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <SeverityBadge severity={item.severity as any} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {agentLabel} Agent
          </span>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
          <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
          {new Date(item.created_at).toLocaleTimeString()}
        </span>
      </div>

      <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
        {item.title}
      </h4>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--space-4)' }}>
        {item.body}
      </p>

      {status === 'approved' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-green)', fontSize: 'var(--text-sm)' }}>
          <Check size={14} /> Approved and executed
        </div>
      ) : status === 'rejected' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
          <X size={14} /> Rejected
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-primary" onClick={handleApprove} disabled={status !== 'pending'} style={{ flex: 1, justifyContent: 'center' }}>
            <Check size={14} />
            {status === 'approving' ? 'Approving...' : 'Approve'}
          </button>
          <button className="btn btn-secondary" onClick={handleReject} disabled={status !== 'pending'} style={{ flex: 1, justifyContent: 'center' }}>
            <X size={14} />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
