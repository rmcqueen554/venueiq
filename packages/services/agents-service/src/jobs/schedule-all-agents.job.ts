import cron from 'node-cron';
import { Queue } from 'bullmq';
import { getRedis, createPrismaClient, logger } from '@venueiq/shared-utils';

const agentQueue = new Queue('agent-tasks', { connection: getRedis() });
const tenantsPrisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

async function getActiveTenants() {
  return tenantsPrisma.tenant.findMany({
    where: { onboarding_completed_at: { not: null } },
    select: { id: true, timezone: true, tier: true },
  });
}

async function queueAgent(agentName: string, tenantId: string, payload?: Record<string, unknown>) {
  await agentQueue.add(
    agentName,
    { agent_name: agentName, tenant_id: tenantId, payload },
    { removeOnComplete: 100, removeOnFail: 50 },
  );
}

export async function scheduleAllAgents() {
  logger.info('Setting up agent CRON schedules');

  // COO Agent — every 5 minutes during business hours
  cron.schedule('*/5 * * * *', async () => {
    const tenants = await getActiveTenants();
    await Promise.all(tenants.map((t) => queueAgent('coo_agent', t.id)));
  });

  // Revenue Agent — every 3 minutes (event-day pace)
  cron.schedule('*/3 * * * *', async () => {
    const tenants = await getActiveTenants();
    await Promise.all(tenants.map((t) => queueAgent('revenue_agent', t.id)));
  });

  // Concessions Agent — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    const tenants = await getActiveTenants();
    await Promise.all(tenants.map((t) => queueAgent('concessions_agent', t.id)));
  });

  // Sponsorship Agent — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const tenants = await getActiveTenants();
    await Promise.all(tenants.map((t) => queueAgent('sponsorship_agent', t.id)));
  });

  // Ticketing Agent — daily + hourly near event
  cron.schedule('0 */6 * * *', async () => {
    const tenants = await getActiveTenants();
    await Promise.all(tenants.map((t) => queueAgent('ticketing_agent', t.id)));
  });

  // Security Agent — every 60 seconds during events
  cron.schedule('* * * * *', async () => {
    const tenants = await getActiveTenants();
    await Promise.all(tenants.map((t) => queueAgent('security_agent', t.id)));
  });

  // Facilities Agent — every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    const tenants = await getActiveTenants();
    await Promise.all(tenants.map((t) => queueAgent('facilities_agent', t.id)));
  });

  // Executive Strategy Agent — Monday 7 AM + 1st of month
  cron.schedule('0 7 * * 1', async () => {
    const tenants = await getActiveTenants();
    await Promise.all(tenants.map((t) => queueAgent('executive_strategy_agent', t.id, { type: 'weekly_report' })));
  });

  cron.schedule('0 7 1 * *', async () => {
    const tenants = await getActiveTenants();
    await Promise.all(tenants.map((t) => queueAgent('executive_strategy_agent', t.id, { type: 'monthly_report' })));
  });

  // Pre-event triggers — 6 hours before each event
  cron.schedule('0 * * * *', async () => {
    const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const sixHoursWindow = new Date(sixHoursFromNow.getTime() + 60 * 60 * 1000);

    const upcomingEvents = await tenantsPrisma.event.findMany({
      where: {
        scheduled_at: { gte: sixHoursFromNow, lte: sixHoursWindow },
        status: 'scheduled',
      },
    });

    for (const event of upcomingEvents) {
      await Promise.all([
        queueAgent('coo_agent', event.tenant_id, { event_id: event.id, trigger: 'pre_event_6h' }),
        queueAgent('security_agent', event.tenant_id, { event_id: event.id, trigger: 'pre_event_threat_assessment' }),
        queueAgent('facilities_agent', event.tenant_id, { event_id: event.id, trigger: 'pre_event_readiness' }),
        queueAgent('concessions_agent', event.tenant_id, { event_id: event.id, trigger: 'pre_event_inventory' }),
        queueAgent('revenue_agent', event.tenant_id, { event_id: event.id, trigger: 'pre_event_strategy' }),
      ]);
    }
  });

  // Post-event triggers — 30 minutes after event ends
  cron.schedule('*/15 * * * *', async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const fortyFiveMinAgo = new Date(Date.now() - 45 * 60 * 1000);

    const recentlyCompletedEvents = await tenantsPrisma.event.findMany({
      where: {
        status: 'completed',
        updated_at: { gte: fortyFiveMinAgo, lte: thirtyMinAgo },
      },
    });

    for (const event of recentlyCompletedEvents) {
      await Promise.all([
        queueAgent('coo_agent', event.tenant_id, { event_id: event.id, trigger: 'post_event_report' }),
        queueAgent('concessions_agent', event.tenant_id, { event_id: event.id, trigger: 'post_event_report' }),
        queueAgent('security_agent', event.tenant_id, { event_id: event.id, trigger: 'post_event_report' }),
        queueAgent('sponsorship_agent', event.tenant_id, { event_id: event.id, trigger: 'post_event_sponsor_reports' }),
      ]);
    }
  });

  logger.info('All agent CRON schedules active');
}
