import { callClaude, createPrismaClient, logger } from '@venueiq/shared-utils';
import { AgentRunContext } from '../agent-runner';

const prisma = createPrismaClient(process.env.AGENTS_DATABASE_URL!);
const tenantPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

const SYSTEM_PROMPT = `You are the Concessions Agent for VenueIQ — a concessions operations specialist.

You monitor every stand, every product, every labor hour. Your job is to maximize revenue
per fan while minimizing waste and labor costs.

Key responsibilities:
1. Predict stockouts BEFORE they happen (with countdown timers)
2. Recommend inter-stand transfers when traffic is imbalanced
3. Flag understaffed stands that are losing revenue
4. Recommend dynamic pricing based on demand velocity and remaining event time
5. Generate pre-event inventory recommendations

Always quantify financial impact. Respond in JSON.`;

export const concessionsAgent = {
  async run(context: AgentRunContext): Promise<void> {
    const { tenant_id, event_id, payload } = context;

    try {
      const tenant = await tenantPrisma.tenant.findUnique({ where: { id: tenant_id } });
      const trigger = payload?.trigger ?? 'scheduled';

      const userMessage = trigger === 'pre_event_inventory'
        ? `Generate pre-event inventory order recommendations for ${tenant?.name}. Event ID: ${event_id}. Based on historical data and attendance forecast.`
        : trigger === 'post_event_report'
        ? `Generate post-event concessions report including revenue vs forecast, waste analysis, top performers, and recommendations.`
        : `Analyze current concessions state. ${JSON.stringify(payload ?? {}, null, 2)}
           Identify: stockout risks, understaffed stands, transfer opportunities, pricing opportunities.`;

      const response = await callClaude({
        tenant_id,
        service: 'concessions_agent',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 1500,
      });

      let parsed: any;
      try { parsed = JSON.parse(response.content); }
      catch { parsed = { output_type: 'recommendation', severity: 'medium', title: 'Concessions Analysis', summary: response.content.substring(0, 300) }; }

      const requiresApproval = parsed.pricing_recommendations?.length > 0 || parsed.transfer_recommendations?.length > 0;

      await prisma.agentOutput.create({
        data: {
          tenant_id,
          agent_name: 'concessions_agent',
          output_type: trigger.includes('report') ? 'report' : 'recommendation',
          severity: parsed.severity ?? 'medium',
          title: parsed.title ?? 'Concessions Analysis',
          body: parsed.summary ?? '',
          data: parsed,
          requires_approval: requiresApproval,
          auto_executed: !requiresApproval,
          executed_at: requiresApproval ? null : new Date(),
          event_id: event_id ?? null,
        },
      });

      logger.info({ tenant_id, trigger }, 'Concessions Agent output stored');
    } catch (err) {
      logger.error({ err, tenant_id }, 'Concessions Agent run failed');
    }
  },
};
