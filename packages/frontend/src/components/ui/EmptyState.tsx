import React from 'react';

interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={40} style={{ opacity: 0.3 }} />}
      <div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{title}</div>
        {description && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{description}</div>}
      </div>
      {action}
    </div>
  );
}
