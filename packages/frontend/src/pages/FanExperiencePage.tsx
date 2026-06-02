import React from 'react';
import { Heart } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

export function FanExperiencePage() {
  return (
    <AppShell pageTitle="Fan Experience Intelligence">
      <EmptyState
        icon={Heart}
        title="Fan Experience Intelligence"
        description="Loading data from connected systems..."
      />
    </AppShell>
  );
}
