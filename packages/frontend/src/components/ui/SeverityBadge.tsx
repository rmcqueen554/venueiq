import React from 'react';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const CONFIG: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRITICAL', color: 'var(--status-red)',   bg: 'var(--status-red-bg)' },
  high:     { label: 'HIGH',     color: 'var(--status-amber)', bg: 'var(--status-amber-bg)' },
  medium:   { label: 'MEDIUM',   color: 'var(--status-blue)',  bg: 'var(--status-blue-bg)' },
  low:      { label: 'LOW',      color: 'var(--status-green)', bg: 'var(--status-green-bg)' },
  info:     { label: 'INFO',     color: 'var(--text-tertiary)', bg: 'var(--surface-elevated)' },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = CONFIG[severity];
  return (
    <span className="chip" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}
