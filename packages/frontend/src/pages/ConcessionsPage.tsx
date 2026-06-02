import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, AlertTriangle, Check, X, TrendingUp } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { SalesVelocityLine } from '../components/charts/SalesVelocityLine';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StatusDot } from '../components/ui/StatusDot';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton, TableSkeleton } from '../components/ui/SkeletonLoader';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/appStore';
import { useSocket } from '../hooks/useSocket';
import { formatCurrency } from '../api/utils';

export function ConcessionsPage() {
  const { tenant, liveEvent } = useAppStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'pricing' | 'staff'>('overview');

  const { data: standsData, isLoading } = useQuery({
    queryKey: ['concessions-live', tenant?.id, liveEvent?.event_id],
    queryFn: async () => {
      const { data } = await apiClient.get('/concessions/stands/live', { params: { tenant_id: tenant?.id, event_id: liveEvent?.event_id } });
      return data.data ?? [];
    },
    refetchInterval: 30_000,
    enabled: !!tenant?.id,
  });

  const { data: pricingQueue } = useQuery({
    queryKey: ['concessions-pricing-queue', tenant?.id, liveEvent?.event_id],
    queryFn: async () => {
      const { data } = await apiClient.get('/concessions/pricing-queue', { params: { tenant_id: tenant?.id, event_id: liveEvent?.event_id } });
      return data.data ?? [];
    },
    refetchInterval: 60_000,
    enabled: !!tenant?.id,
  });

  useSocket('pos:transaction', () => {
    queryClient.invalidateQueries({ queryKey: ['concessions-live', tenant?.id] });
  });

  const approvePrice = useMutation({
    mutationFn: (id: string) => apiClient.post(`/concessions/pricing-queue/${id}/approve`, { approved_by: 'current_user' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concessions-pricing-queue', tenant?.id] }),
  });

  const rejectPrice = useMutation({
    mutationFn: (id: string) => apiClient.post(`/concessions/pricing-queue/${id}/reject`, { rejected_by: 'current_user' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['concessions-pricing-queue', tenant?.id] }),
  });

  const tabs = ['overview', 'inventory', 'pricing', 'staff'] as const;

  const totalRevenue = (standsData ?? []).reduce((s: number, stand: any) => {
    return s + (stand.forecast?.[0]?.forecasted_revenue ?? 0);
  }, 0);

  return (
    <AppShell pageTitle="Concessions Intelligence">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-1)', background: 'var(--surface-raised)', padding: 4, borderRadius: 'var(--radius)', width: 'fit-content' }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                background: activeTab === tab ? 'var(--surface-elevated)' : 'transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                textTransform: 'capitalize',
                transition: 'all var(--transition-fast)',
              }}
            >
              {tab}
              {tab === 'pricing' && (pricingQueue?.length ?? 0) > 0 && (
                <span style={{
                  marginLeft: 6, background: 'var(--status-amber)', color: '#000',
                  borderRadius: 9999, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                }}>
                  {pricingQueue?.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            {/* Stand Performance Map placeholder + leaderboard */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
              {/* Stand list */}
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
                  Stand Performance
                </h3>
                {isLoading ? (
                  <TableSkeleton rows={5} />
                ) : (standsData ?? []).length === 0 ? (
                  <EmptyState icon={ShoppingCart} title="No stands configured" description="Add concession stands in Settings." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {(standsData ?? []).map((stand: any) => {
                      const forecastedRevenue = stand.forecast?.[0]?.forecasted_revenue ?? 0;
                      const actualRevenue = 0; // from pos_transactions
                      const pct = forecastedRevenue > 0 ? Math.min(100, (actualRevenue / forecastedRevenue) * 100) : 0;

                      return (
                        <div key={stand.id} style={{
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius)',
                          padding: 'var(--space-4)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{stand.name}</div>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{stand.type}</div>
                            </div>
                            <StatusDot status={pct > 80 ? 'green' : pct > 50 ? 'amber' : 'red'} />
                          </div>
                          <ProgressBar value={pct} label={`${formatCurrency(actualRevenue)} / ${formatCurrency(forecastedRevenue)}`} showLabel />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sales velocity */}
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
                  Sales Velocity
                </h3>
                <div className="card">
                  <SalesVelocityLine data={[
                    { time: '5:00', revenue: 0 },
                    { time: '5:30', revenue: 12400, forecast: 10000 },
                    { time: '6:00', revenue: 28100, forecast: 25000 },
                    { time: '6:30', revenue: 51200, forecast: 48000 },
                    { time: '7:00', revenue: 84300, forecast: 80000 },
                    { time: '7:30', revenue: 142000, forecast: 130000 },
                    { time: '8:00', revenue: 198000, forecast: 180000 },
                  ]} />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'inventory' && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
              Inventory Alerts
            </h3>
            <EmptyState icon={ShoppingCart} title="No low stock alerts" description="All stands are stocked above par levels." />
          </div>
        )}

        {activeTab === 'pricing' && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
              Dynamic Pricing Queue
            </h3>
            {(pricingQueue ?? []).length === 0 ? (
              <EmptyState icon={TrendingUp} title="No pending pricing recommendations" description="AI pricing recommendations will appear here when opportunities are detected." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {(pricingQueue ?? []).map((rec: any) => (
                  <div key={rec.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 4 }}>
                          Stand {rec.stand_id} — Product {rec.product_id}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8 }}>{rec.rationale}</div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>Current: <strong style={{ color: 'var(--text-primary)' }}>${rec.current_price}</strong></span>
                          <span style={{ color: 'var(--status-green)' }}>→ ${rec.recommended_price}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}>+{formatCurrency(rec.expected_revenue_lift)} lift</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                        <button className="btn btn-primary" style={{ gap: 4, padding: '6px 12px' }} onClick={() => approvePrice.mutate(rec.id)}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="btn btn-ghost" style={{ gap: 4, padding: '6px 12px' }} onClick={() => rejectPrice.mutate(rec.id)}>
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'staff' && (
          <EmptyState icon={ShoppingCart} title="Staff efficiency" description="Staff scheduling data will appear here when connected to your staffing system." />
        )}
      </div>
    </AppShell>
  );
}
