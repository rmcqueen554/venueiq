import { FastifyInstance } from 'fastify';
import { publishEvent, KAFKA_TOPICS, logger } from '@venueiq/shared-utils';

// Generic webhook receiver for any source system not in the connector library
// Venue configures field mapping during onboarding
export async function registerGenericWebhookRoutes(app: FastifyInstance) {
  // All generic webhooks POST to /webhooks/{tenant_id}/{source_type}
  app.post('/webhooks/:tenant_id/:source_type', async (request, reply) => {
    const { tenant_id, source_type } = request.params as any;
    const payload = request.body as Record<string, unknown>;

    logger.info({ tenant_id, source_type, payload_keys: Object.keys(payload) }, 'Generic webhook received');

    // Route to correct Kafka topic based on source_type hint
    if (source_type.includes('pos') || source_type.includes('concession')) {
      await publishEvent(KAFKA_TOPICS.POS_TRANSACTIONS, tenant_id, {
        schema_version: '1.0',
        tenant_id,
        event_id: String(payload.event_id ?? ''),
        transaction_id: String(payload.id ?? payload.transaction_id ?? ''),
        stand_id: String(payload.stand_id ?? payload.location_id ?? ''),
        stand_type: 'concessions',
        operator_id: null,
        items: [],
        subtotal: Number(payload.subtotal ?? payload.amount ?? 0),
        tax: Number(payload.tax ?? 0),
        total: Number(payload.total ?? payload.amount ?? 0),
        payment_method: String(payload.payment_method ?? 'card'),
        fan_id: null,
        source_system: source_type,
        occurred_at: String(payload.timestamp ?? payload.occurred_at ?? new Date().toISOString()),
      });
    } else if (source_type.includes('gate') || source_type.includes('access')) {
      await publishEvent(KAFKA_TOPICS.GATE_SCANS, tenant_id, {
        schema_version: '1.0',
        tenant_id,
        event_id: String(payload.event_id ?? ''),
        gate_id: String(payload.gate_id ?? 'unknown'),
        gate_name: String(payload.gate_name ?? 'Unknown'),
        credential_id: String(payload.credential_id ?? payload.barcode ?? ''),
        fan_id: null,
        scan_type: String(payload.scan_type ?? 'entry'),
        ticket_type: String(payload.ticket_type ?? null),
        section: String(payload.section ?? null),
        occurred_at: String(payload.timestamp ?? new Date().toISOString()),
      });
    } else if (source_type.includes('iot') || source_type.includes('sensor')) {
      await publishEvent(KAFKA_TOPICS.IOT_SENSOR_READINGS, tenant_id, {
        schema_version: '1.0',
        tenant_id,
        asset_id: String(payload.asset_id ?? payload.device_id ?? ''),
        sensor_type: String(payload.sensor_type ?? 'other'),
        metric_name: String(payload.metric ?? payload.metric_name ?? 'value'),
        value: Number(payload.value ?? 0),
        unit: String(payload.unit ?? ''),
        zone_id: payload.zone_id ? String(payload.zone_id) : null,
        occurred_at: String(payload.timestamp ?? new Date().toISOString()),
      });
    }

    return reply.send({ success: true, received: true });
  });
}
