// Date utilities — timezone-aware, venue-local-time focused

export function toVenueTime(date: Date, timezone: string): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
}

export function isEventDay(event: { scheduled_at: Date }, timezone: string): boolean {
  const now = toVenueTime(new Date(), timezone);
  const eventDate = toVenueTime(event.scheduled_at, timezone);
  return (
    now.getFullYear() === eventDate.getFullYear() &&
    now.getMonth() === eventDate.getMonth() &&
    now.getDate() === eventDate.getDate()
  );
}

export function minutesUntilEvent(scheduledAt: Date): number {
  return Math.floor((scheduledAt.getTime() - Date.now()) / 60_000);
}

export function hoursUntilEvent(scheduledAt: Date): number {
  return minutesUntilEvent(scheduledAt) / 60;
}

export function eventElapsedMinutes(startedAt: Date): number {
  return Math.floor((Date.now() - startedAt.getTime()) / 60_000);
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfDay(date: Date, timezone: string): Date {
  const local = toVenueTime(date, timezone);
  local.setHours(0, 0, 0, 0);
  return local;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPct(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}
