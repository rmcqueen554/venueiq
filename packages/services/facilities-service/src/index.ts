import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { clerkPlugin } from '@clerk/fastify';
import { logger, createConsumer, subscribeAndProcess, KAFKA_TOPICS, createPrismaClient } from '@venueiq/shared-utils';

const prisma = createPrismaClient(process.env.FACILITIES_DATABASE_URL!);
const app = Fastify({ logger: false });

async function bootstrap() {
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*', credentials: true });
  await app.register(clerkPlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'facilities-service' }));

  // ── Asset Health Map ──────────────────────────────────────────────────────
  app.get('/api/facilities/assets', async (request, reply) => {
    const { tenant_id } = request.query as any;
    const assets = await prisma.asset.findMany({
      where: { tenant_id, active: true },
      include: { work_orders: { where: { status: { in: ['open', 'in_progress'] } }, orderBy: { priority: 'asc' }, take: 1 } },
      orderBy: { failure_probability: 'desc' },
    });
    return { success: true, data: assets };
  });

  // ── Work Orders ───────────────────────────────────────────────────────────
  app.get('/api/facilities/work-orders', async (request, reply) => {
    const { tenant_id, status } = request.query as any;
    const orders = await prisma.maintenanceWorkOrder.findMany({
      where: { tenant_id, ...(status ? { status } : {}) },
      include: { asset: { select: { name: true, type: true } } },
      orderBy: [{ priority: 'asc' }, { scheduled_at: 'asc' }],
    });
    return { success: true, data: orders };
  });

  app.post('/api/facilities/work-orders', async (request, reply) => {
    const body = request.body as any;
    const wo = await prisma.maintenanceWorkOrder.create({
      data: {
        tenant_id: body.tenant_id,
        asset_id: body.asset_id,
        type: body.type ?? 'corrective',
        description: body.description,
        priority: body.priority ?? 'medium',
        status: 'open',
        assigned_to: body.assigned_to,
        scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : undefined,
      },
    });
    return reply.status(201).send({ success: true, data: wo });
  });

  app.patch('/api/facilities/work-orders/:id', async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const updated = await prisma.maintenanceWorkOrder.update({
      where: { id },
      data: {
        status: body.status,
        completed_at: body.status === 'completed' ? new Date() : undefined,
        cost: body.cost,
        notes: body.notes,
      },
    });
    return { success: true, data: updated };
  });

  // ── Energy Intelligence ───────────────────────────────────────────────────
  app.get('/api/facilities/energy', async (request, reply) => {
    const { tenant_id, hours = '24' } = request.query as any;
    const since = new Date(Date.now() - parseInt(hours) * 3600_000);
    const readings = await prisma.energyReading.findMany({
      where: { tenant_id, occurred_at: { gte: since } },
      orderBy: { occurred_at: 'asc' },
    });
    const totalKwh = readings.reduce((s, r) => s + r.kwh, 0);
    const totalCost = readings.reduce((s, r) => s + Number(r.cost), 0);
    return { success: true, data: { readings, total_kwh: totalKwh, total_cost: totalCost } };
  });

  // ── Inspections ───────────────────────────────────────────────────────────
  app.get('/api/facilities/inspections', async (request, reply) => {
    const { tenant_id } = request.query as any;
    const inspections = await prisma.inspection.findMany({
      where: { tenant_id },
      orderBy: { next_due: 'asc' },
    });
    return { success: true, data: inspections };
  });

  // ── Kafka Consumer: IoT Sensor Readings ───────────────────────────────────
  if (process.env.KAFKA_ENABLED !== 'false') {
    const consumer = createConsumer('venueiq-facilities');
    await subscribeAndProcess(
      consumer,
      [KAFKA_TOPICS.IOT_SENSOR_READINGS],
      async (_topic, _key, value: any) => {
        await prisma.iotSensorReading.create({
          data: {
            tenant_id: value.tenant_id,
            asset_id: value.asset_id,
            metric_name: value.metric_name,
            value: value.value,
            unit: value.unit,
            zone_id: value.zone_id,
            occurred_at: new Date(value.occurred_at),
          },
        }).catch(() => {});
        if (value.sensor_type === 'energy' && value.zone_id) {
          await prisma.energyReading.create({
            data: {
              tenant_id: value.tenant_id,
              zone_id: value.zone_id,
              zone_name: value.zone_name ?? 'Unknown Zone',
              kwh: value.value,
              cost: value.value * 0.12,
              occurred_at: new Date(value.occurred_at),
            },
          }).catch(() => {});
        }
      },
    );
  }

  const port = parseInt(process.env.PORT ?? '3008');
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'Facilities Service started');
}

bootstrap().catch((err) => { logger.error(err); process.exit(1); });
