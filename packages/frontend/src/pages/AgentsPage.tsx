import React from 'react';
import { Bot } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function AgentsPage() {
  return (
    <AppShell pageTitle="AI Agents">
      <EmptyState
        icon={Bot}
        title="AI Agents"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
