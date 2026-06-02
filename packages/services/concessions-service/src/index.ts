import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { clerkPlugin } from '@clerk/fastify';
import { logger, createConsumer, subscribeAndProcess, KAFKA_TOPICS, createPrismaClient, publishEvent } from '@venueiq/shared-utils';
import type { PosTransactionEvent } from '@venueiq/shared-types';

const prisma = createPrismaClient(process.env.CONCESSIONS_DATABASE_URL!);
const app = Fastify({ logger: false });

async function bootstrap() {
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*', credentials: true });
  await app.register(clerkPlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'concessions-service' }));

  // ── Stands ────────────────────────────────────────────────────────────────
  app.get('/api/concessions/stands/live', async (request, reply) => {
    const { tenant_id, event_id } = request.query as any;
    const stands = await prisma.stand.findMany({ where: { tenant_id, active: true } });

    const enriched = await Promise.all(stands.map(async (stand) => {
      const inventory = await prisma.inventoryLevel.findMany({ where: { tenant_id, stand_id: stand.id } });
      const forecast = await prisma.concessionForecast.findMany({ where: { tenant_id, event_id, stand_id: stand.id } });
      return { ...stand, inventory, forecast };
    }));

    return { success: true, data: enriched };
  });

  // ── POS Transactions ──────────────────────────────────────────────────────
  app.get('/api/concessions/transactions', async (request, reply) => {
    const { tenant_id, event_id, stand_id, limit = '100' } = request.query as any;
    const txns = await prisma.posTransaction.findMany({
      where: { tenant_id, event_id, ...(stand_id ? { stand_id } : {}) },
      orderBy: { occurred_at: 'desc' },
      take: parseInt(limit),
    });
    return { success: true, data: txns };
  });

  // ── Inventory ─────────────────────────────────────────────────────────────
  app.get('/api/concessions/inventory', async (request, reply) => {
    const { tenant_id } = request.query as any;
    const levels = await prisma.inventoryLevel.findMany({ where: { tenant_id } });
    const lowStock = levels.filter((l) => l.quantity <= l.par_level * 0.3);
    return { success: true, data: { levels, low_stock_alerts: lowStock } };
  });

  app.patch('/api/concessions/inventory/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { quantity } = request.body as any;
    const updated = await prisma.inventoryLevel.update({ where: { id }, data: { quantity } });
    return { success: true, data: updated };
  });

  // ── Dynamic Pricing Queue ─────────────────────────────────────────────────
  app.get('/api/concessions/pricing-queue', async (request, reply) => {
    const { tenant_id, event_id } = request.query as any;
    const recs = await prisma.dynamicPricingRecommendation.findMany({
      where: { tenant_id, event_id, approved_by: null, rejected_at: null },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: recs };
  });

  app.post('/api/concessions/pricing-queue/:id/approve', async (request, reply) => {
    const { id } = request.params as any;
    const { approved_by } = request.body as any;
    const updated = await prisma.dynamicPricingRecommendation.update({
      where: { id },
      data: { approved_by, applied_at: new Date() },
    });
    return { success: true, data: updated };
  });

  app.post('/api/concessions/pricing-queue/:id/reject', async (request, reply) => {
    const { id } = request.params as any;
    const { rejected_by } = request.body as any;
    const updated = await prisma.dynamicPricingRecommendation.update({
      where: { id },
      data: { rejected_at: new Date() },
    });
    return { success: true, data: updated };
  });

  // ── Kafka Consumer: ingest POS transactions ───────────────────────────────
  if (process.env.KAFKA_ENABLED !== 'false') {
    const consumer = createConsumer('venueiq-concessions');
    await subscribeAndProcess(
      consumer,
      [KAFKA_TOPICS.POS_TRANSACTIONS],
      async (_topic, _key, value: PosTransactionEvent) => {
        if (value.stand_type !== 'concessions') return;
        await prisma.posTransaction.create({
          data: {
            tenant_id: value.tenant_id,
            stand_id: value.stand_id,
            event_id: value.event_id,
            transaction_id: value.transaction_id,
            items: value.items as any,
            subtotal: value.subtotal,
            tax: value.tax,
            total: value.total,
            payment_method: value.payment_method,
            fan_id: value.fan_id ?? undefined,
            operator_id: value.operator_id ?? undefined,
            source_system: value.source_system,
            occurred_at: new Date(value.occurred_at),
          },
        });
        for (const item of value.items) {
          await prisma.inventoryLevel.updateMany({
            where: { tenant_id: value.tenant_id, stand_id: value.stand_id, product_id: item.product_id },
            data: { quantity: { decrement: item.quantity } },
          });
        }
      },
    );
  }

  const port = parseInt(process.env.PORT ?? '3003');
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'Concessions Service started');
}

bootstrap().catch((err) => { logger.error(err); process.exit(1); });
