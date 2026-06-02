import { callClaude, createPrismaClient, sendEmail, buildBriefingEmail, logger } from '@venueiq/shared-utils';
import { AgentRunContext } from '../agent-runner';

const prisma = createPrismaClient(process.env.AGENTS_DATABASE_URL!);
const tenantPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

const SYSTEM_PROMPT = `You are the Executive Strategy Agent for VenueIQ — a senior management consultant
and strategist with deep expertise in sports, entertainment, and live event venue economics.

You see patterns across time that single-event agents miss. Your weekly and monthly reports
identify multi-event trends, competitive benchmarks, and long-term revenue opportunities.

Tone: Direct, executive-level. No fluff. C-suite quality. Write as if you're presenting to the
board of directors or a major investor. Back every claim with data.

Respond in structured format (can include markdown for reports).`;

export const executiveStrategyAgent = {
  async run(context: AgentRunContext): Promise<void> {
    const { tenant_id, event_id, payload } = context;

    try {
      const tenant = await tenantPrisma.tenant.findUnique({
        where: { id: tenant_id },
        include: { users: { where: { role: { in: ['general_manager', 'venue_owner', 'cfo'] } }, take: 10 } },
      });

      const trigger = payload?.trigger ?? 'weekly_report';

      const userMessage = trigger === 'weekly_report'
        ? `Generate weekly performance summary for ${tenant?.name}.

Structure:
1. Week in Review (2-3 sentences, top-line numbers)
2. Revenue Performance (vs. prior week, vs. budget, key drivers)
3. Operational Highlights (what went well)
4. Key Issues & Resolution Status
5. Next Week Preview (upcoming events, anticipated challenges)
6. Top 3 Recommended Actions for Next Week

Today: ${new Date().toISOString()}`
        : trigger === 'monthly_report'
        ? `Generate monthly strategic report for ${tenant?.name}.

Structure:
1. Executive Summary (5 key numbers of the month)
2. Revenue Analysis (by stream, vs. budget, vs. prior year)
3. Trend Analysis (what patterns emerged over 30 days)
4. Fan Experience Score Summary
5. Operational Efficiency Scorecard
6. Competitive Position Assessment
7. Strategic Recommendations (3-5 high-impact actions for next month)
8. Next Month Outlook

Month: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        : `Answer this strategic question for ${tenant?.name}: ${payload?.question ?? 'What are the top strategic opportunities this quarter?'}`;

      const response = await callClaude({
        tenant_id,
        service: 'executive_strategy_agent',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 3000,
        use_cache: true,
      });

      const title = trigger === 'weekly_report'
        ? `Weekly Performance Summary — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : trigger === 'monthly_report'
        ? `Monthly Strategic Report — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        : `Strategic Analysis`;

      await prisma.agentOutput.create({
        data: {
          tenant_id,
          agent_name: 'executive_strategy_agent',
          output_type: trigger.includes('question') ? 'recommendation' : 'report',
          severity: 'info',
          title,
          body: response.content.substring(0, 1000),
          data: { full_content: response.content, trigger, token_count: response.input_tokens + response.output_tokens },
          requires_approval: false,
          auto_executed: true,
          executed_at: new Date(),
          event_id: event_id ?? null,
        },
      });

      // Email the report to GM, Owner, CFO
      if (trigger !== 'question' && tenant?.users?.length) {
        const recipients = tenant.users.map((u: any) => u.user_id).filter(Boolean);
        // In production, look up email addresses from Clerk
        logger.info({ tenant_id, recipients: recipients.length }, 'Executive strategy report ready for delivery');
      }

      logger.info({ tenant_id, trigger, title }, 'Executive Strategy Agent output stored');
    } catch (err) {
      logger.error({ err, tenant_id }, 'Executive Strategy Agent run failed');
    }
  },
};
