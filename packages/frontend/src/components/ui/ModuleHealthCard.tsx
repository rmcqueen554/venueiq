import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusDot } from './StatusDot';

interface ModuleHealthCardProps {
  module: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  status: 'healthy' | 'warning' | 'critical';
  topKpiLabel: string;
  topKpiValue: string;
  aiSummary: string;
  path: string;
}

export function ModuleHealthCard({
  module, label, icon: Icon, status, topKpiLabel, topKpiValue, aiSummary, path
}: ModuleHealthCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="card"
      onClick={() => navigate(path)}
      style={{ cursor: 'pointer', transition: 'all var(--transition-fast)' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Icon size={16} style={{ color: 'var(--text-tertiary)' }} />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
        </div>
        <StatusDot status={status} />
      </div>

      <div style={{ marginBottom: 'var(--space-2)' }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{topKpiLabel}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--text-primary)' }}>{topKpiValue}</div>
      </div>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)', margin: 0 }}>
        {aiSummary}
      </p>
    </div>
  );
}
