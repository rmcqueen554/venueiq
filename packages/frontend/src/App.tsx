import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn, useAuth, useUser } from '@clerk/clerk-react';
import { setupAuthInterceptor } from './api/client';
import { applyVenueTheme } from './design/venue-theme';
import { useAppStore } from './store/appStore';
import { useEventMode } from './hooks/useEventMode';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { ConcessionsPage } from './pages/ConcessionsPage';
import { MerchandisePage } from './pages/MerchandisePage';
import { TicketingPage } from './pages/TicketingPage';
import { SponsorshipPage } from './pages/SponsorshipPage';
import { OperationsPage } from './pages/OperationsPage';
import { FacilitiesPage } from './pages/FacilitiesPage';
import { SecurityPage } from './pages/SecurityPage';
import { ParkingPage } from './pages/ParkingPage';
import { FanExperiencePage } from './pages/FanExperiencePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AutomationsPage } from './pages/AutomationsPage';
import { AgentsPage } from './pages/AgentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { LoginPage } from './pages/LoginPage';

function AppInner() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { tenant, setTenant } = useAppStore();

  // Set up auth interceptor
  useEffect(() => {
    setupAuthInterceptor(getToken);
  }, [getToken]);

  // Apply venue theme from user metadata
  useEffect(() => {
    const config = user?.publicMetadata?.white_label_config as any;
    applyVenueTheme(config?.primary_color, config?.app_name);
  }, [user]);

  // Poll for live event
  useEventMode();

  return (
    <Routes>
      <Route path="/login"       element={<LoginPage />} />
      <Route path="/onboarding"  element={<OnboardingPage />} />
      <Route path="/dashboard"   element={<DashboardPage />} />
      <Route path="/concessions" element={<ConcessionsPage />} />
      <Route path="/merchandise" element={<MerchandisePage />} />
      <Route path="/ticketing"   element={<TicketingPage />} />
      <Route path="/sponsorship" element={<SponsorshipPage />} />
      <Route path="/operations"  element={<OperationsPage />} />
      <Route path="/facilities"  element={<FacilitiesPage />} />
      <Route path="/security"    element={<SecurityPage />} />
      <Route path="/parking"     element={<ParkingPage />} />
      <Route path="/fan-experience" element={<FanExperiencePage />} />
      <Route path="/analytics"   element={<AnalyticsPage />} />
      <Route path="/reports"     element={<ReportsPage />} />
      <Route path="/automations" element={<AutomationsPage />} />
      <Route path="/agents"      element={<AgentsPage />} />
      <Route path="/settings"    element={<SettingsPage />} />
      <Route path="/"            element={<Navigate to="/dashboard" replace />} />
      <Route path="*"            element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <>
      <SignedIn>
        <AppInner />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
