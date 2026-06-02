export type AgentName =
  | 'coo_agent'
  | 'revenue_agent'
  | 'concessions_agent'
  | 'sponsorship_agent'
  | 'ticketing_agent'
  | 'security_agent'
  | 'facilities_agent'
  | 'executive_strategy_agent';

export type AgentOutputType = 'recommendation' | 'alert' | 'report' | 'automation';
export type AgentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AgentOutput {
  id: string;
  tenant_id: string;
  agent_name: AgentName;
  output_type: AgentOutputType;
  severity: AgentSeverity | null;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: Date | null;
  rejected_by: string | null;
  rejected_at: Date | null;
  auto_executed: boolean;
  executed_at: Date | null;
  event_id: string | null;
  created_at: Date;
}

export interface AgentTriggerEvent {
  type: 'cron' | 'kafka_event';
  agent: AgentName;
  tenant_id: string;
  event_id?: string;
  payload?: Record<string, unknown>;
}

export interface AgentContext {
  tenant_id: string;
  tenant_name: string;
  event?: {
    id: string;
    name: string;
    type: string;
    scheduled_at: Date;
    expected_attendance: number | null;
  };
  kpis: Record<string, number | string | null>;
  anomalies: AnomalyDetection[];
  open_alerts: AgentOutput[];
}

export interface AnomalyDetection {
  module: string;
  metric: string;
  current_value: number;
  expected_value: number;
  deviation_pct: number;
  severity: AgentSeverity;
  detected_at: Date;
}

export interface ClaudeApiCallLog {
  id: string;
  tenant_id: string;
  agent_name: AgentName | 'nlq' | 'reporting';
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  prompt_hash: string;
  response_length: number;
  latency_ms: number;
  created_at: Date;
}
