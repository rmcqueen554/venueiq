import { FastifyInstance } from 'fastify';
import { db } from '../db';

export async function concessionsRoutes(app: FastifyInstance) {
  app.get('/concessions/stands/live', async (req, reply) => {
    const { tenant_id } = req.query as any;
    const stands = await db.stand.findMany({ where: { tenant_id, active: true } });
    const enriched = await Promise.all(stands.map(async (s) => {
      const inventory = await db.inventoryLevel.findMany({ where: { stand_id: s.id } });
      return { ...s, inventory };
    }));
    return { success: true, data: enriched };
  });

  app.get('/concessions/transactions', async (req, reply) => {
    const { tenant_id, event_id, limit = '100' } = req.query as any;
    const txns = await db.posTransaction.findMany({
      where: { tenant_id, ...(event_id ? { event_id } : {}) },
      orderBy: { occurred_at: 'desc' },
      take: parseInt(limit),
    });
    return { success: true, data: txns };
  });

  app.get('/concessions/inventory', async (req, reply) => {
    const { tenant_id } = req.query as any;
    const levels = await db.inventoryLevel.findMany({ where: { tenant_id } });
    const lowStock = levels.filter((l) => l.quantity <= l.par_level * 0.3);
    return { success: true, data: { levels, low_stock_alerts: lowStock } };
  });

  app.patch('/concessions/inventory/:id', async (req, reply) => {
    const { id } = req.params as any;
    const { quantity } = req.body as any;
    const updated = await db.inventoryLevel.update({ where: { id }, data: { quantity } });
    return { success: true, data: updated };
  });

  app.get('/concessions/pricing-queue', async (req, reply) => {
    // Stub — pricing recommendations come from agents in the agent_outputs table
    const { tenant_id } = req.query as any;
    const recs = await db.agentOutput.findMany({
      where: { tenant_id, agent_name: 'concessions_agent', requires_approval: true, approved_at: null, rejected_at: null },
      orderBy: { created_at: 'desc' },
    });
    return { success: true, data: recs };
  });

  // Stand management
  app.post('/concessions/stands', async (req, reply) => {
    const body = req.body as any;
    const stand = await db.stand.create({
      data: {
        tenant_id: body.tenant_id,
        venue_id: body.venue_id,
        name: body.name,
        type: body.type ?? 'concessions',
        capacity_per_hour: body.capacity_per_hour ?? 60,
      },
    });
    return reply.status(201).send({ success: true, data: stand });
  });

  // Products
  app.get('/concessions/products', async (req, reply) => {
    const { tenant_id } = req.query as any;
    const products = await db.product.findMany({ where: { tenant_id, active: true } });
    return { success: true, data: products };
  });

  app.post('/concessions/products', async (req, reply) => {
    const body = req.body as any;
    const product = await db.product.create({
      data: {
        tenant_id: body.tenant_id,
        name: body.name,
        category: body.category,
        price: body.price,
        cost: body.cost,
        sku: body.sku,
      },
    });
    return reply.status(201).send({ success: true, data: product });
  });
}
