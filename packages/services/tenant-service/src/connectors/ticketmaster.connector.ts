import axios from 'axios';
import { publishEvent, KAFKA_TOPICS, logger } from '@venueiq/shared-utils';
import { GateScanEvent } from '@venueiq/shared-types';

const TM_API = 'https://app.ticketmaster.com';

export const ticketmasterConnector = {
  async testConnection(apiKey: string): Promise<{ ok: boolean; message: string }> {
    try {
      await axios.get(`${TM_API}/discovery/v2/events.json`, {
        params: { apikey: apiKey, size: 1 },
      });
      return { ok: true, message: 'Ticketmaster API connected' };
    } catch (err: any) {
      return { ok: false, message: `Ticketmaster connection failed: ${err.message}` };
    }
  },

  async fetchTicketSales(apiKey: string, attractionId: string) {
    const resp = await axios.get(`${TM_API}/commerce/v2/shopping/events/${attractionId}/products.json`, {
      params: { apikey: apiKey },
    });
    return resp.data._embedded?.products ?? [];
  },

  // Webhook receiver for real-time gate scans
  parseGateScanWebhook(
    tenantId: string,
    eventId: string,
    payload: Record<string, unknown>,
  ): GateScanEvent {
    return {
      schema_version: '1.0',
      tenant_id: tenantId,
      event_id: eventId,
      gate_id: String(payload.gateId ?? 'unknown'),
      gate_name: String(payload.gateName ?? 'Unknown Gate'),
      credential_id: String(payload.barcode ?? payload.credentialId ?? ''),
      fan_id: null,
      scan_type: payload.allowed === true ? 'entry' : 'denied',
      ticket_type: String(payload.ticketType ?? 'general'),
      section: String(payload.section ?? ''),
      occurred_at: String(payload.timestamp ?? new Date().toISOString()),
    };
  },

  async publishGateScan(tenantId: string, scan: GateScanEvent): Promise<void> {
    await publishEvent(KAFKA_TOPICS.GATE_SCANS, `${tenantId}-${scan.credential_id}`, scan);
  },
};
