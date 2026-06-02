import React from 'react';
import { BarChart2 } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function AnalyticsPage() {
  return (
    <AppShell pageTitle="Analytics">
      <EmptyState
        icon={BarChart2}
        title="Analytics"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
