import { callClaude, createPrismaClient, logger } from '@venueiq/shared-utils';
import { AgentRunContext } from '../agent-runner';

const prisma = createPrismaClient(process.env.AGENTS_DATABASE_URL!);
const tenantPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

const SYSTEM_PROMPT = `You are the Ticketing Agent for VenueIQ — a ticketing revenue optimization specialist.

You monitor ticket sales velocity, inventory, season ticket holder health, and dynamic pricing
opportunities. Your job is to maximize ticket revenue across all events.

Key outputs:
1. Dynamic pricing recommendations by section (requires Ticketing Director approval)
2. Season ticket renewal risk alerts (weekly)
3. Promotional campaign recommendations for slow-moving inventory
4. No-show risk alerts (4 hours before event)
5. Revenue pacing vs. forecast alerts

Always show expected revenue impact. Respond in JSON.`;

export const ticketingAgent = {
  async run(context: AgentRunContext): Promise<void> {
    const { tenant_id, event_id, payload } = context;

    try {
      const tenant = await tenantPrisma.tenant.findUnique({ where: { id: tenant_id } });
      const trigger = payload?.trigger ?? 'scheduled';

      const userMessage = trigger === 'renewal_risk_report'
        ? `Generate weekly season ticket renewal risk report. Identify at-risk accounts by renewal likelihood score. Recommend intervention strategies.`
        : trigger === 'no_show_risk'
        ? `Generate no-show risk alert for today's event. Identify sections with high no-show probability and recommend revenue recovery actions (resale, upgrades).`
        : `Review ticket sales velocity and inventory. Event: ${event_id}. Current state: ${JSON.stringify(payload ?? {}, null, 2)}. Generate pricing recommendations and revenue opportunities.`;

      const response = await callClaude({
        tenant_id,
        service: 'ticketing_agent',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 1500,
      });

      let parsed: any;
      try { parsed = JSON.parse(response.content); }
      catch { parsed = { output_type: 'recommendation', severity: 'medium', title: 'Ticketing Analysis', summary: response.content.substring(0, 300), requires_approval: true }; }

      await prisma.agentOutput.create({
        data: {
          tenant_id,
          agent_name: 'ticketing_agent',
          output_type: trigger === 'renewal_risk_report' ? 'report' : 'recommendation',
          severity: parsed.severity ?? 'medium',
          title: parsed.title ?? 'Ticketing Update',
          body: parsed.summary ?? '',
          data: parsed,
          requires_approval: true, // Ticketing pricing always requires approval
          event_id: event_id ?? null,
        },
      });

      logger.info({ tenant_id, trigger }, 'Ticketing Agent output stored');
    } catch (err) {
      logger.error({ err, tenant_id }, 'Ticketing Agent run failed');
    }
  },
};
