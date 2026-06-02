import cron from 'node-cron';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import pino from 'pino';

const logger = pino({ level: 'info' });
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function getActiveTenants() {
  return db.tenant.findMany({
    where: { onboarding_completed_at: { not: null } },
    select: { id: true, name: true, type: true },
  });
}

async function runCooAgentForTenant(tenantId: string, tenantName: string) {
  try {
    if (!anthropic) return;

    const [liveEvent, riskCount] = await Promise.all([
      db.event.findFirst({ where: { tenant_id: tenantId, status: 'live' } }),
      db.riskOpportunity.count({ where: { tenant_id: tenantId, dismissed: false } }),
    ]);

    if (!liveEvent) return; // Only run during events to conserve API calls

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: `You are the COO Agent for ${tenantName}. Identify the top operational recommendation for the current event. Be specific and actionable. Respond in JSON: {"title":"...", "description":"...", "recommended_action":"...", "severity":"high|medium|low", "module":"..."}`,
      messages: [{ role: 'user', content: `Live event: ${liveEvent.name}. Active risks: ${riskCount}. What is the top action right now?` }],
    });

    const content = (response.content[0] as any).text;
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { return; }

    await db.agentOutput.create({
      data: {
        tenant_id: tenantId,
        agent_name: 'coo_agent',
        output_type: 'recommendation',
        severity: parsed.severity ?? 'medium',
        title: parsed.title ?? 'COO Analysis',
        body: parsed.description ?? '',
        data: parsed,
        requires_approval: false,
        auto_executed: true,
        executed_at: new Date(),
        event_id: liveEvent.id,
      },
    });

    await db.claudeApiCallLog.create({
      data: {
        tenant_id: tenantId, service: 'coo_agent',
        model: 'claude-sonnet-4-20250514',
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cost_usd: (response.usage.input_tokens * 3 + response.usage.output_tokens * 15) / 1_000_000,
        latency_ms: 0,
      },
    }).catch(() => {});

  } catch (err) {
    logger.error({ err, tenant_id: tenantId }, 'COO agent error');
  }
}

async function generateDailyBriefings() {
  const tenants = await getActiveTenants();
  for (const tenant of tenants) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await db.dailyBriefing.findUnique({
        where: { tenant_id_briefing_date: { tenant_id: tenant.id, briefing_date: today } },
      });
      if (existing) continue;

      const liveEvent = await db.event.findFirst({ where: { tenant_id: tenant.id, status: { in: ['live', 'scheduled'] }, scheduled_at: { gte: today } } });

      let content = `Good morning, ${tenant.name} team. Today's briefing:\n\n`;
      content += liveEvent ? `Event today: "${liveEvent.name}". Ensure all departments are ready.\n\n` : `No events scheduled today. Focus on preparation and maintenance.\n\n`;
      content += `All AI agents are monitoring your operations. Check the dashboard for real-time insights.`;

      await db.dailyBriefing.create({
        data: { tenant_id: tenant.id, content, event_id: liveEvent?.id ?? null, briefing_date: today },
      });
    } catch { /* continue */ }
  }
}

export function startAgentScheduler() {
  if (process.env.AGENTS_ENABLED === 'false') {
    logger.info('Agent scheduler disabled');
    return;
  }

  // Daily briefing at 6 AM
  cron.schedule('0 6 * * *', async () => {
    logger.info('Running daily briefing generation');
    await generateDailyBriefings();
  });

  // COO agent — every 15 minutes during events (conservative for free tier)
  cron.schedule('*/15 * * * *', async () => {
    const tenants = await getActiveTenants().catch(() => []);
    for (const t of tenants) {
      await runCooAgentForTenant(t.id, t.name);
    }
  });

  logger.info('Agent scheduler started (daily briefing + 15min COO checks)');
}
