import { callClaude, createPrismaClient, dispatchNotification, logger } from '@venueiq/shared-utils';
import { AgentRunContext } from '../agent-runner';

const prisma = createPrismaClient(process.env.AGENTS_DATABASE_URL!);
const tenantPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

const SYSTEM_PROMPT = `You are the Revenue Agent for VenueIQ — a revenue management expert specializing
in sports and entertainment venue economics.

You monitor ALL revenue streams in real time: ticketing, concessions, merchandise, parking,
sponsorship activations. Your job is to detect underperformance against forecast and generate
dynamic pricing recommendations that maximize revenue per event.

Rules:
- Always quantify the revenue impact of your recommendations.
- Dynamic pricing recommendations must include: current price, recommended price, rationale,
  expected uplift in $ and %, and which approval is needed.
- Never recommend price changes that would damage fan experience or brand perception.
- Respond in structured JSON.`;

export const revenueAgent = {
  async run(context: AgentRunContext): Promise<void> {
    const { tenant_id, event_id, payload } = context;

    try {
      const tenant = await tenantPrisma.tenant.findUnique({ where: { id: tenant_id } });
      const trigger = payload?.trigger ?? 'scheduled';

      const userMessage = `
Venue: ${tenant?.name ?? 'Unknown'}
Trigger: ${trigger}
Event ID: ${event_id ?? 'none'}
Current revenue state: ${JSON.stringify(payload ?? {}, null, 2)}

${trigger === 'pre_event_strategy' ? 'Generate pre-event revenue strategy document for the upcoming event.' :
  'Analyze current revenue performance and identify top 3 revenue opportunities or risks RIGHT NOW.'}

Respond in JSON:
{
  "output_type": "recommendation",
  "severity": "high|medium|low",
  "title": "string",
  "summary": "string",
  "pricing_recommendations": [
    {
      "target_type": "concession_product|ticket_section|parking_lot",
      "target_name": "string",
      "current_price": number,
      "recommended_price": number,
      "rationale": "string",
      "expected_revenue_lift": number,
      "expected_revenue_lift_pct": number,
      "urgency": "immediate|30min|halftime|event_end",
      "requires_approval": true
    }
  ],
  "revenue_risks": [
    { "stream": "string", "variance_pct": number, "action": "string" }
  ],
  "requires_approval": true
}`;

      const response = await callClaude({
        tenant_id,
        service: 'revenue_agent',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 1500,
      });

      let parsed: any;
      try { parsed = JSON.parse(response.content); }
      catch { parsed = { output_type: 'recommendation', severity: 'medium', title: 'Revenue Analysis', summary: response.content.substring(0, 300), pricing_recommendations: [], requires_approval: true }; }

      await prisma.agentOutput.create({
        data: {
          tenant_id,
          agent_name: 'revenue_agent',
          output_type: 'recommendation',
          severity: parsed.severity ?? 'medium',
          title: parsed.title,
          body: parsed.summary,
          data: parsed,
          requires_approval: true, // Revenue agent always requires human approval for price changes
          event_id: event_id ?? null,
        },
      });

      logger.info({ tenant_id, title: parsed.title }, 'Revenue Agent output stored');
    } catch (err) {
      logger.error({ err, tenant_id }, 'Revenue Agent run failed');
    }
  },
};
