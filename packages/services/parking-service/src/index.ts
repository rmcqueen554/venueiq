import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { clerkPlugin } from '@clerk/fastify';
import { logger, createConsumer, subscribeAndProcess, KAFKA_TOPICS, createPrismaClient } from '@venueiq/shared-utils';

const prisma = createPrismaClient(process.env.PARKING_DATABASE_URL!);
const app = Fastify({ logger: false });

async function bootstrap() {
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*', credentials: true });
  await app.register(clerkPlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'parking-service' }));

  // ── Live Parking Command ──────────────────────────────────────────────────
  app.get('/api/parking/lots/live', async (request, reply) => {
    const { tenant_id } = request.query as any;
    const lots = await prisma.parkingLot.findMany({ where: { tenant_id, active: true } });

    const enriched = await Promise.all(lots.map(async (lot) => {
      const occupancy = await prisma.parkingOccupancy.findFirst({
        where: { tenant_id, lot_id: lot.id },
        orderBy: { occurred_at: 'desc' },
      });
      const recentTxns = await prisma.parkingTransaction.count({
        where: { tenant_id, lot_id: lot.id, entry_time: { gte: new Date(Date.now() - 3600_000) } },
      });
      return {
        ...lot,
        occupied_spaces: occupancy?.occupied_spaces ?? 0,
        fill_pct: occupancy?.fill_pct ?? 0,
        status: !occupancy ? 'unknown' : occupancy.fill_pct < 0.6 ? 'green' : occupancy.fill_pct < 0.85 ? 'amber' : 'red',
        recent_entries: recentTxns,
      };
    }));

    return { success: true, data: enriched };
  });

  // ── Approach Traffic ──────────────────────────────────────────────────────
  app.get('/api/parking/traffic', async (request, reply) => {
    const { tenant_id } = request.query as any;
    const traffic = await prisma.approachTraffic.findMany({
      where: { tenant_id },
      orderBy: { occurred_at: 'desc' },
      take: 50,
      distinct: ['route_name'],
    });
    return { success: true, data: traffic };
  });

  // ── Revenue ───────────────────────────────────────────────────────────────
  app.get('/api/parking/revenue', async (request, reply) => {
    const { tenant_id, event_id } = request.query as any;
    const txns = await prisma.parkingTransaction.findMany({ where: { tenant_id, event_id } });
    const totalRevenue = txns.reduce((sum, t) => sum + Number(t.revenue ?? 0), 0);
    const preSold = txns.filter((t) => t.pre_sold).length;
    const walkUp = txns.filter((t) => !t.pre_sold).length;
    return { success: true, data: { total_revenue: totalRevenue, pre_sold: preSold, walk_up: walkUp, transactions: txns.length } };
  });

  // ── Kafka Consumer ────────────────────────────────────────────────────────
  const consumer = createConsumer('venueiq-parking');
  await subscribeAndProcess(
    consumer,
    [KAFKA_TOPICS.PARKING_ENTRIES],
    async (_topic, _key, value: any) => {
      if (value.entry_type === 'entry') {
        await prisma.parkingTransaction.create({
          data: {
            tenant_id: value.tenant_id,
            lot_id: value.lot_id,
            event_id: value.event_id,
            external_txn_id: value.transaction_id,
            entry_time: new Date(value.occurred_at),
            revenue: value.revenue,
            vehicle_type: value.vehicle_type,
            pre_sold: value.pre_sold,
          },
        }).catch(() => {});
      }

      // Update occupancy
      const lot = await prisma.parkingLot.findUnique({ where: { id: value.lot_id } });
      if (lot) {
        const currentOccupied = await prisma.parkingTransaction.count({
          where: { tenant_id: value.tenant_id, lot_id: value.lot_id, exit_time: null },
        });
        await prisma.parkingOccupancy.create({
          data: {
            tenant_id: value.tenant_id,
            lot_id: value.lot_id,
            occupied_spaces: currentOccupied,
            fill_pct: currentOccupied / lot.total_spaces,
            occurred_at: new Date(value.occurred_at),
          },
        }).catch(() => {});
      }
    },
  );

  const port = parseInt(process.env.PORT ?? '3010');
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'Parking Service started');
}

bootstrap().catch((err) => { logger.error(err); process.exit(1); });
