import { FastifyInstance } from 'fastify';
import { db } from '../db';

export async function agentsRoutes(app: FastifyInstance) {
  // ── Approval queue ─────────────────────────────────────────────────────
  app.get('/agents/approvals', async (req, reply) => {
    const { tenant_id } = req.query as any;
    const items = await db.agentOutput.findMany({
      where: { tenant_id, requires_approval: true, approved_at: null, rejected_at: null },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return { success: true, data: items };
  });

  app.post('/agents/approvals/:id/approve', async (req, reply) => {
    const { id } = req.params as any;
    const { action, approved_by } = req.body as any;
    const updated = await db.agentOutput.update({
      where: { id },
      data: action === 'approve'
        ? { approved_by: approved_by ?? 'user', approved_at: new Date(), auto_executed: true, executed_at: new Date() }
        : { rejected_by: approved_by ?? 'user', rejected_at: new Date() },
    });
    return { success: true, data: updated };
  });

  // ── Agent output history ───────────────────────────────────────────────
  app.get('/agents/outputs', async (req, reply) => {
    const { tenant_id, agent_name, limit = '50' } = req.query as any;
    const outputs = await db.agentOutput.findMany({
      where: { tenant_id, ...(agent_name ? { agent_name } : {}) },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit),
    });
    return { success: true, data: outputs };
  });

  // ── AI cost tracking ───────────────────────────────────────────────────
  app.get('/agents/cost', async (req, reply) => {
    const { tenant_id } = req.query as any;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const logs = await db.claudeApiCallLog.findMany({
      where: { tenant_id, created_at: { gte: since } },
    });
    const totalCost = logs.reduce((s, l) => s + Number(l.cost_usd), 0);
    const totalTokens = logs.reduce((s, l) => s + l.input_tokens + l.output_tokens, 0);
    return {
      success: true,
      data: { total_cost_usd: totalCost.toFixed(4), total_tokens: totalTokens, call_count: logs.length, period_days: 30 },
    };
  });

  // ── Automation rules ───────────────────────────────────────────────────
  app.get('/automations', async (req, reply) => {
    const { tenant_id } = req.query as any;
    const rules = await db.automationRule.findMany({ where: { tenant_id, active: true } });
    return { success: true, data: rules };
  });

  app.post('/automations', async (req, reply) => {
    const body = req.body as any;
    const rule = await db.automationRule.create({
      data: {
        tenant_id: body.tenant_id,
        name: body.name,
        trigger_type: body.trigger_type,
        trigger_config: body.trigger_config ?? {},
        action_type: body.action_type,
        action_config: body.action_config ?? {},
        created_by: body.created_by ?? 'user',
      },
    });
    return reply.status(201).send({ success: true, data: rule });
  });
}
