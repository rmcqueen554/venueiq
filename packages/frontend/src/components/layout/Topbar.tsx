import React from 'react';
import { MessageSquare, Bell, Search } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatCurrency, formatNumber } from '../../api/utils';

interface TopbarProps {
  pageTitle: string;
  onChatToggle: () => void;
  chatOpen: boolean;
}

export function Topbar({ pageTitle, onChatToggle, chatOpen }: TopbarProps) {
  const { liveEvent } = useAppStore();

  return (
    <header style={{
      height: 'var(--topbar-height)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 var(--space-8)',
      gap: 'var(--space-6)',
    }}>
      {/* Page title */}
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-xl)',
        color: 'var(--text-primary)',
        fontWeight: 400,
        flexShrink: 0,
      }}>
        {pageTitle}
      </h1>

      {/* Live event ticker (center) */}
      {liveEvent && (
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <div style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-hover)',
            borderRadius: 'var(--radius-full)',
            padding: '4px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            fontSize: 'var(--text-xs)',
          }}>
            <span className="live-dot" />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{liveEvent.event_name}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>·</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              T+{Math.floor((liveEvent.elapsed_minutes ?? 0) / 60)}:{String((liveEvent.elapsed_minutes ?? 0) % 60).padStart(2, '0')}
            </span>
            {liveEvent.attendance_scanned && (
              <>
                <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatNumber(liveEvent.attendance_scanned)} scanned</span>
              </>
            )}
            {liveEvent.revenue_to_date && (
              <>
                <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                <span style={{ color: 'var(--status-green)', fontWeight: 600 }}>{formatCurrency(liveEvent.revenue_to_date)}</span>
              </>
            )}
          </div>
        </div>
      )}

      {liveEvent == null && <div style={{ flex: 1 }} />}

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
        <button
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 'var(--radius)', color: 'var(--text-secondary)', transition: 'all var(--transition-fast)' }}
          title="Search"
        >
          <Search size={18} />
        </button>

        <button
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 'var(--radius)', color: 'var(--text-secondary)', transition: 'all var(--transition-fast)', position: 'relative' }}
          title="Notifications"
        >
          <Bell size={18} />
          {/* Unread badge */}
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--status-red)',
            border: '1.5px solid var(--surface-default)',
          }} />
        </button>

        <button
          onClick={onChatToggle}
          style={{
            background: chatOpen ? 'var(--accent-dim)' : 'transparent',
            border: `1px solid ${chatOpen ? 'var(--accent)' : 'transparent'}`,
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: 'var(--radius)',
            color: chatOpen ? 'var(--accent)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            transition: 'all var(--transition-fast)',
          }}
          title="AI Advisor"
        >
          <MessageSquare size={16} />
          Ask AI
        </button>
      </div>
    </header>
  );
}
