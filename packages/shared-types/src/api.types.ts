// Shared API response envelope and common request/response types

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiMeta {
  total?: number;
  page?: number;
  per_page?: number;
  has_more?: boolean;
}

export interface PaginatedQuery {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

// ── KPI Types ─────────────────────────────────────────────────────────────
export interface KpiValue {
  value: number;
  formatted: string;
  delta_pct: number | null;
  delta_direction: 'up' | 'down' | 'neutral' | null;
  vs_forecast: number | null;
  vs_prior_year: number | null;
  sparkline: number[];
}

export interface ModuleHealth {
  module: string;
  status: 'healthy' | 'warning' | 'critical';
  top_kpi_label: string;
  top_kpi_value: KpiValue;
  ai_summary: string;
  last_updated: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export interface ExecutiveDashboardResponse {
  briefing: DailyBriefing;
  kpi_strip: ExecutiveKpiStrip;
  department_health: ModuleHealth[];
  risk_opportunities: RiskOpportunityItem[];
  revenue_streams: RevenueStream[];
  forecast_events: EventForecast[];
  is_event_day: boolean;
  live_event: LiveEventSummary | null;
}

export interface DailyBriefing {
  id: string;
  content: string;
  generated_at: string;
  event_date: string | null;
}

export interface ExecutiveKpiStrip {
  total_revenue: KpiValue;
  attendance: KpiValue;
  concession_per_cap: KpiValue;
  merch_per_cap: KpiValue;
  parking_revenue: KpiValue;
  sponsorship_activations: KpiValue;
}

export interface RiskOpportunityItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  module: string;
  title: string;
  description: string;
  recommended_action: string;
  created_at: string;
  dismissed: boolean;
}

export interface RevenueStream {
  name: string;
  actual: number;
  forecast: number;
  prior_year: number;
  timeline: { hour: number; revenue: number }[];
}

export interface EventForecast {
  event_id: string;
  event_name: string;
  event_date: string;
  event_type: string;
  expected_attendance: number;
  projected_revenue: number;
  confidence_lower: number;
  confidence_upper: number;
  ticket_sales_pct: number;
}

export interface LiveEventSummary {
  event_id: string;
  event_name: string;
  started_at: string;
  elapsed_minutes: number;
  attendance_scanned: number;
  revenue_to_date: number;
  weather: {
    temp_f: number;
    condition: string;
    precip_pct: number;
  } | null;
}

// ── NLQ ───────────────────────────────────────────────────────────────────
export interface NlqQueryRequest {
  question: string;
  session_id: string;
  context_page?: string;
}

export interface NlqStreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  query_id?: string;
  sql?: string;
  error?: string;
}

// ── Approval ──────────────────────────────────────────────────────────────
export interface ApprovalAction {
  output_id: string;
  action: 'approve' | 'reject';
  note?: string;
}

// ── Notification ──────────────────────────────────────────────────────────
export interface NotificationRequest {
  tenant_id: string;
  channel: 'teams' | 'slack' | 'email' | 'sms' | 'push';
  recipients: string[];
  title: string;
  body: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  action_url?: string;
}
