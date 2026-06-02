import { callClaude, createPrismaClient, logger } from '@venueiq/shared-utils';
import { AgentRunContext } from '../agent-runner';

const prisma = createPrismaClient(process.env.AGENTS_DATABASE_URL!);
const tenantPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

const SYSTEM_PROMPT = `You are the Facilities Agent for VenueIQ — a predictive maintenance and facilities intelligence specialist.

You monitor all IoT sensor data for asset health anomalies and generate maintenance recommendations
that prevent failures BEFORE they happen.

Key outputs:
1. Predictive maintenance work order recommendations (requires Facilities Manager approval)
2. Asset fault alerts (auto-executed immediately — no approval needed)
3. HVAC/energy optimization recommendations
4. Pre-event venue readiness reports
5. Daily energy consumption analysis

For predictive maintenance: always include failure probability %, days-to-estimated-failure,
the specific sensor anomaly that triggered the alert, and recommended action.

Respond in JSON.`;

export const facilitiesAgent = {
  async run(context: AgentRunContext): Promise<void> {
    const { tenant_id, event_id, payload } = context;

    try {
      const tenant = await tenantPrisma.tenant.findUnique({ where: { id: tenant_id } });
      const trigger = payload?.trigger ?? 'scheduled';

      const userMessage = trigger === 'pre_event_readiness'
        ? `Generate pre-event venue readiness report for ${tenant?.name}. Verify all critical systems. Flag anything that needs attention before gates open.`
        : trigger === 'energy_report'
        ? `Generate daily energy consumption analysis. Compare to budget and prior week. Identify optimization opportunities.`
        : `Review IoT sensor data. ${JSON.stringify(payload ?? {}, null, 2)}. Identify asset health anomalies, predict failures, and recommend HVAC optimizations.`;

      const response = await callClaude({
        tenant_id,
        service: 'facilities_agent',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 1500,
      });

      let parsed: any;
      try { parsed = JSON.parse(response.content); }
      catch { parsed = { output_type: 'recommendation', severity: 'medium', title: 'Facilities Analysis', summary: response.content.substring(0, 300) }; }

      const isAssetFault = parsed.severity === 'critical' && parsed.fault_detected === true;
      const requiresApproval = !isAssetFault; // Faults auto-execute, maintenance recommendations require approval

      await prisma.agentOutput.create({
        data: {
          tenant_id,
          agent_name: 'facilities_agent',
          output_type: isAssetFault ? 'alert' : trigger.includes('report') ? 'report' : 'recommendation',
          severity: parsed.severity ?? 'medium',
          title: parsed.title ?? 'Facilities Analysis',
          body: parsed.summary ?? '',
          data: parsed,
          requires_approval: requiresApproval,
          auto_executed: !requiresApproval,
          executed_at: requiresApproval ? null : new Date(),
          event_id: event_id ?? null,
        },
      });

      logger.info({ tenant_id, trigger, fault: isAssetFault }, 'Facilities Agent output stored');
    } catch (err) {
      logger.error({ err, tenant_id }, 'Facilities Agent run failed');
    }
  },
};
