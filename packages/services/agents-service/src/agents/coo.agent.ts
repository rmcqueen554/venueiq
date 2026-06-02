import { callClaude, createPrismaClient, dispatchNotification, logger } from '@venueiq/shared-utils';
import { AgentRunContext } from '../agent-runner';
import axios from 'axios';

const prisma = createPrismaClient(process.env.AGENTS_DATABASE_URL!);
const tenantPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

const SYSTEM_PROMPT = `You are the COO Agent for a sports venue operations platform called VenueIQ.
You are a senior Chief Operating Officer with 20 years of venue operations experience.
You have real-time visibility across all departments: concessions, merchandise, ticketing,
sponsorship, security, facilities, parking, and fan experience.

Your job is to identify the most critical operational issues, opportunities, and recommendations RIGHT NOW.

Rules:
- Be direct, specific, and actionable. No vague recommendations.
- Every recommendation must include: the specific action, expected impact ($), responsible party, and urgency.
- Cross-department thinking is your superpower — connect dots others miss.
- If you see a critical issue, flag it at the top before anything else.
- Respond in structured JSON format as specified.`;

export const cooAgent = {
  async run(context: AgentRunContext): Promise<void> {
    const { tenant_id, event_id, payload } = context;

    try {
      // Fetch current operational state
      const [tenant, events] = await Promise.all([
        tenantPrisma.tenant.findUnique({ where: { id: tenant_id } }),
        tenantPrisma.event.findMany({
          where: { tenant_id, status: 'live' },
          orderBy: { scheduled_at: 'asc' },
          take: 1,
        }),
      ]);

      const liveEvent = events[0];
      const trigger = payload?.trigger ?? 'scheduled';

      // Build context for Claude
      const userMessage = `
Venue: ${tenant?.name ?? 'Unknown'}
Current time: ${new Date().toISOString()}
${liveEvent ? `LIVE EVENT: ${liveEvent.name} (started ${liveEvent.scheduled_at})` : 'No live event currently'}
Trigger: ${trigger}

Current operational state (fetched from all modules):
${JSON.stringify(payload ?? {}, null, 2)}

${trigger === 'pre_event_6h' ? 'Generate pre-event operational briefing and top 3 preparation actions.' : ''}
${trigger === 'post_event_report' ? 'Generate post-event operations report with performance summary and recommendations for next similar event.' : ''}
${!trigger.includes('event') ? 'Identify the top 3 most important things the operations team should act on RIGHT NOW. For each: action, expected impact, responsible party, urgency (immediate/within 30 min/before halftime/before event end).' : ''}

Respond in this exact JSON structure:
{
  "output_type": "recommendation|alert|report",
  "severity": "critical|high|medium|low|info",
  "title": "string",
  "summary": "string (1-2 sentences)",
  "items": [
    {
      "action": "string",
      "impact": "string (include $ value where possible)",
      "responsible": "string (role name)",
      "urgency": "immediate|30min|halftime|event_end",
      "department": "string"
    }
  ],
  "requires_approval": false
}`;

      const response = await callClaude({
        tenant_id,
        service: 'coo_agent',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 1500,
        use_cache: true,
      });

      let parsed: any;
      try {
        parsed = JSON.parse(response.content);
      } catch {
        // If Claude didn't return valid JSON, wrap it
        parsed = {
          output_type: 'recommendation',
          severity: 'medium',
          title: 'COO Agent Analysis',
          summary: response.content.substring(0, 200),
          items: [],
          requires_approval: false,
        };
      }

      // Store agent output
      await prisma.agentOutput.create({
        data: {
          tenant_id,
          agent_name: 'coo_agent',
          output_type: parsed.output_type ?? 'recommendation',
          severity: parsed.severity ?? 'medium',
          title: parsed.title,
          body: parsed.summary ?? response.content.substring(0, 500),
          data: parsed,
          requires_approval: parsed.requires_approval ?? false,
          auto_executed: true,
          executed_at: new Date(),
          event_id: liveEvent?.id ?? event_id ?? null,
        },
      });

      // Auto-send critical alerts to Teams/Slack
      if (parsed.severity === 'critical') {
        const notifConfig = await tenantPrisma.notificationConfig.findUnique({ where: { tenant_id } });
        if (notifConfig) {
          await dispatchNotification(
            {
              tenant_id,
              channel: notifConfig.preferred_channel as any,
              recipients: [],
              title: `🚨 CRITICAL: ${parsed.title}`,
              body: parsed.summary,
              severity: 'critical',
            },
            {
              teams_webhook: notifConfig.teams_webhook ?? undefined,
              slack_webhook: notifConfig.slack_webhook ?? undefined,
            },
          );
        }
      }

      logger.info({ tenant_id, severity: parsed.severity, title: parsed.title }, 'COO Agent output stored');
    } catch (err) {
      logger.error({ err, tenant_id }, 'COO Agent run failed');
    }
  },
};
