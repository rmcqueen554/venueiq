import React from 'react';
import { Zap } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function AutomationsPage() {
  return (
    <AppShell pageTitle="Automations">
      <EmptyState
        icon={Zap}
        title="Automations"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
