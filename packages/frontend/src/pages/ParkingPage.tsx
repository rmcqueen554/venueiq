import React from 'react';
import { ParkingCircle } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function ParkingPage() {
  return (
    <AppShell pageTitle="Parking Intelligence">
      <EmptyState
        icon={ParkingCircle}
        title="Parking Intelligence"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
