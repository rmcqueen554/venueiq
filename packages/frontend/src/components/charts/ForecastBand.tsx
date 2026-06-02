import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';

interface ForecastPoint {
  label: string;
  actual?: number;
  forecast: number;
  lower: number;
  upper: number;
}

export function ForecastBand({ data, height = 200 }: { data: ForecastPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--status-blue)" stopOpacity={0.12} />
            <stop offset="95%" stopColor="var(--status-blue)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-hover)', borderRadius: 8, fontSize: 11 }}
          formatter={(v: number, name: string) => [`$${(v/1000).toFixed(0)}K`, name]}
        />
        <Area dataKey="upper"    stroke="none" fill="url(#bandGrad)" />
        <Area dataKey="lower"    stroke="none" fill="var(--surface-base)" />
        <Line type="monotone" dataKey="forecast" stroke="var(--status-blue)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
        {data.some((d) => d.actual) && (
          <Line type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
