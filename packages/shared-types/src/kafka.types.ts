// All Kafka message schemas — every topic's payload is typed here

export interface KafkaMessage<T = unknown> {
  topic: string;
  partition: number;
  offset: string;
  key: string;
  value: T;
  timestamp: string;
}

// ── POS Transactions ──────────────────────────────────────────────────────
export interface PosTransactionEvent {
  schema_version: '1.0';
  tenant_id: string;
  event_id: string;
  transaction_id: string;
  stand_id: string;
  stand_type: 'concessions' | 'merchandise';
  operator_id: string | null;
  items: PosLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  payment_method: 'card' | 'cash' | 'mobile' | 'tab';
  fan_id: string | null;
  source_system: string;
  occurred_at: string; // ISO 8601
}

export interface PosLineItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  category: string;
}

// ── Gate Scans ────────────────────────────────────────────────────────────
export interface GateScanEvent {
  schema_version: '1.0';
  tenant_id: string;
  event_id: string;
  gate_id: string;
  gate_name: string;
  credential_id: string;
  fan_id: string | null;
  scan_type: 'entry' | 'exit' | 'denied' | 'forced';
  ticket_type: string | null;
  section: string | null;
  occurred_at: string;
}

// ── Parking Entry/Exit ────────────────────────────────────────────────────
export interface ParkingEntryEvent {
  schema_version: '1.0';
  tenant_id: string;
  event_id: string;
  lot_id: string;
  transaction_id: string;
  entry_type: 'entry' | 'exit';
  vehicle_type: 'car' | 'truck' | 'motorcycle' | 'bus';
  revenue: number | null;
  pre_sold: boolean;
  occurred_at: string;
}

// ── Security Incidents ────────────────────────────────────────────────────
export interface SecurityIncidentEvent {
  schema_version: '1.0';
  tenant_id: string;
  event_id: string;
  incident_id: string;
  incident_type: 'fight' | 'medical' | 'theft' | 'ejection' | 'suspicious_item' | 'crowd_crush_risk' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  location_description: string;
  location_x: number | null;
  location_y: number | null;
  reported_by: string;
  occurred_at: string;
}

// ── IoT Sensor Readings ───────────────────────────────────────────────────
export interface IoTSensorReadingEvent {
  schema_version: '1.0';
  tenant_id: string;
  asset_id: string;
  sensor_type: 'hvac' | 'energy' | 'elevator' | 'generator' | 'scoreboard' | 'motion' | 'smoke' | 'crowd_counter';
  metric_name: string;
  value: number;
  unit: string;
  zone_id: string | null;
  occurred_at: string;
}

// ── Agent Output ──────────────────────────────────────────────────────────
export interface AgentOutputEvent {
  schema_version: '1.0';
  tenant_id: string;
  agent_name: string;
  output_type: string;
  severity: string | null;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  requires_approval: boolean;
  auto_executed: boolean;
  occurred_at: string;
}

// ── Module KPI Snapshot (for Redshift ingestion) ──────────────────────────
export interface ModuleKpiSnapshotEvent {
  schema_version: '1.0';
  tenant_id: string;
  event_id: string | null;
  module: string;
  kpis: Record<string, number | string | null>;
  snapshot_at: string;
}

// ── Topic names ───────────────────────────────────────────────────────────
export const KAFKA_TOPICS = {
  POS_TRANSACTIONS: 'venueiq.pos.transactions',
  GATE_SCANS: 'venueiq.security.gate_scans',
  PARKING_ENTRIES: 'venueiq.parking.entries',
  SECURITY_INCIDENTS: 'venueiq.security.incidents',
  IOT_SENSOR_READINGS: 'venueiq.facilities.iot_readings',
  AGENT_OUTPUTS: 'venueiq.agents.outputs',
  MODULE_KPI_SNAPSHOTS: 'venueiq.analytics.kpi_snapshots',
  AUTOMATION_TRIGGERS: 'venueiq.automation.triggers',
  NOTIFICATION_REQUESTS: 'venueiq.notifications.requests',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];
