import React from 'react';
import { Ticket } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function TicketingPage() {
  return (
    <AppShell pageTitle="Ticketing Intelligence">
      <EmptyState
        icon={Ticket}
        title="Ticketing Intelligence"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
