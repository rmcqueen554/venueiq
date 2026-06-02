import { callClaude, logger } from '@venueiq/shared-utils';
import { UserRole } from '@venueiq/shared-types';

// Role → allowed tables mapping (enforced at SQL generation level)
const ROLE_TABLE_ACCESS: Record<string, string[]> = {
  platform_super_admin: ['*'],
  venue_owner: ['*'],
  general_manager: ['*'],
  coo: ['*'],
  cfo: ['mv_event_revenue_summary', 'mv_concession_performance', 'mv_fan_lifetime_value', 'mv_sponsor_roi_summary', 'mv_attendance_trend', 'mv_operational_efficiency', 'events', 'revenue_forecasts', 'daily_briefings'],
  concessions_director: ['mv_concession_performance', 'pos_transactions', 'stands', 'products', 'inventory_levels', 'concession_forecasts', 'waste_records'],
  merchandise_director: ['merch_transactions', 'merch_locations', 'merch_products', 'merch_inventory', 'merch_forecasts'],
  ticketing_director: ['ticket_sales', 'fan_profiles', 'season_tickets', 'pricing_recommendations', 'attendance_forecasts'],
  sponsorship_director: ['sponsors', 'sponsorship_contracts', 'activations', 'sponsorship_inventory', 'sponsor_roi'],
  security_director: ['security_incidents', 'access_events', 'security_posts', 'crowd_density_readings', 'banned_patrons'],
  facilities_manager: ['assets', 'maintenance_work_orders', 'iot_sensor_readings', 'energy_readings', 'inspections'],
  event_manager: ['events', 'mv_event_revenue_summary', 'operational_alerts', 'staff_schedules'],
  marketing_director: ['fan_profiles', 'nps_responses', 'social_mentions', 'app_sessions', 'loyalty_tiers'],
  parking_director: ['parking_lots', 'parking_transactions', 'parking_occupancy', 'approach_traffic'],
  premium_hospitality_director: ['suite_bookings', 'fan_profiles', 'nps_responses'],
  operations_director: ['staff_schedules', 'vendor_contracts', 'vendor_performance', 'operational_alerts', 'zone_occupancy', 'department_budgets'],
};

const WAREHOUSE_SCHEMA = `
-- VenueIQ Data Warehouse Schema (AWS Redshift / local Postgres)
-- All tables have tenant_id column (RLS enforced via query injection)

-- Materialized views (fast aggregations)
mv_event_revenue_summary(event_id, event_name, event_date, tenant_id, ticketing_revenue, concessions_revenue, merchandise_revenue, parking_revenue, sponsorship_revenue, total_revenue, total_forecast, attendance)
mv_concession_performance(event_id, stand_id, stand_name, tenant_id, revenue, forecast, variance_pct, transactions, revenue_per_transaction, labor_cost, revenue_per_labor_hour)
mv_fan_lifetime_value(fan_id, tenant_id, email, loyalty_tier, lifetime_value, events_attended, avg_spend_per_event, first_event, last_event)
mv_sponsor_roi_summary(sponsor_id, sponsor_name, tenant_id, event_id, contracted_value, delivered_value, delivery_rate, media_value_estimate)
mv_attendance_trend(event_id, event_type, event_date, tenant_id, actual_attendance, expected_attendance, no_show_rate, gate_scan_count)
mv_operational_efficiency(event_id, department, tenant_id, labor_cost, revenue, cost_per_labor_hour, staff_scheduled, staff_actual)

-- Raw tables (direct query when needed)
events(id, name, type, opponent_or_artist, scheduled_at, status, expected_attendance, tenant_id)
pos_transactions(id, stand_id, event_id, total, occurred_at, items, tenant_id)
ticket_sales(id, event_id, section, price, ticket_type, fan_id, sold_at, scanned_at, tenant_id)
fan_profiles(id, email, loyalty_tier, lifetime_value, last_purchase_date, tenant_id)
season_tickets(id, fan_id, renewal_status, renewal_likelihood_score, account_value, tenant_id)
sponsors(id, name, tier, contract_value, contract_end, health_score, renewal_status, tenant_id)
activations(id, sponsor_id, event_id, type, scheduled, completed, tenant_id)
parking_lots(id, name, total_spaces, tenant_id)
parking_occupancy(lot_id, occupied_spaces, fill_pct, occurred_at, tenant_id)
security_incidents(id, type, severity, location_description, reported_at, resolved_at, tenant_id)
assets(id, name, type, health_score, failure_probability, last_maintenance, tenant_id)
maintenance_work_orders(id, asset_id, type, priority, status, scheduled_at, cost, tenant_id)
nps_responses(id, event_id, score, category, sentiment, occurred_at, tenant_id)
staff_schedules(id, event_id, department, employee_id, scheduled_start, scheduled_end, actual_start, actual_end, hourly_rate, tenant_id)
vendor_contracts(id, vendor_name, service_type, contract_value, sla_terms, tenant_id)
`;

const SYSTEM_PROMPT = `You are a SQL expert for VenueIQ, a stadium operations intelligence platform.
Your job is to convert natural language questions into accurate PostgreSQL/Redshift SQL queries.

Rules:
1. ALWAYS add WHERE tenant_id = '{TENANT_ID}' to every query.
2. ONLY query the tables/views listed in the schema — never fabricate tables.
3. Use materialized views (mv_*) whenever possible for performance.
4. Return only SELECT queries — never INSERT, UPDATE, DELETE, DROP, or any DDL.
5. If the question cannot be answered with the available schema, respond with {"error": "data_not_available", "reason": "explanation"}.
6. Limit results to 1000 rows unless the user asks for totals/aggregates.
7. Respond in JSON: {"sql": "...", "explanation": "one sentence explaining what this query returns"}`;

export const sqlGeneratorService = {
  async generateSql(
    tenantId: string,
    userRole: string,
    question: string,
    conversationHistory: Array<{ role: string; content: string }>,
  ): Promise<{ sql: string | null; explanation: string; error?: string }> {
    const allowedTables = ROLE_TABLE_ACCESS[userRole] ?? ROLE_TABLE_ACCESS['event_manager'];
    const tableFilter = allowedTables.includes('*')
      ? ''
      : `\n\nIMPORTANT — This user's role (${userRole}) can ONLY access these tables: ${allowedTables.join(', ')}. Do not query any other tables.`;

    const systemWithRole = `${SYSTEM_PROMPT}${tableFilter}\n\nSchema:\n${WAREHOUSE_SCHEMA}`;

    const messages = [
      ...conversationHistory.slice(-6), // last 3 turns for context
      { role: 'user' as const, content: `Question: ${question}\n\nGenerate SQL for tenant_id = '${tenantId}'.` },
    ];

    const response = await callClaude({
      tenant_id: tenantId,
      service: 'nlq_sql_generator',
      system: systemWithRole,
      messages,
      max_tokens: 800,
      use_cache: true,
    });

    try {
      const parsed = JSON.parse(response.content);
      if (parsed.error) return { sql: null, explanation: parsed.reason ?? 'Data not available', error: parsed.error };

      // Final safety check: inject tenant_id if Claude missed it
      let sql = parsed.sql as string;
      if (!sql.toLowerCase().includes('tenant_id')) {
        logger.warn({ sql }, 'SQL missing tenant_id — injecting');
        sql = sql.replace(/WHERE/i, `WHERE tenant_id = '${tenantId}' AND`);
        if (!sql.toLowerCase().includes('where')) sql += ` WHERE tenant_id = '${tenantId}'`;
      }

      return { sql, explanation: parsed.explanation ?? '' };
    } catch {
      return { sql: null, explanation: 'Could not generate SQL for this question', error: 'parse_error' };
    }
  },
};
