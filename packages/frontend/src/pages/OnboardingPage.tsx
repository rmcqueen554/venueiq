import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Building2, Database, Calendar, Users, Upload, Bell, Rocket } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';

const STEPS = [
  { id: 1, label: 'Venue Profile',     icon: Building2 },
  { id: 2, label: 'Data Sources',      icon: Database },
  { id: 3, label: 'Event Calendar',    icon: Calendar },
  { id: 4, label: 'Invite Team',       icon: Users },
  { id: 5, label: 'Historical Data',   icon: Upload },
  { id: 6, label: 'Notifications',     icon: Bell },
  { id: 7, label: 'Go Live',           icon: Rocket },
];

const VENUE_TYPES = ['stadium', 'arena', 'amphitheater', 'civic_center', 'racetrack', 'fairground', 'convention_center'];
const DATA_SOURCES = [
  { id: 'toast',         label: 'Toast POS',       category: 'POS' },
  { id: 'square',        label: 'Square',           category: 'POS' },
  { id: 'clover',        label: 'Clover',           category: 'POS' },
  { id: 'ticketmaster',  label: 'Ticketmaster',     category: 'Ticketing' },
  { id: 'axs',           label: 'AXS',              category: 'Ticketing' },
  { id: 'seatgeek',      label: 'SeatGeek',         category: 'Ticketing' },
  { id: 'parkhub',       label: 'ParkHub',          category: 'Parking' },
  { id: 'salesforce',    label: 'Salesforce CRM',   category: 'CRM' },
  { id: 'adp',           label: 'ADP',              category: 'Staffing' },
  { id: 'fiix',          label: 'Fiix CMMS',        category: 'Facilities' },
  { id: 'generic_webhook', label: 'Generic Webhook', category: 'Custom' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Step 1 state
  const [venueProfile, setVenueProfile] = useState({ name: '', type: 'stadium', capacity: '', timezone: 'America/New_York', sport_or_genre: '' });
  // Step 2 state
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  // Step 6 state
  const [notifPrefs, setNotifPrefs] = useState({ preferred_channel: 'teams', teams_webhook: '', slack_webhook: '' });

  const step1Mutation = useMutation({
    mutationFn: () => apiClient.post('/onboarding/step/1', { ...venueProfile, capacity: venueProfile.capacity ? parseInt(venueProfile.capacity) : undefined }),
    onSuccess: (res) => {
      setTenantId(res.data.data.tenant_id);
      setCurrentStep(2);
    },
  });

  const step7Mutation = useMutation({
    mutationFn: () => apiClient.post(`/onboarding/step/7/go-live`, { tenant_id: tenantId }),
    onSuccess: () => navigate('/dashboard'),
  });

  const canProceed = currentStep === 1
    ? venueProfile.name.length >= 2
    : true;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surface-base)',
      display: 'flex',
    }}>
      {/* Left sidebar — step tracker */}
      <div style={{
        width: 280,
        background: 'var(--surface-default)',
        borderRight: '1px solid var(--border-default)',
        padding: 'var(--space-8) var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--text-primary)' }}>VenueIQ</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>Venue Onboarding</div>
        </div>

        {STEPS.map((step) => {
          const Icon = step.icon;
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <div key={step.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius)',
              marginBottom: 'var(--space-1)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              cursor: isCompleted ? 'pointer' : 'default',
            }}
            onClick={() => isCompleted && setCurrentStep(step.id)}>
              <div style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: isCompleted ? 'var(--status-green)' : isActive ? 'var(--accent)' : 'var(--surface-elevated)',
                border: `2px solid ${isCompleted ? 'var(--status-green)' : isActive ? 'var(--accent)' : 'var(--border-default)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isCompleted || isActive ? '#000' : 'var(--text-tertiary)',
                flexShrink: 0,
              }}>
                {isCompleted ? <Check size={14} /> : <Icon size={13} />}
              </div>
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent)' : isCompleted ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}>
                {step.label}
              </span>
            </div>
          );
        })}

        <div style={{ marginTop: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          Step {currentStep} of {STEPS.length}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
        <div style={{ width: '100%', maxWidth: 640 }} className="animate-fade-in-up">

          {/* Step 1: Venue Profile */}
          {currentStep === 1 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--text-primary)', marginBottom: 8, fontWeight: 400 }}>Tell us about your venue</h2>
              <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-8)', fontSize: 'var(--text-base)' }}>This information helps VenueIQ configure your dashboards and AI models.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Venue Name *</label>
                  <input className="input" placeholder="e.g. Madison Square Garden" value={venueProfile.name} onChange={(e) => setVenueProfile({ ...venueProfile, name: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Venue Type *</label>
                  <select className="input" value={venueProfile.type} onChange={(e) => setVenueProfile({ ...venueProfile, type: e.target.value })}>
                    {VENUE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Capacity</label>
                    <input className="input" type="number" placeholder="e.g. 20000" value={venueProfile.capacity} onChange={(e) => setVenueProfile({ ...venueProfile, capacity: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Timezone</label>
                    <select className="input" value={venueProfile.timezone} onChange={(e) => setVenueProfile({ ...venueProfile, timezone: e.target.value })}>
                      <option value="America/New_York">Eastern (ET)</option>
                      <option value="America/Chicago">Central (CT)</option>
                      <option value="America/Denver">Mountain (MT)</option>
                      <option value="America/Los_Angeles">Pacific (PT)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Primary Sport / Event Type</label>
                  <input className="input" placeholder="e.g. NBA Basketball, Concerts, Hockey" value={venueProfile.sport_or_genre} onChange={(e) => setVenueProfile({ ...venueProfile, sport_or_genre: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Data Sources */}
          {currentStep === 2 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--text-primary)', marginBottom: 8, fontWeight: 400 }}>Connect your data sources</h2>
              <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-8)', fontSize: 'var(--text-base)' }}>Select the systems your venue uses. You can add more later in Settings.</p>

              {['POS', 'Ticketing', 'Parking', 'CRM', 'Staffing', 'Facilities', 'Custom'].map((category) => {
                const categoryItems = DATA_SOURCES.filter((s) => s.category === category);
                if (!categoryItems.length) return null;
                return (
                  <div key={category} style={{ marginBottom: 'var(--space-5)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>{category}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
                      {categoryItems.map((source) => {
                        const isSelected = selectedSources.has(source.id);
                        return (
                          <button
                            key={source.id}
                            onClick={() => {
                              const next = new Set(selectedSources);
                              if (isSelected) next.delete(source.id); else next.add(source.id);
                              setSelectedSources(next);
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius)',
                              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-default)'}`,
                              background: isSelected ? 'var(--accent-dim)' : 'var(--surface-raised)',
                              color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                              fontSize: 'var(--text-sm)',
                              fontWeight: isSelected ? 600 : 400,
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all var(--transition-fast)',
                              display: 'flex', alignItems: 'center', gap: 8,
                            }}
                          >
                            {isSelected && <Check size={13} />}
                            {source.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Steps 3-6: Simplified stubs */}
          {currentStep >= 3 && currentStep <= 6 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--text-primary)', marginBottom: 8, fontWeight: 400 }}>
                {STEPS[currentStep - 1].label}
              </h2>
              <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-8)' }}>
                Configure this step or skip to continue.
              </p>
              <div className="card" style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-10)' }}>
                {STEPS[currentStep - 1].label} configuration form
              </div>
            </div>
          )}

          {/* Step 7: Go Live */}
          {currentStep === 7 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)', fontSize: 28 }}>🚀</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', color: 'var(--text-primary)', marginBottom: 8, fontWeight: 400 }}>Ready to go live</h2>
              <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-8)', maxWidth: 400, margin: '0 auto var(--space-8)' }}>
                VenueIQ is configured and ready. Your AI agents will activate automatically and your dashboards will begin populating with real-time data.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                {[
                  { label: 'AI Agents', value: '8', desc: 'Active' },
                  { label: 'Modules', value: '10', desc: 'Ready' },
                  { label: 'Data Sources', value: `${selectedSources.size}`, desc: 'Connected' },
                ].map((stat) => (
                  <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-4xl)', color: 'var(--accent)' }}>{stat.value}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-green)' }}>{stat.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-8)' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              Back
            </button>
            <button
              className="btn btn-primary"
              style={{ gap: 8 }}
              onClick={() => {
                if (currentStep === 1) step1Mutation.mutate();
                else if (currentStep === 7) step7Mutation.mutate();
                else setCurrentStep(Math.min(7, currentStep + 1));
              }}
              disabled={!canProceed || step1Mutation.isPending || step7Mutation.isPending}
            >
              {currentStep === 7 ? '🚀 Launch VenueIQ' : 'Continue'}
              {currentStep < 7 && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
