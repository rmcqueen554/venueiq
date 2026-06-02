import { FastifyInstance } from 'fastify';
import { db } from '../db';

export async function facilitiesRoutes(app: FastifyInstance) {
  app.get('/facilities/assets', async (req, reply) => {
    const { tenant_id } = req.query as any;
    const assets = await db.asset.findMany({ where: { tenant_id, active: true }, orderBy: { health_score: 'asc' } });
    return { success: true, data: assets };
  });

  app.post('/facilities/assets', async (req, reply) => {
    const body = req.body as any;
    const asset = await db.asset.create({
      data: { tenant_id: body.tenant_id, name: body.name, type: body.type, location_name: body.location_name },
    });
    return reply.status(201).send({ success: true, data: asset });
  });

  app.get('/facilities/work-orders', async (req, reply) => {
    const { tenant_id, status } = req.query as any;
    const orders = await db.maintenanceWorkOrder.findMany({
      where: { tenant_id, ...(status ? { status } : {}) },
      orderBy: [{ priority: 'asc' }, { scheduled_at: 'asc' }],
    });
    return { success: true, data: orders };
  });

  app.post('/facilities/work-orders', async (req, reply) => {
    const body = req.body as any;
    const wo = await db.maintenanceWorkOrder.create({
      data: {
        tenant_id: body.tenant_id, asset_id: body.asset_id,
        type: body.type ?? 'corrective', description: body.description,
        priority: body.priority ?? 'medium', status: 'open',
        assigned_to: body.assigned_to,
        scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : undefined,
      },
    });
    return reply.status(201).send({ success: true, data: wo });
  });

  app.patch('/facilities/work-orders/:id', async (req, reply) => {
    const { id } = req.params as any;
    const body = req.body as any;
    const updated = await db.maintenanceWorkOrder.update({
      where: { id },
      data: { status: body.status, completed_at: body.status === 'completed' ? new Date() : undefined, cost: body.cost },
    });
    return { success: true, data: updated };
  });
}
