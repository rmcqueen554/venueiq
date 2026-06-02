import { callClaude, createPrismaClient, dispatchNotification, logger } from '@venueiq/shared-utils';
import { AgentRunContext } from '../agent-runner';

const prisma = createPrismaClient(process.env.AGENTS_DATABASE_URL!);
const tenantPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

const SYSTEM_PROMPT = `You are the Sponsorship Agent for VenueIQ — a sponsorship management specialist.

You monitor all sponsor activation commitments in real time. Every contracted activation
must be delivered. Missed activations cost money and damage sponsor relationships.

Your responsibilities:
1. Track every scheduled activation and flag missed or at-risk ones BEFORE the window closes
2. Flag sponsors at renewal risk (ROI delivery < 70%)
3. Generate renewal briefs for upcoming sponsor meetings
4. Generate post-event performance reports per sponsor (polished enough to send to Fortune 500 marketing teams)

Respond in JSON.`;

export const sponsorshipAgent = {
  async run(context: AgentRunContext): Promise<void> {
    const { tenant_id, event_id, payload } = context;

    try {
      const tenant = await tenantPrisma.tenant.findUnique({ where: { id: tenant_id } });
      const trigger = payload?.trigger ?? 'scheduled';

      const userMessage = trigger === 'post_event_sponsor_reports'
        ? `Generate post-event sponsor performance reports for event ${event_id} at ${tenant?.name}. Include: activations completed, estimated impressions, audience reached, media value, highlights. Make it professional enough to send directly to sponsor contacts.`
        : trigger === 'renewal_pipeline_review'
        ? `Review sponsor renewal pipeline. Identify sponsors with contracts expiring in 90/60/30 days. Generate renewal briefs and flag at-risk accounts.`
        : `Review current activation status for event ${event_id}. Flag any missed or at-risk activations with immediate recommended action.`;

      const response = await callClaude({
        tenant_id,
        service: 'sponsorship_agent',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 2000,
      });

      let parsed: any;
      try { parsed = JSON.parse(response.content); }
      catch { parsed = { output_type: 'alert', severity: 'medium', title: 'Sponsorship Analysis', summary: response.content.substring(0, 300) }; }

      await prisma.agentOutput.create({
        data: {
          tenant_id,
          agent_name: 'sponsorship_agent',
          output_type: trigger.includes('report') ? 'report' : 'alert',
          severity: parsed.severity ?? 'medium',
          title: parsed.title ?? 'Sponsorship Update',
          body: parsed.summary ?? '',
          data: parsed,
          requires_approval: false,
          auto_executed: true,
          executed_at: new Date(),
          event_id: event_id ?? null,
        },
      });

      logger.info({ tenant_id, trigger }, 'Sponsorship Agent output stored');
    } catch (err) {
      logger.error({ err, tenant_id }, 'Sponsorship Agent run failed');
    }
  },
};
