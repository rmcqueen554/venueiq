import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, RefreshCw, ShoppingCart, Package, Ticket, Handshake, Settings2, Building2, Shield, ParkingCircle, Heart } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { KPICard } from '../components/ui/KPICard';
import { ModuleHealthCard } from '../components/ui/ModuleHealthCard';
import { RiskFeedItem } from '../components/ui/RiskFeedItem';
import { RevenueStreamBar } from '../components/charts/RevenueStreamBar';
import { ForecastBand } from '../components/charts/ForecastBand';
import { SalesVelocityLine } from '../components/charts/SalesVelocityLine';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/appStore';
import { useSocket } from '../hooks/useSocket';
import { formatCurrency } from '../api/utils';

const MODULE_ICONS = {
  concessions: ShoppingCart,
  merchandise: Package,
  ticketing: Ticket,
  sponsorship: Handshake,
  operations: Settings2,
  facilities: Building2,
  security: Shield,
  parking: ParkingCircle,
  fan_experience: Heart,
};

export function DashboardPage() {
  const { tenant } = useAppStore();
  const queryClient = useQueryClient();
  const [briefingExpanded, setBriefingExpanded] = useState(false);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['executive-dashboard', tenant?.id],
    queryFn: async () => {
      const { data } = await apiClient.get('/executive/dashboard', { params: { tenant_id: tenant?.id } });
      return data.data;
    },
    refetchInterval: 30_000, // 30-second background refresh
    enabled: !!tenant?.id,
  });

  const generateBriefing = useMutation({
    mutationFn: () => apiClient.post('/executive/briefing/generate', { tenant_id: tenant?.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executive-dashboard', tenant?.id] }),
  });

  const dismissRisk = useMutation({
    mutationFn: (id: string) => apiClient.post(`/executive/risk-opportunity/${id}/dismiss`, { tenant_id: tenant?.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executive-dashboard', tenant?.id] }),
  });

  // Real-time KPI updates via Socket.io
  useSocket('kpi:snapshot', () => {
    queryClient.invalidateQueries({ queryKey: ['executive-dashboard', tenant?.id] });
  });

  const kpiStrip = dashboard?.kpi_strip;
  const riskItems = dashboard?.risk_opportunities ?? [];
  const departments = [
    { module: 'concessions', label: 'Concessions', path: '/concessions' },
    { module: 'merchandise', label: 'Merchandise', path: '/merchandise' },
    { module: 'ticketing',   label: 'Ticketing',   path: '/ticketing' },
    { module: 'sponsorship', label: 'Sponsorship', path: '/sponsorship' },
    { module: 'operations',  label: 'Operations',  path: '/operations' },
    { module: 'facilities',  label: 'Facilities',  path: '/facilities' },
    { module: 'security',    label: 'Security',    path: '/security' },
    { module: 'parking',     label: 'Parking',     path: '/parking' },
    { module: 'fan_experience', label: 'Fan Experience', path: '/fan-experience' },
  ];

  return (
    <AppShell pageTitle="Command Center">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        {/* Event Mode Banner */}
        {dashboard?.live_event && (
          <div style={{
            background: 'rgba(232, 95, 74, 0.06)',
            border: '1px solid rgba(232, 95, 74, 0.2)',
            borderLeft: '4px solid var(--status-red)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}>
            <span className="live-dot" />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dashboard.live_event.event_name}</span>
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 12, fontSize: 'var(--text-sm)' }}>
                T+{Math.floor((dashboard.live_event.elapsed_minutes ?? 0) / 60)}:{String((dashboard.live_event.elapsed_minutes ?? 0) % 60).padStart(2, '0')} elapsed
              </span>
            </div>
          </div>
        )}

        {/* Section B: AI Daily Briefing */}
        <div className="card" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                AI Daily Briefing
              </span>
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', gap: 6 }}
              onClick={() => generateBriefing.mutate()}
              disabled={generateBriefing.isPending}
            >
              <RefreshCw size={12} style={{ animation: generateBriefing.isPending ? 'spin 1s linear infinite' : 'none' }} />
              {generateBriefing.isPending ? 'Generating...' : 'Regenerate'}
            </button>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ height: 18, width: '90%' }} />
              <div className="skeleton" style={{ height: 18, width: '85%' }} />
              <div className="skeleton" style={{ height: 18, width: '92%' }} />
            </div>
          ) : dashboard?.briefing ? (
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-base)',
                fontStyle: 'italic',
                color: 'var(--text-primary)',
                lineHeight: 'var(--leading-relaxed)',
                display: '-webkit-box',
                WebkitLineClamp: briefingExpanded ? 'unset' : 5,
                WebkitBoxOrient: 'vertical',
                overflow: briefingExpanded ? 'visible' : 'hidden',
              }}>
                {dashboard.briefing.content}
              </p>
              <button
                onClick={() => setBriefingExpanded(!briefingExpanded)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 'var(--text-xs)', marginTop: 8, padding: 0 }}
              >
                {briefingExpanded ? 'Show less' : 'Read full briefing'}
              </button>
              <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                Generated {new Date(dashboard.briefing.generated_at).toLocaleTimeString()} · VenueIQ AI
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
              No briefing available. Click "Regenerate" to generate today's briefing.
            </p>
          )}
        </div>

        {/* Section C: KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-4)' }}>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          ) : kpiStrip ? (
            <>
              <KPICard label="Total Revenue"       value={kpiStrip.total_revenue?.value ?? 0}  formatted={formatCurrency(kpiStrip.total_revenue?.value ?? 0)}  delta_pct={kpiStrip.total_revenue?.delta_pct}  sparkline={kpiStrip.total_revenue?.sparkline}  />
              <KPICard label="Attendance"          value={kpiStrip.attendance?.value ?? 0}       formatted={String(Math.round(kpiStrip.attendance?.value ?? 0))} delta_pct={kpiStrip.attendance?.delta_pct}       sparkline={kpiStrip.attendance?.sparkline}       />
              <KPICard label="Concession / Cap"   value={kpiStrip.concession_per_cap?.value ?? 0} formatted={formatCurrency(kpiStrip.concession_per_cap?.value ?? 0)} delta_pct={kpiStrip.concession_per_cap?.delta_pct} />
              <KPICard label="Merch / Cap"        value={kpiStrip.merch_per_cap?.value ?? 0}    formatted={formatCurrency(kpiStrip.merch_per_cap?.value ?? 0)}    delta_pct={kpiStrip.merch_per_cap?.delta_pct}    />
              <KPICard label="Parking Revenue"    value={kpiStrip.parking_revenue?.value ?? 0}  formatted={formatCurrency(kpiStrip.parking_revenue?.value ?? 0)}  delta_pct={kpiStrip.parking_revenue?.delta_pct}  />
              <KPICard label="Sponsor Activations" value={kpiStrip.sponsorship_activations?.value ?? 0} formatted={`${Math.round(kpiStrip.sponsorship_activations?.value ?? 0)}%`} delta_pct={kpiStrip.sponsorship_activations?.delta_pct} />
            </>
          ) : null}
        </div>

        {/* Section D: Department Health Grid */}
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
            Operational Health
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
            {departments.map((dept) => {
              const Icon = MODULE_ICONS[dept.module as keyof typeof MODULE_ICONS] ?? LayoutDashboard;
              return (
                <ModuleHealthCard
                  key={dept.module}
                  module={dept.module}
                  label={dept.label}
                  icon={Icon}
                  status="healthy"
                  topKpiLabel="Revenue"
                  topKpiValue="—"
                  aiSummary="Monitoring..."
                  path={dept.path}
                />
              );
            })}
          </div>
        </div>

        {/* Section E: Risk Feed + Revenue Streams */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* Risk & Opportunity Feed */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
              Risk & Opportunity Feed
            </h2>
            {riskItems.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', padding: 'var(--space-4)' }}>
                No active risks or opportunities detected.
              </div>
            ) : (
              riskItems.slice(0, 8).map((item: any) => (
                <RiskFeedItem
                  key={item.id}
                  item={item}
                  onDismiss={(id) => dismissRisk.mutate(id)}
                />
              ))
            )}
          </div>

          {/* Revenue Streams Chart */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
              Revenue by Stream
            </h2>
            <div className="card">
              <RevenueStreamBar
                data={[
                  { name: 'Ticketing',    actual: 680000, forecast: 720000 },
                  { name: 'Concessions', actual: 284000, forecast: 310000 },
                  { name: 'Merch',       actual: 124000, forecast: 130000 },
                  { name: 'Parking',     actual: 96000,  forecast: 95000 },
                  { name: 'Sponsorship', actual: 56000,  forecast: 60000 },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Section F: 90-Day Forecast */}
        {dashboard?.upcoming_events?.length > 0 && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
              Event Forecast — Next 12 Events
            </h2>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Expected Attendance</th>
                    <th>Projected Revenue</th>
                    <th>Ticket Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard.upcoming_events ?? []).map((event: any) => (
                    <tr key={event.event_id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{event.event_name}</td>
                      <td>{new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td style={{ textTransform: 'capitalize' }}>{event.event_type}</td>
                      <td>{event.expected_attendance?.toLocaleString() ?? '—'}</td>
                      <td style={{ color: 'var(--status-green)' }}>{event.projected_revenue ? formatCurrency(event.projected_revenue) : '—'}</td>
                      <td>
                        {event.ticket_sales_pct != null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 4, background: 'var(--surface-elevated)', borderRadius: 9999 }}>
                              <div style={{ height: '100%', width: `${event.ticket_sales_pct * 100}%`, background: 'var(--accent)', borderRadius: 9999 }} />
                            </div>
                            <span>{Math.round(event.ticket_sales_pct * 100)}%</span>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
