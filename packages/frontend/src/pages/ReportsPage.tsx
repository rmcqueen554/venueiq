import React from 'react';
import { FileText } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function ReportsPage() {
  return (
    <AppShell pageTitle="Reports">
      <EmptyState
        icon={FileText}
        title="Reports"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
