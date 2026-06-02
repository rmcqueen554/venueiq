// Domain types for operational modules

// ── Concessions ───────────────────────────────────────────────────────────
export interface Stand {
  id: string;
  tenant_id: string;
  venue_id: string;
  name: string;
  location_x: number;
  location_y: number;
  type: 'concessions' | 'bar' | 'kiosk';
  capacity_per_hour: number;
  active: boolean;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  sku: string;
  active: boolean;
}

export interface InventoryLevel {
  stand_id: string;
  product_id: string;
  quantity: number;
  par_level: number;
  updated_at: Date;
}

export interface StockoutPrediction {
  stand_id: string;
  product_id: string;
  current_quantity: number;
  depletion_rate_per_hour: number;
  estimated_stockout_minutes: number;
  confidence: number;
}

// ── Ticketing ─────────────────────────────────────────────────────────────
export interface TicketSale {
  id: string;
  tenant_id: string;
  event_id: string;
  section: string;
  row: string | null;
  seat: string | null;
  price: number;
  ticket_type: 'general' | 'premium' | 'suite' | 'standing' | 'vip' | 'group' | 'comp';
  fan_id: string | null;
  sold_at: Date;
  scanned_at: Date | null;
}

export interface SeasonTicket {
  id: string;
  tenant_id: string;
  fan_id: string;
  section: string;
  seats: string[];
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  renewal_status: 'renewed' | 'pending' | 'at_risk' | 'lapsed';
  renewal_likelihood_score: number;
  account_value: number;
}

export interface PricingRecommendation {
  id: string;
  tenant_id: string;
  event_id: string;
  target_type: 'ticket_section' | 'concession_product' | 'parking_lot';
  target_id: string;
  current_price: number;
  recommended_price: number;
  rationale: string;
  expected_revenue_lift: number;
  approved_by: string | null;
  applied_at: Date | null;
  expires_at: Date;
}

// ── Sponsorship ───────────────────────────────────────────────────────────
export interface Sponsor {
  id: string;
  tenant_id: string;
  name: string;
  tier: 'title' | 'presenting' | 'associate' | 'supporting';
  contract_value: number;
  contract_start: Date;
  contract_end: Date;
  renewal_status: 'active' | 'pending_renewal' | 'at_risk' | 'lapsed';
  health_score: number;
}

export interface Activation {
  id: string;
  tenant_id: string;
  sponsor_id: string;
  event_id: string;
  type: 'led_board' | 'pa_announcement' | 'in_venue_signage' | 'social_post' | 'mobile_push' | 'vip_hospitality' | 'video_board';
  scheduled: boolean;
  completed: boolean;
  proof_url: string | null;
  impressions: number | null;
}

// ── Security ──────────────────────────────────────────────────────────────
export interface SecurityIncident {
  id: string;
  tenant_id: string;
  event_id: string;
  type: 'fight' | 'medical' | 'theft' | 'ejection' | 'suspicious_item' | 'crowd_crush_risk' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  location_description: string;
  location_x: number | null;
  location_y: number | null;
  reported_at: Date;
  resolved_at: Date | null;
  reported_by: string;
  description: string;
  actions_taken: IncidentAction[];
}

export interface IncidentAction {
  timestamp: string;
  actor: string;
  action: string;
  note: string | null;
}

// ── Facilities ────────────────────────────────────────────────────────────
export type AssetHealth = 'healthy' | 'maintenance_due' | 'fault';

export interface Asset {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  location_id: string | null;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  install_date: Date | null;
  warranty_expiry: Date | null;
  last_maintenance: Date | null;
  maintenance_interval_days: number;
  health_score: number;
}

export interface MaintenanceWorkOrder {
  id: string;
  tenant_id: string;
  asset_id: string;
  type: 'preventive' | 'corrective' | 'predictive';
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to: string | null;
  scheduled_at: Date | null;
  completed_at: Date | null;
  cost: number | null;
}

// ── Parking ───────────────────────────────────────────────────────────────
export interface ParkingLot {
  id: string;
  tenant_id: string;
  name: string;
  total_spaces: number;
  type: 'surface' | 'garage';
  location_x: number;
  location_y: number;
  entry_gates: string[];
}

// ── Fan Experience ────────────────────────────────────────────────────────
export interface FanProfile {
  id: string;
  tenant_id: string;
  external_crm_id: string | null;
  email: string | null;
  loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  lifetime_value: number;
  first_purchase_date: Date | null;
  last_purchase_date: Date | null;
  renewal_score: number | null;
}

export interface NpsResponse {
  id: string;
  tenant_id: string;
  event_id: string;
  fan_id: string | null;
  score: number;
  verbatim: string | null;
  category: string | null;
  sentiment: 'positive' | 'neutral' | 'negative';
  timestamp: Date;
}

// ── Automation ────────────────────────────────────────────────────────────
export type AutomationTriggerType = 'kpi_threshold' | 'schedule' | 'event_lifecycle' | 'manual' | 'agent_output';
export type AutomationActionType = 'notify' | 'generate_report' | 'create_task' | 'webhook' | 'update_record';

export interface AutomationRule {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, unknown>;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
  active: boolean;
  last_triggered_at: Date | null;
  created_by: string;
}
