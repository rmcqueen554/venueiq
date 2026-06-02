import React from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({ value, max = 100, color, height = 4, showLabel, label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = color ?? (pct > 85 ? 'var(--status-red)' : pct > 60 ? 'var(--status-amber)' : 'var(--status-green)');

  return (
    <div>
      {(showLabel || label) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          <span>{label}</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className="progress-bar" style={{ height }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}
