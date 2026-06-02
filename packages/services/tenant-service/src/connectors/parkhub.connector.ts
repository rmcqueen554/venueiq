import axios from 'axios';
import { publishEvent, KAFKA_TOPICS, logger } from '@venueiq/shared-utils';
import { ParkingEntryEvent } from '@venueiq/shared-types';

const PARKHUB_API = 'https://api.parkhub.com';

export const parkhubConnector = {
  async testConnection(apiKey: string): Promise<{ ok: boolean; message: string }> {
    try {
      await axios.get(`${PARKHUB_API}/v1/lots`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return { ok: true, message: 'ParkHub connected successfully' };
    } catch (err: any) {
      return { ok: false, message: `ParkHub connection failed: ${err.message}` };
    }
  },

  async fetchLots(apiKey: string) {
    const resp = await axios.get(`${PARKHUB_API}/v1/lots`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return resp.data.lots ?? [];
  },

  async fetchLotOccupancy(apiKey: string, lotId: string) {
    const resp = await axios.get(`${PARKHUB_API}/v1/lots/${lotId}/occupancy`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return resp.data;
  },

  async fetchTransactions(apiKey: string, lotId: string, startDate: Date) {
    const resp = await axios.get(`${PARKHUB_API}/v1/transactions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      params: { lot_id: lotId, start_date: startDate.toISOString(), limit: 500 },
    });
    return resp.data.transactions ?? [];
  },

  parseWebhookEntry(tenantId: string, eventId: string, payload: Record<string, unknown>): ParkingEntryEvent {
    return {
      schema_version: '1.0',
      tenant_id: tenantId,
      event_id: eventId,
      lot_id: String(payload.lot_id ?? ''),
      transaction_id: String(payload.transaction_id ?? ''),
      entry_type: payload.direction === 'out' ? 'exit' : 'entry',
      vehicle_type: 'car',
      revenue: payload.amount ? Number(payload.amount) : null,
      pre_sold: Boolean(payload.pre_sold ?? false),
      occurred_at: String(payload.timestamp ?? new Date().toISOString()),
    };
  },

  async publishParkingEntry(tenantId: string, entry: ParkingEntryEvent): Promise<void> {
    await publishEvent(KAFKA_TOPICS.PARKING_ENTRIES, `${tenantId}-${entry.transaction_id}`, entry);
  },
};
