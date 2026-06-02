import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle, ChevronRight, X } from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';

interface RiskOpportunityItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  module: string;
  title: string;
  description: string;
  recommended_action: string;
  created_at: string;
}

interface RiskFeedItemProps {
  item: RiskOpportunityItem;
  onAct?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const SEVERITY_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: Info,
  low: CheckCircle,
};

export function RiskFeedItem({ item, onAct, onDismiss }: RiskFeedItemProps) {
  const Icon = SEVERITY_ICONS[item.severity] ?? Info;

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-default)',
      borderLeft: `3px solid ${item.severity === 'critical' ? 'var(--status-red)' : item.severity === 'high' ? 'var(--status-amber)' : item.severity === 'medium' ? 'var(--status-blue)' : 'var(--status-green)'}`,
      borderRadius: 'var(--radius)',
      padding: 'var(--space-4)',
      marginBottom: 'var(--space-3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <Icon size={16} style={{
          color: item.severity === 'critical' ? 'var(--status-red)' : item.severity === 'high' ? 'var(--status-amber)' : item.severity === 'medium' ? 'var(--status-blue)' : 'var(--status-green)',
          marginTop: 2,
          flexShrink: 0,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)', flexWrap: 'wrap' }}>
            <SeverityBadge severity={item.severity} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {item.module}
            </span>
          </div>

          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
            {item.description}
          </p>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', marginBottom: 'var(--space-3)' }}>
            → {item.recommended_action}
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {onAct && (
              <button className="btn btn-primary" style={{ fontSize: 'var(--text-xs)', padding: '4px 12px' }} onClick={() => onAct(item.id)}>
                Act
              </button>
            )}
            {onDismiss && (
              <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: '4px 10px' }} onClick={() => onDismiss(item.id)}>
                <X size={12} />
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
