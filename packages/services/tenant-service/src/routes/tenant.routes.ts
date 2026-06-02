import { FastifyInstance } from 'fastify';
import { createPrismaClient } from '@venueiq/shared-utils';

const prisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

export async function tenantRoutes(app: FastifyInstance) {
  // Get tenant by slug
  app.get('/:slug', async (request, reply) => {
    const { slug } = request.params as any;
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: { venues: true, data_sources: { select: { source_type: true, status: true, last_sync_at: true } } },
    });
    if (!tenant) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return { success: true, data: tenant };
  });

  // Update tenant settings
  app.patch('/:tenant_id', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const body = request.body as any;
    const updated = await prisma.tenant.update({
      where: { id: tenant_id },
      data: {
        name: body.name,
        white_label_config: body.white_label_config,
        timezone: body.timezone,
      },
    });
    return { success: true, data: updated };
  });

  // Get upcoming events
  app.get('/:tenant_id/events', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const { status, limit = '20' } = request.query as any;
    const events = await prisma.event.findMany({
      where: { tenant_id, ...(status ? { status } : {}) },
      orderBy: { scheduled_at: 'asc' },
      take: parseInt(limit),
    });
    return { success: true, data: events };
  });

  // Create event
  app.post('/:tenant_id/events', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const body = request.body as any;
    const venue = await prisma.venue.findFirst({ where: { tenant_id } });
    if (!venue) return reply.status(404).send({ success: false, error: { code: 'NO_VENUE', message: 'No venue configured' } });

    const event = await prisma.event.create({
      data: {
        tenant_id,
        venue_id: venue.id,
        name: body.name,
        type: body.type,
        opponent_or_artist: body.opponent_or_artist,
        scheduled_at: new Date(body.scheduled_at),
        gates_open_at: body.gates_open_at ? new Date(body.gates_open_at) : undefined,
        expected_attendance: body.expected_attendance,
        status: 'scheduled',
      },
    });
    return reply.status(201).send({ success: true, data: event });
  });

  // Update event status
  app.patch('/:tenant_id/events/:event_id/status', async (request, reply) => {
    const { tenant_id, event_id } = request.params as any;
    const { status } = request.body as any;
    const event = await prisma.event.update({
      where: { id: event_id },
      data: { status },
    });
    return { success: true, data: event };
  });

  // Get data source connection status
  app.get('/:tenant_id/data-sources', async (request, reply) => {
    const { tenant_id } = request.params as any;
    const sources = await prisma.tenantDataSource.findMany({
      where: { tenant_id },
      select: { id: true, source_type: true, status: true, last_sync_at: true, error_message: true },
    });
    return { success: true, data: sources };
  });
}
