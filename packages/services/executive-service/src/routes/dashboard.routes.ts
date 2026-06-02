import { FastifyInstance } from 'fastify';
import { createPrismaClient, callClaude, cacheGet, cacheSet, logger } from '@venueiq/shared-utils';

const prisma = createPrismaClient(process.env.EXECUTIVE_DATABASE_URL!);
const tenantPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/executive/dashboard — main executive command center payload
  app.get('/dashboard', async (request, reply) => {
    const { tenant_id } = request.query as any;
    if (!tenant_id) return reply.status(400).send({ success: false, error: { code: 'MISSING_TENANT', message: 'tenant_id required' } });

    const cacheKey = `executive:dashboard:${tenant_id}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) return { success: true, data: cached, cached: true };

    const [tenant, liveEvents, upcomingEvents, briefing, riskItems, recentAgentOutputs] = await Promise.all([
      tenantPrisma.tenant.findUnique({ where: { id: tenant_id } }),
      tenantPrisma.event.findMany({ where: { tenant_id, status: 'live' }, take: 1 }),
      tenantPrisma.event.findMany({ where: { tenant_id, status: 'scheduled', scheduled_at: { gte: new Date() } }, orderBy: { scheduled_at: 'asc' }, take: 12 }),
      prisma.dailyBriefing.findFirst({ where: { tenant_id }, orderBy: { created_at: 'desc' } }),
      prisma.riskOpportunity.findMany({ where: { tenant_id, dismissed: false }, orderBy: { created_at: 'desc' }, take: 20 }),
      prisma.kpiSnapshot.findMany({ where: { tenant_id }, orderBy: { snapshot_at: 'desc' }, take: 50 }),
    ]);

    const liveEvent = liveEvents[0] ?? null;

    const dashboard = {
      tenant: { id: tenant?.id, name: tenant?.name, type: tenant?.type, tier: tenant?.tier },
      is_event_day: !!liveEvent,
      live_event: liveEvent ? {
        event_id: liveEvent.id,
        event_name: liveEvent.name,
        started_at: liveEvent.scheduled_at,
        elapsed_minutes: Math.floor((Date.now() - liveEvent.scheduled_at.getTime()) / 60_000),
        expected_attendance: liveEvent.expected_attendance,
      } : null,
      briefing: briefing ? {
        id: briefing.id,
        content: briefing.content,
        generated_at: briefing.created_at,
      } : null,
      kpi_strip: buildKpiStrip(recentAgentOutputs),
      risk_opportunities: riskItems,
      upcoming_events: upcomingEvents.map((e) => ({
        event_id: e.id,
        event_name: e.name,
        event_date: e.scheduled_at,
        event_type: e.type,
        expected_attendance: e.expected_attendance,
        projected_revenue: null, // populated from ML service
      })),
    };

    await cacheSet(cacheKey, dashboard, 30); // 30-second cache for real-time feel

    return { success: true, data: dashboard };
  });

  // POST /api/executive/briefing/generate — on-demand briefing generation
  app.post('/briefing/generate', async (request, reply) => {
    const { tenant_id } = request.body as any;

    const [tenant, liveEvent, recentKpis] = await Promise.all([
      tenantPrisma.tenant.findUnique({ where: { id: tenant_id } }),
      tenantPrisma.event.findFirst({ where: { tenant_id, status: 'live' } }),
      prisma.kpiSnapshot.findMany({ where: { tenant_id }, orderBy: { snapshot_at: 'desc' }, take: 20 }),
    ]);

    const response = await callClaude({
      tenant_id,
      service: 'executive_briefing',
      system: `You are the daily briefing AI for ${tenant?.name ?? 'VenueIQ'} — a ${tenant?.type ?? 'venue'} operations platform.
Generate a concise 3-paragraph executive briefing. Tone: direct, executive-level, no fluff.
Structure: (1) What happened yesterday / recently, (2) What to watch today, (3) Top 3 recommended actions.
Use specific numbers where available from the KPI data.`,
      messages: [{
        role: 'user',
        content: `Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
${liveEvent ? `Active event: ${liveEvent.name}` : 'No active event today.'}
Recent KPI data: ${JSON.stringify(recentKpis.slice(0, 10), null, 2)}
Generate the daily briefing.`,
      }],
      max_tokens: 600,
    });

    const briefing = await prisma.dailyBriefing.upsert({
      where: { tenant_id_briefing_date: { tenant_id, briefing_date: new Date() } },
      create: {
        tenant_id,
        content: response.content,
        event_id: liveEvent?.id ?? null,
        briefing_date: new Date(),
        token_count: response.input_tokens + response.output_tokens,
        cost_usd: response.cost_usd,
      },
      update: {
        content: response.content,
        token_count: response.input_tokens + response.output_tokens,
        cost_usd: response.cost_usd,
      },
    });

    return { success: true, data: briefing };
  });

  // POST /api/executive/risk-opportunity/:id/dismiss
  app.post('/risk-opportunity/:id/dismiss', async (request, reply) => {
    const { id } = request.params as any;
    const { tenant_id } = request.body as any;
    await prisma.riskOpportunity.update({
      where: { id },
      data: { dismissed: true },
    });
    return { success: true };
  });

  // POST /api/executive/risk-opportunity/:id/act
  app.post('/risk-opportunity/:id/act', async (request, reply) => {
    const { id } = request.params as any;
    const { tenant_id, user_id } = request.body as any;
    await prisma.riskOpportunity.update({
      where: { id },
      data: { acted_on: true, acted_by: user_id, acted_at: new Date() },
    });
    return { success: true };
  });
}

function buildKpiStrip(snapshots: any[]): Record<string, unknown> {
  // Aggregate KPIs from recent snapshots
  const kpiMap: Record<string, number[]> = {};
  for (const s of snapshots) {
    const kpis = s.kpis as Record<string, number>;
    for (const [k, v] of Object.entries(kpis)) {
      if (!kpiMap[k]) kpiMap[k] = [];
      kpiMap[k].push(Number(v));
    }
  }
  const avg = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length;
  return {
    total_revenue: { value: avg(kpiMap['total_revenue'] ?? [0]), formatted: '$0', delta_pct: null, sparkline: kpiMap['total_revenue'] ?? [] },
    attendance: { value: avg(kpiMap['attendance'] ?? [0]), formatted: '0', delta_pct: null, sparkline: kpiMap['attendance'] ?? [] },
    concession_per_cap: { value: avg(kpiMap['concession_per_cap'] ?? [0]), formatted: '$0', delta_pct: null, sparkline: [] },
    merch_per_cap: { value: avg(kpiMap['merch_per_cap'] ?? [0]), formatted: '$0', delta_pct: null, sparkline: [] },
    parking_revenue: { value: avg(kpiMap['parking_revenue'] ?? [0]), formatted: '$0', delta_pct: null, sparkline: [] },
    sponsorship_activations: { value: avg(kpiMap['sponsorship_activations'] ?? [0]), formatted: '0', delta_pct: null, sparkline: [] },
  };
}
