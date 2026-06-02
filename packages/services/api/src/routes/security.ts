import { FastifyInstance } from 'fastify';
import { db } from '../db';

export async function securityRoutes(app: FastifyInstance) {
  app.get('/security/live', async (req, reply) => {
    const { tenant_id, event_id } = req.query as any;
    const [incidents, cameras] = await Promise.all([
      db.securityIncident.findMany({
        where: { tenant_id, event_id, status: { not: 'closed' } },
        orderBy: { reported_at: 'desc' },
        take: 50,
      }),
      db.cameraFeed.findMany({ where: { tenant_id, active: true } }),
    ]);
    return { success: true, data: { incidents, cameras, crowd_density: [] } };
  });

  app.post('/security/incidents', async (req, reply) => {
    const body = req.body as any;
    const incident = await db.securityIncident.create({
      data: {
        tenant_id: body.tenant_id,
        event_id: body.event_id ?? '00000000-0000-0000-0000-000000000000',
        type: body.type,
        severity: body.severity,
        location_description: body.location_description,
        location_x: body.location_x,
        location_y: body.location_y,
        reported_at: new Date(),
        reported_by: body.reported_by ?? 'user',
        description: body.description ?? body.type,
        status: 'open',
      },
    });
    return reply.status(201).send({ success: true, data: incident });
  });

  app.patch('/security/incidents/:id', async (req, reply) => {
    const { id } = req.params as any;
    const body = req.body as any;
    const updated = await db.securityIncident.update({
      where: { id },
      data: {
        status: body.status,
        resolved_at: body.status === 'closed' ? new Date() : undefined,
        actions_taken: body.actions_taken,
      },
    });
    return { success: true, data: updated };
  });

  app.get('/security/incidents', async (req, reply) => {
    const { tenant_id, event_id, status } = req.query as any;
    const incidents = await db.securityIncident.findMany({
      where: { tenant_id, ...(event_id ? { event_id } : {}), ...(status ? { status } : {}) },
      orderBy: { reported_at: 'desc' },
      take: 100,
    });
    return { success: true, data: incidents };
  });
}
