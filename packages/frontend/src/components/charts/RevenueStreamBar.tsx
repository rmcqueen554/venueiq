import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface RevenueStream {
  name: string;
  actual: number;
  forecast: number;
}

interface RevenueStreamBarProps {
  data: RevenueStream[];
  height?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border-hover)',
      borderRadius: 'var(--radius)',
      padding: '10px 14px',
      fontSize: 'var(--text-xs)',
    }}>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
          <span>{p.name}</span>
          <span style={{ color: p.fill, fontWeight: 600 }}>${(p.value / 1000).toFixed(0)}K</span>
        </div>
      ))}
    </div>
  );
};

export function RevenueStreamBar({ data, height = 280 }: RevenueStreamBarProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="actual"   name="Actual"   fill="var(--accent)"        radius={[4,4,0,0]} />
        <Bar dataKey="forecast" name="Forecast" fill="rgba(255,255,255,0.08)" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
