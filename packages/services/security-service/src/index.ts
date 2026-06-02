import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { clerkPlugin } from '@clerk/fastify';
import { logger, createConsumer, subscribeAndProcess, KAFKA_TOPICS, createPrismaClient } from '@venueiq/shared-utils';
import type { SecurityIncidentEvent, GateScanEvent } from '@venueiq/shared-types';

const prisma = createPrismaClient(process.env.SECURITY_DATABASE_URL!);
const app = Fastify({ logger: false });

async function bootstrap() {
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: '*', credentials: true });
  await app.register(clerkPlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'security-service' }));

  // ── Live Security Command ─────────────────────────────────────────────────
  app.get('/api/security/live', async (request, reply) => {
    const { tenant_id, event_id } = request.query as any;
    const [incidents, posts, cameras, densityReadings] = await Promise.all([
      prisma.securityIncident.findMany({
        where: { tenant_id, event_id, status: { not: 'closed' } },
        orderBy: { reported_at: 'desc' },
        take: 50,
      }),
      prisma.securityPost.findMany({ where: { tenant_id, event_id } }),
      prisma.cameraFeed.findMany({ where: { tenant_id, active: true } }),
      prisma.crowdDensityReading.findMany({
        where: { tenant_id },
        orderBy: { occurred_at: 'desc' },
        take: 100,
        distinct: ['zone_id'],
      }),
    ]);

    return { success: true, data: { incidents, posts, cameras, crowd_density: densityReadings } };
  });

  // ── Incidents ─────────────────────────────────────────────────────────────
  app.post('/api/security/incidents', async (request, reply) => {
    const body = request.body as any;
    const incident = await prisma.securityIncident.create({
      data: {
        tenant_id: body.tenant_id,
        event_id: body.event_id,
        type: body.type,
        severity: body.severity,
        location_description: body.location_description,
        location_x: body.location_x,
        location_y: body.location_y,
        reported_at: new Date(),
        reported_by: body.reported_by,
        description: body.description,
        actions_taken: [],
        status: 'open',
      },
    });
    return reply.status(201).send({ success: true, data: incident });
  });

  app.patch('/api/security/incidents/:id', async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const updated = await prisma.securityIncident.update({
      where: { id },
      data: {
        status: body.status,
        resolved_at: body.status === 'closed' ? new Date() : undefined,
        actions_taken: body.actions_taken ?? undefined,
      },
    });
    return { success: true, data: updated };
  });

  // ── Access events (gate scans) ────────────────────────────────────────────
  app.get('/api/security/access-events', async (request, reply) => {
    const { tenant_id, gate_id, limit = '500' } = request.query as any;
    const events = await prisma.accessEvent.findMany({
      where: { tenant_id, ...(gate_id ? { gate_id } : {}) },
      orderBy: { occurred_at: 'desc' },
      take: parseInt(limit),
    });
    return { success: true, data: events };
  });

  // ── Banned patrons ────────────────────────────────────────────────────────
  app.get('/api/security/banned-patrons', async (request, reply) => {
    const { tenant_id } = request.query as any;
    const patrons = await prisma.bannedPatron.findMany({ where: { tenant_id, active: true } });
    return { success: true, data: patrons };
  });

  // ── Emergency plans ───────────────────────────────────────────────────────
  app.get('/api/security/emergency-plans', async (request, reply) => {
    const { tenant_id } = request.query as any;
    const plans = await prisma.emergencyPlan.findMany({ where: { tenant_id, active: true } });
    return { success: true, data: plans };
  });

  // ── Kafka Consumer ────────────────────────────────────────────────────────
  if (process.env.KAFKA_ENABLED !== 'false') {
    const consumer = createConsumer('venueiq-security');
    await subscribeAndProcess(
      consumer,
      [KAFKA_TOPICS.SECURITY_INCIDENTS, KAFKA_TOPICS.GATE_SCANS],
      async (topic, _key, value: any) => {
        if (topic === KAFKA_TOPICS.SECURITY_INCIDENTS) {
          await prisma.securityIncident.create({
            data: {
              tenant_id: value.tenant_id,
              event_id: value.event_id,
              type: value.incident_type,
              severity: value.severity,
              location_description: value.location_description,
              location_x: value.location_x,
              location_y: value.location_y,
              reported_at: new Date(value.occurred_at),
              reported_by: value.reported_by,
              description: value.incident_type,
              actions_taken: [],
              status: 'open',
            },
          }).catch(() => {});
        } else if (topic === KAFKA_TOPICS.GATE_SCANS) {
          await prisma.accessEvent.create({
            data: {
              tenant_id: value.tenant_id,
              gate_id: value.gate_id,
              gate_name: value.gate_name,
              credential_id: value.credential_id,
              fan_id: value.fan_id,
              event_type: value.scan_type,
              ticket_type: value.ticket_type,
              section: value.section,
              occurred_at: new Date(value.occurred_at),
            },
          }).catch(() => {});
        }
      },
    );
  }

  const port = parseInt(process.env.PORT ?? '3009');
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'Security Service started');
}

bootstrap().catch((err) => { logger.error(err); process.exit(1); });
