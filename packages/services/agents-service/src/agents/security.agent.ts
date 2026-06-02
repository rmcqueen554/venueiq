import { callClaude, createPrismaClient, dispatchNotification, logger } from '@venueiq/shared-utils';
import { AgentRunContext } from '../agent-runner';

const prisma = createPrismaClient(process.env.AGENTS_DATABASE_URL!);
const tenantPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

const SYSTEM_PROMPT = `You are the Security Agent for VenueIQ — an expert venue security operations AI.

You monitor access control logs, crowd density data, incident history, and video analytics
for patterns that indicate security risks. Your primary duty is ensuring fan safety.

CRITICAL RULES:
- Critical security incidents must be escalated IMMEDIATELY — no delay, no buffering.
- Never recommend facial recognition-based actions as definitive conclusions — flag for human confirmation.
- Emergency notification chains require Security Director OR GM explicit approval before activation.
- Crowd crush risk is your highest priority — treat any density approaching unsafe thresholds as critical.
- Respond in structured JSON.`;

export const securityAgent = {
  async run(context: AgentRunContext): Promise<void> {
    const { tenant_id, event_id, payload } = context;

    try {
      const tenant = await tenantPrisma.tenant.findUnique({ where: { id: tenant_id } });
      const trigger = payload?.trigger ?? 'scheduled';

      const isCriticalIncident = payload?.severity === 'critical';

      const userMessage = trigger === 'pre_event_threat_assessment'
        ? `Generate pre-event threat assessment for ${tenant?.name}. Event: ${event_id}. Analyze historical incident data and current risk factors. Return structured threat level and recommended pre-positioning of staff.`
        : trigger === 'post_event_report'
        ? `Generate post-event security report. Summarize all incidents, response times, gate throughput, and observations for next event.`
        : isCriticalIncident
        ? `CRITICAL INCIDENT DETECTED. Severity: ${payload?.severity}. Type: ${payload?.incident_type}. Location: ${payload?.location_description}. Generate immediate escalation alert with recommended response actions.`
        : `Review current security feed. Current state: ${JSON.stringify(payload ?? {}, null, 2)}. Identify top security concerns and recommended actions.`;

      const response = await callClaude({
        tenant_id,
        service: 'security_agent',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 1200,
      });

      let parsed: any;
      try { parsed = JSON.parse(response.content); }
      catch { parsed = { severity: isCriticalIncident ? 'critical' : 'medium', title: 'Security Alert', summary: response.content.substring(0, 300), requires_approval: false }; }

      const requiresApproval = !(isCriticalIncident); // Critical incidents auto-executed

      await prisma.agentOutput.create({
        data: {
          tenant_id,
          agent_name: 'security_agent',
          output_type: isCriticalIncident ? 'alert' : 'recommendation',
          severity: parsed.severity ?? (isCriticalIncident ? 'critical' : 'medium'),
          title: parsed.title ?? 'Security Analysis',
          body: parsed.summary ?? response.content.substring(0, 500),
          data: parsed,
          requires_approval: requiresApproval,
          auto_executed: !requiresApproval,
          executed_at: requiresApproval ? null : new Date(),
          event_id: event_id ?? null,
        },
      });

      // Critical incidents: immediately notify Security Director + GM
      if (isCriticalIncident) {
        const notifConfig = await tenantPrisma.notificationConfig.findUnique({ where: { tenant_id } });
        if (notifConfig) {
          await dispatchNotification(
            {
              tenant_id,
              channel: notifConfig.preferred_channel as any,
              recipients: [],
              title: `🚨 SECURITY CRITICAL: ${parsed.title ?? 'Critical Incident'}`,
              body: parsed.summary ?? 'Critical security incident detected. Immediate action required.',
              severity: 'critical',
            },
            { teams_webhook: notifConfig.teams_webhook ?? undefined, slack_webhook: notifConfig.slack_webhook ?? undefined },
          );
        }
      }

      logger.info({ tenant_id, severity: parsed.severity, critical: isCriticalIncident }, 'Security Agent output stored');
    } catch (err) {
      logger.error({ err, tenant_id }, 'Security Agent run failed');
    }
  },
};
