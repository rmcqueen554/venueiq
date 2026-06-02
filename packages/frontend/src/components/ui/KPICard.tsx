import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SparklineChart } from './SparklineChart';

interface KPICardProps {
  label: string;
  value: string | number;
  formatted?: string;
  delta_pct?: number | null;
  vs_forecast?: number | null;
  sparkline?: number[];
  onClick?: () => void;
  loading?: boolean;
}

export function KPICard({ label, value, formatted, delta_pct, vs_forecast, sparkline, onClick, loading }: KPICardProps) {
  if (loading) {
    return (
      <div className="card skeleton" style={{ height: 110 }} />
    );
  }

  const isPositive = (delta_pct ?? 0) > 0;
  const isNegative = (delta_pct ?? 0) < 0;
  const deltaColor = isPositive ? 'var(--status-green)' : isNegative ? 'var(--status-red)' : 'var(--text-tertiary)';
  const DeltaIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: 'var(--space-4)',
      }}
    >
      {/* Accent bar */}
      <div className="accent-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />

      <div style={{ marginTop: 'var(--space-2)' }}>
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 'var(--space-2)',
        }}>
          {label}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-4xl)',
              color: 'var(--text-primary)',
              lineHeight: 1,
              marginBottom: 'var(--space-1)',
            }}>
              {formatted ?? value}
            </div>

            {delta_pct != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)' }}>
                <DeltaIcon size={12} style={{ color: deltaColor }} />
                <span style={{ color: deltaColor, fontWeight: 600 }}>
                  {isPositive ? '+' : ''}{delta_pct.toFixed(1)}%
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>vs forecast</span>
              </div>
            )}
          </div>

          {sparkline && sparkline.length > 2 && (
            <SparklineChart
              data={sparkline}
              width={80}
              height={36}
              color={isNegative ? 'var(--status-red)' : 'var(--status-green)'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
