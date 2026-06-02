import React from 'react';

interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ height = 20, width = '100%', borderRadius, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ height, width, borderRadius: borderRadius ?? 'var(--radius)', ...style }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton height={12} width="40%" />
      <Skeleton height={40} width="70%" />
      <Skeleton height={12} width="60%" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, padding: '12px 16px' }}>
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} width="60%" />
        </div>
      ))}
    </div>
  );
}
