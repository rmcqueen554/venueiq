// Dynamic venue accent color injection
// Called at app boot with the tenant's primary color from white_label_config

export function applyVenueTheme(primaryColor?: string | null, appName?: string | null): void {
  const root = document.documentElement;
  const accent = primaryColor ?? '#E8A838'; // Default VenueIQ amber

  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', lighten(accent, 10));
  root.style.setProperty('--accent-dim', hexToRgba(accent, 0.12));
  root.style.setProperty('--accent-glow', hexToRgba(accent, 0.25));

  if (appName) {
    document.title = appName;
    const metaTitle = document.querySelector('meta[name="application-name"]');
    if (metaTitle) metaTitle.setAttribute('content', appName);
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const r = Math.min(255, parseInt(clean.substring(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(clean.substring(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(clean.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Recharts theme — use CSS variables
export const rechartsTheme = {
  accent: 'var(--accent)',
  green: 'var(--status-green)',
  amber: 'var(--status-amber)',
  red: 'var(--status-red)',
  blue: 'var(--status-blue)',
  gridColor: 'var(--border-default)',
  textColor: 'var(--text-tertiary)',
};
