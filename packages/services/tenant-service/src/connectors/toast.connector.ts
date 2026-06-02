import axios from 'axios';
import { publishEvent, KAFKA_TOPICS, logger } from '@venueiq/shared-utils';
import { PosTransactionEvent } from '@venueiq/shared-types';

const TOAST_API = 'https://ws-api.toasttab.com';

export interface ToastCredentials {
  client_id: string;
  client_secret: string;
  restaurant_guid: string;
  access_token?: string;
}

export const toastConnector = {
  async getAccessToken(creds: ToastCredentials): Promise<string> {
    const resp = await axios.post(`${TOAST_API}/authentication/v1/authentication/login`, {
      clientId: creds.client_id,
      clientSecret: creds.client_secret,
      userAccessType: 'TOAST_MACHINE_CLIENT',
    });
    return resp.data.token.accessToken;
  },

  async testConnection(creds: ToastCredentials): Promise<{ ok: boolean; message: string }> {
    try {
      await this.getAccessToken(creds);
      return { ok: true, message: 'Toast POS connected successfully' };
    } catch (err: any) {
      return { ok: false, message: `Toast connection failed: ${err.message}` };
    }
  },

  async fetchOrders(creds: ToastCredentials, startDate: Date, endDate: Date) {
    const token = await this.getAccessToken(creds);
    const resp = await axios.get(`${TOAST_API}/orders/v2/orders`, {
      headers: { Authorization: `Bearer ${token}`, 'Toast-Restaurant-External-ID': creds.restaurant_guid },
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        pageSize: 100,
      },
    });
    return resp.data.orders ?? [];
  },

  async syncToKafka(
    tenantId: string,
    eventId: string,
    standId: string,
    creds: ToastCredentials,
    startDate: Date,
  ): Promise<number> {
    const orders = await this.fetchOrders(creds, startDate, new Date());
    let synced = 0;

    for (const order of orders) {
      if (!order.closedDate) continue; // only closed orders

      const txn: PosTransactionEvent = {
        schema_version: '1.0',
        tenant_id: tenantId,
        event_id: eventId,
        transaction_id: order.guid,
        stand_id: standId,
        stand_type: 'concessions',
        operator_id: order.server?.guid ?? null,
        items: (order.checks ?? []).flatMap((check: any) =>
          (check.selections ?? []).map((sel: any) => ({
            product_id: sel.item?.guid ?? sel.itemGroup?.guid ?? 'unknown',
            product_name: sel.displayName,
            sku: sel.item?.sku ?? '',
            quantity: sel.quantity,
            unit_price: (sel.unitOfMeasure === 'NONE' ? sel.price : sel.price / sel.quantity) / 100,
            line_total: sel.price / 100,
            category: sel.item?.menuGroup?.name ?? 'Other',
          }))
        ),
        subtotal: order.checks?.reduce((s: number, c: any) => s + c.totalAmount, 0) / 100 ?? 0,
        tax: order.checks?.reduce((s: number, c: any) => s + c.taxAmount, 0) / 100 ?? 0,
        total: order.totalAmount / 100,
        payment_method: 'card',
        fan_id: null,
        source_system: 'toast',
        occurred_at: order.closedDate,
      };

      await publishEvent(KAFKA_TOPICS.POS_TRANSACTIONS, `${tenantId}-${order.guid}`, txn);
      synced++;
    }

    logger.info({ tenant_id: tenantId, synced }, 'Toast orders synced to Kafka');
    return synced;
  },
};
