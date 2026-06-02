import React from 'react';
import { Package } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function MerchandisePage() {
  return (
    <AppShell pageTitle="Merchandise Intelligence">
      <EmptyState
        icon={Package}
        title="Merchandise Intelligence"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
