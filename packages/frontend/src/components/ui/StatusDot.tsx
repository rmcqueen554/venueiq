import React from 'react';

type Status = 'healthy' | 'warning' | 'critical' | 'green' | 'amber' | 'red';

const COLOR_MAP: Record<Status, string> = {
  healthy: 'var(--status-green)',
  green: 'var(--status-green)',
  warning: 'var(--status-amber)',
  amber: 'var(--status-amber)',
  critical: 'var(--status-red)',
  red: 'var(--status-red)',
};

export function StatusDot({ status, size = 8 }: { status: Status; size?: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: COLOR_MAP[status],
      flexShrink: 0,
    }} />
  );
}
