import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AIChatPanel } from './AIChatPanel';
import { useAppStore } from '../../store/appStore';

interface AppShellProps {
  children: React.ReactNode;
  pageTitle: string;
}

export function AppShell({ children, pageTitle }: AppShellProps) {
  const { chatPanelOpen, setChatPanelOpen } = useAppStore();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `var(--sidebar-width) 1fr${chatPanelOpen ? ' var(--chat-panel-width)' : ''}`,
      gridTemplateRows: 'var(--topbar-height) 1fr',
      minHeight: '100vh',
      background: 'var(--surface-base)',
    }}>
      {/* Sidebar — spans full height */}
      <div style={{
        gridRow: '1 / -1',
        gridColumn: '1',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 'var(--z-raised)',
      }}>
        <Sidebar />
      </div>

      {/* Topbar */}
      <div style={{
        gridRow: '1',
        gridColumn: '2',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-raised)',
        background: 'var(--surface-default)',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <Topbar pageTitle={pageTitle} onChatToggle={() => setChatPanelOpen(!chatPanelOpen)} chatOpen={chatPanelOpen} />
      </div>

      {/* Main content */}
      <main style={{
        gridRow: '2',
        gridColumn: '2',
        overflowY: 'auto',
        padding: 'var(--space-8)',
      }} className="animate-fade-in-up">
        {children}
      </main>

      {/* AI Chat Panel */}
      {chatPanelOpen && (
        <div style={{
          gridRow: '1 / -1',
          gridColumn: '3',
          position: 'sticky',
          top: 0,
          height: '100vh',
          borderLeft: '1px solid var(--border-default)',
          background: 'var(--surface-default)',
          zIndex: 'var(--z-raised)',
        }} className="animate-slide-in">
          <AIChatPanel />
        </div>
      )}
    </div>
  );
}
