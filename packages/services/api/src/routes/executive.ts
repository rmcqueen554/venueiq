import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export async function executiveRoutes(app: FastifyInstance) {
  // ── Main dashboard payload ─────────────────────────────────────────────
  app.get('/executive/dashboard', async (req, reply) => {
    const { tenant_id } = req.query as any;
    if (!tenant_id) return reply.status(400).send({ success: false, error: { code: 'MISSING_TENANT', message: 'tenant_id required' } });

    const [tenant, liveEvents, upcomingEvents, briefing, riskItems, recentAgentOutputs] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenant_id } }),
      db.event.findMany({ where: { tenant_id, status: 'live' }, take: 1 }),
      db.event.findMany({
        where: { tenant_id, status: 'scheduled', scheduled_at: { gte: new Date() } },
        orderBy: { scheduled_at: 'asc' },
        take: 12,
      }),
      db.dailyBriefing.findFirst({ where: { tenant_id }, orderBy: { created_at: 'desc' } }),
      db.riskOpportunity.findMany({
        where: { tenant_id, dismissed: false },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      db.agentOutput.findMany({
        where: { tenant_id, requires_approval: true, approved_at: null, rejected_at: null },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);

    const liveEvent = liveEvents[0] ?? null;

    return {
      success: true,
      data: {
        tenant: { id: tenant?.id, name: tenant?.name, type: tenant?.type, tier: tenant?.tier, white_label_config: tenant?.white_label_config },
        is_event_day: !!liveEvent,
        live_event: liveEvent ? {
          event_id: liveEvent.id,
          event_name: liveEvent.name,
          started_at: liveEvent.scheduled_at,
          elapsed_minutes: Math.floor((Date.now() - liveEvent.scheduled_at.getTime()) / 60_000),
        } : null,
        briefing: briefing ? { id: briefing.id, content: briefing.content, generated_at: briefing.created_at } : null,
        risk_opportunities: riskItems,
        pending_approvals: recentAgentOutputs,
        upcoming_events: upcomingEvents.map((e) => ({
          event_id: e.id, event_name: e.name, event_date: e.scheduled_at,
          event_type: e.type, expected_attendance: e.expected_attendance,
        })),
        kpi_strip: {
          total_revenue:        { value: 0, formatted: '$0', delta_pct: null, sparkline: [] },
          attendance:           { value: 0, formatted: '0', delta_pct: null, sparkline: [] },
          concession_per_cap:   { value: 0, formatted: '$0', delta_pct: null },
          merch_per_cap:        { value: 0, formatted: '$0', delta_pct: null },
          parking_revenue:      { value: 0, formatted: '$0', delta_pct: null },
          sponsorship_activations: { value: 0, formatted: '0%', delta_pct: null },
        },
      },
    };
  });

  // ── AI Briefing generation ─────────────────────────────────────────────
  app.post('/executive/briefing/generate', async (req, reply) => {
    const { tenant_id } = req.body as any;

    const [tenant, liveEvent] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenant_id } }),
      db.event.findFirst({ where: { tenant_id, status: 'live' } }),
    ]);

    let content = `Good morning. Here's your VenueIQ operational briefing for ${tenant?.name ?? 'your venue'}.\n\n`;
    content += liveEvent
      ? `An event is currently live: "${liveEvent.name}". Monitor all departments for real-time updates.\n\n`
      : `No events are currently live. Review upcoming event preparation and system health.\n\n`;
    content += `All AI agents are running and monitoring your operations. Check the Risk & Opportunity feed for the latest recommendations.`;

    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: `You are the daily briefing AI for ${tenant?.name ?? 'a sports venue'}. Generate a concise 3-paragraph executive briefing. Tone: direct, no fluff. Structure: (1) What to watch today, (2) Key operational focus, (3) Top 3 recommended actions. Keep it under 200 words.`,
          messages: [{ role: 'user', content: `Date: ${new Date().toDateString()}. ${liveEvent ? `Live event: ${liveEvent.name}.` : 'No live events today.'} Generate briefing.` }],
        });
        content = (response.content[0] as any).text;

        // Log cost
        await db.claudeApiCallLog.create({
          data: {
            tenant_id,
            service: 'executive_briefing',
            model: 'claude-sonnet-4-20250514',
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
            cost_usd: (response.usage.input_tokens * 3 + response.usage.output_tokens * 15) / 1_000_000,
            latency_ms: 0,
          },
        }).catch(() => {});
      } catch { /* fallback to default content */ }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const briefing = await db.dailyBriefing.upsert({
      where: { tenant_id_briefing_date: { tenant_id, briefing_date: today } },
      create: { tenant_id, content, event_id: liveEvent?.id ?? null, briefing_date: today },
      update: { content, event_id: liveEvent?.id ?? null },
    });

    return { success: true, data: briefing };
  });

  // ── Risk/Opportunity actions ───────────────────────────────────────────
  app.post('/executive/risk-opportunity/:id/dismiss', async (req, reply) => {
    const { id } = req.params as any;
    await db.riskOpportunity.update({ where: { id }, data: { dismissed: true } });
    return { success: true };
  });

  app.post('/executive/risk-opportunity/:id/act', async (req, reply) => {
    const { id } = req.params as any;
    const { user_id } = req.body as any;
    await db.riskOpportunity.update({ where: { id }, data: { acted_on: true, acted_by: user_id, acted_at: new Date() } });
    return { success: true };
  });
}
