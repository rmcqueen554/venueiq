import React from 'react';
import { Building2 } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function FacilitiesPage() {
  return (
    <AppShell pageTitle="Facilities Intelligence">
      <EmptyState
        icon={Building2}
        title="Facilities Intelligence"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
