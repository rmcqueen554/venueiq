import React from 'react';
import { Settings } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function SettingsPage() {
  return (
    <AppShell pageTitle="Settings">
      <EmptyState
        icon={Settings}
        title="Settings"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
