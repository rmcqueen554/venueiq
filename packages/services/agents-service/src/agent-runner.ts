import { createPrismaClient, logger } from '@venueiq/shared-utils';
import { AgentName } from '@venueiq/shared-types';
import { cooAgent } from './agents/coo.agent';
import { revenueAgent } from './agents/revenue.agent';
import { concessionsAgent } from './agents/concessions.agent';
import { sponsorshipAgent } from './agents/sponsorship.agent';
import { ticketingAgent } from './agents/ticketing.agent';
import { securityAgent } from './agents/security.agent';
import { facilitiesAgent } from './agents/facilities.agent';
import { executiveStrategyAgent } from './agents/executive-strategy.agent';

const prisma = createPrismaClient(process.env.AGENTS_DATABASE_URL!);

const AGENT_MAP: Record<AgentName, (context: AgentRunContext) => Promise<void>> = {
  coo_agent: cooAgent.run,
  revenue_agent: revenueAgent.run,
  concessions_agent: concessionsAgent.run,
  sponsorship_agent: sponsorshipAgent.run,
  ticketing_agent: ticketingAgent.run,
  security_agent: securityAgent.run,
  facilities_agent: facilitiesAgent.run,
  executive_strategy_agent: executiveStrategyAgent.run,
};

export interface AgentRunContext {
  agent_name: AgentName;
  tenant_id: string;
  event_id?: string;
  payload?: Record<string, unknown>;
}

export const agentRunner = {
  async run(context: AgentRunContext): Promise<void> {
    const agentFn = AGENT_MAP[context.agent_name];
    if (!agentFn) {
      logger.warn({ agent: context.agent_name }, 'Unknown agent');
      return;
    }

    const startMs = Date.now();
    logger.info({ agent: context.agent_name, tenant_id: context.tenant_id }, 'Agent run started');

    try {
      await agentFn(context);
      logger.info(
        { agent: context.agent_name, tenant_id: context.tenant_id, duration_ms: Date.now() - startMs },
        'Agent run completed',
      );
    } catch (err) {
      logger.error({ err, agent: context.agent_name, tenant_id: context.tenant_id }, 'Agent run failed');
    }
  },
};
