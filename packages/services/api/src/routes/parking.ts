import { FastifyInstance } from 'fastify';
import { db } from '../db';

export async function parkingRoutes(app: FastifyInstance) {
  app.get('/parking/lots/live', async (req, reply) => {
    const { tenant_id } = req.query as any;
    const lots = await db.parkingLot.findMany({ where: { tenant_id, active: true } });
    const enriched = await Promise.all(lots.map(async (lot) => {
      const occupied = await db.parkingTransaction.count({
        where: { tenant_id, lot_id: lot.id, exit_time: null },
      });
      const fill_pct = lot.total_spaces > 0 ? occupied / lot.total_spaces : 0;
      return {
        ...lot,
        occupied_spaces: occupied,
        fill_pct,
        status: fill_pct < 0.6 ? 'green' : fill_pct < 0.85 ? 'amber' : 'red',
      };
    }));
    return { success: true, data: enriched };
  });

  app.get('/parking/revenue', async (req, reply) => {
    const { tenant_id, event_id } = req.query as any;
    const txns = await db.parkingTransaction.findMany({ where: { tenant_id, ...(event_id ? { event_id } : {}) } });
    const totalRevenue = txns.reduce((s, t) => s + Number(t.revenue ?? 0), 0);
    const preSold = txns.filter((t) => t.pre_sold).length;
    return { success: true, data: { total_revenue: totalRevenue, pre_sold: preSold, walk_up: txns.length - preSold, transactions: txns.length } };
  });

  app.post('/parking/lots', async (req, reply) => {
    const body = req.body as any;
    const lot = await db.parkingLot.create({
      data: { tenant_id: body.tenant_id, name: body.name, total_spaces: body.total_spaces, type: body.type ?? 'surface' },
    });
    return reply.status(201).send({ success: true, data: lot });
  });
}
