import React from 'react';
import { Handshake } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function SponsorshipPage() {
  return (
    <AppShell pageTitle="Sponsorship Intelligence">
      <EmptyState
        icon={Handshake}
        title="Sponsorship Intelligence"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
