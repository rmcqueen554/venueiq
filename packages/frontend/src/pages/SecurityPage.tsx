import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, AlertTriangle, Users, Camera, MapPin, Plus } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { StatusDot } from '../components/ui/StatusDot';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/appStore';
import { useSocket } from '../hooks/useSocket';
import { timeAgo } from '../api/utils';

export function SecurityPage() {
  const { tenant, liveEvent } = useAppStore();
  const queryClient = useQueryClient();
  const [newIncidentOpen, setNewIncidentOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [form, setForm] = useState({ type: 'fight', severity: 'medium', location_description: '', description: '' });

  const { data: securityData, isLoading } = useQuery({
    queryKey: ['security-live', tenant?.id, liveEvent?.event_id],
    queryFn: async () => {
      const { data } = await apiClient.get('/security/live', { params: { tenant_id: tenant?.id, event_id: liveEvent?.event_id } });
      return data.data;
    },
    refetchInterval: 15_000,
    enabled: !!tenant?.id,
  });

  // Real-time incident updates
  useSocket('security:incident', () => {
    queryClient.invalidateQueries({ queryKey: ['security-live', tenant?.id] });
  });
  useSocket('security:gate_scan', () => {
    queryClient.invalidateQueries({ queryKey: ['security-live', tenant?.id] });
  });

  const createIncident = useMutation({
    mutationFn: (body: any) => apiClient.post('/security/incidents', { ...body, tenant_id: tenant?.id, event_id: liveEvent?.event_id, reported_by: 'current_user' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-live', tenant?.id] });
      setNewIncidentOpen(false);
      setForm({ type: 'fight', severity: 'medium', location_description: '', description: '' });
    },
  });

  const updateIncident = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiClient.patch(`/security/incidents/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-live', tenant?.id] }),
  });

  const incidents = securityData?.incidents ?? [];
  const posts = securityData?.posts ?? [];
  const cameras = securityData?.cameras ?? [];
  const crowdDensity = securityData?.crowd_density ?? [];

  const incidentsByType = incidents.reduce((acc: Record<string, number>, inc: any) => {
    acc[inc.severity] = (acc[inc.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell pageTitle="Security Command">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        {/* Live Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
          {[
            { label: 'Active Incidents', value: incidents.filter((i: any) => i.status !== 'closed').length, color: incidents.some((i: any) => i.severity === 'critical') ? 'var(--status-red)' : 'var(--text-primary)' },
            { label: 'Critical', value: incidentsByType['critical'] ?? 0, color: 'var(--status-red)' },
            { label: 'Posts Staffed', value: `${posts.filter((p: any) => p.assigned_staff).length}/${posts.length}`, color: 'var(--text-primary)' },
            { label: 'Cameras Active', value: cameras.filter((c: any) => c.active).length, color: 'var(--status-green)' },
          ].map((stat) => (
            <div key={stat.label} className="card">
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{stat.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-4xl)', color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Crowd Density */}
        {crowdDensity.length > 0 && (
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
              Zone Crowd Density
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
              {crowdDensity.map((zone: any) => (
                <div key={zone.zone_id} style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--radius)', padding: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{zone.zone_name}</span>
                    <StatusDot status={zone.density_level > 85 ? 'red' : zone.density_level > 65 ? 'amber' : 'green'} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--surface-raised)', borderRadius: 9999 }}>
                      <div style={{
                        height: '100%',
                        width: `${zone.density_level}%`,
                        background: zone.density_level > 85 ? 'var(--status-red)' : zone.density_level > 65 ? 'var(--status-amber)' : 'var(--status-green)',
                        borderRadius: 9999,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flexShrink: 0 }}>{zone.density_level}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Incidents */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 400 }}>Active Incidents</h2>
            <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => setNewIncidentOpen(true)}>
              <Plus size={14} />
              New Incident
            </button>
          </div>

          {incidents.length === 0 ? (
            <EmptyState icon={Shield} title="No active incidents" description="The venue is secure. New incidents will appear here in real time." />
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Location</th>
                    <th>Reported</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc: any) => (
                    <tr key={inc.id} onClick={() => setSelectedIncident(inc)} style={{ cursor: 'pointer' }}>
                      <td style={{ textTransform: 'capitalize', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {inc.type.replace(/_/g, ' ')}
                      </td>
                      <td><SeverityBadge severity={inc.severity} /></td>
                      <td>{inc.location_description}</td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(inc.reported_at)}</td>
                      <td>
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          padding: '2px 8px',
                          borderRadius: 9999,
                          background: inc.status === 'closed' ? 'var(--status-green-bg)' : inc.status === 'contained' ? 'var(--status-amber-bg)' : 'var(--status-red-bg)',
                          color: inc.status === 'closed' ? 'var(--status-green)' : inc.status === 'contained' ? 'var(--status-amber)' : 'var(--status-red)',
                          textTransform: 'capitalize',
                        }}>
                          {inc.status}
                        </span>
                      </td>
                      <td>
                        {inc.status !== 'closed' && (
                          <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                            {inc.status === 'open' && (
                              <button className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', padding: '3px 8px' }}
                                onClick={() => updateIncident.mutate({ id: inc.id, status: 'contained' })}>
                                Contain
                              </button>
                            )}
                            <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: '3px 8px' }}
                              onClick={() => updateIncident.mutate({ id: inc.id, status: 'closed' })}>
                              Close
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Incident Modal */}
      <Modal open={newIncidentOpen} onClose={() => setNewIncidentOpen(false)} title="Log Security Incident">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {['fight', 'medical', 'theft', 'ejection', 'suspicious_item', 'crowd_crush_risk', 'other'].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Severity</label>
            <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Location</label>
            <input className="input" placeholder="e.g. Section 212, Gate C, Concourse B" value={form.location_description} onChange={(e) => setForm({ ...form, location_description: e.target.value })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Description</label>
            <textarea className="input" rows={3} placeholder="Brief description of the incident..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => createIncident.mutate(form)} disabled={createIncident.isPending || !form.location_description}>
              {createIncident.isPending ? 'Logging...' : 'Log Incident'}
            </button>
            <button className="btn btn-secondary" onClick={() => setNewIncidentOpen(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <Modal open={!!selectedIncident} onClose={() => setSelectedIncident(null)} title={`Incident — ${selectedIncident.type?.replace(/_/g, ' ')}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <SeverityBadge severity={selectedIncident.severity} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Reported {timeAgo(selectedIncident.reported_at)}</span>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Location</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{selectedIncident.location_description}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{selectedIncident.description}</div>
            </div>
            {selectedIncident.actions_taken?.length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 8 }}>Action Log</div>
                {selectedIncident.actions_taken.map((a: any, i: number) => (
                  <div key={i} style={{ borderLeft: '2px solid var(--border-default)', paddingLeft: 12, marginBottom: 8, fontSize: 'var(--text-sm)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{new Date(a.timestamp).toLocaleTimeString()}</div>
                    <div style={{ color: 'var(--text-primary)' }}>{a.action}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
