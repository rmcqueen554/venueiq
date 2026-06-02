import React from 'react';
import { Settings2 } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function OperationsPage() {
  return (
    <AppShell pageTitle="Operations Intelligence">
      <EmptyState
        icon={Settings2}
        title="Operations Intelligence"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
