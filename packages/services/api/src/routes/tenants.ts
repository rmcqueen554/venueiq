import { FastifyInstance } from 'fastify';
import { db } from '../db';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null;

export async function tenantsRoutes(app: FastifyInstance) {
  // ── Tenant CRUD ────────────────────────────────────────────────────────
  app.get('/tenants/:slug', async (req, reply) => {
    const { slug } = req.params as any;
    const tenant = await db.tenant.findUnique({
      where: { slug },
      include: { venues: true, data_sources: { select: { source_type: true, status: true, last_sync_at: true } } },
    });
    if (!tenant) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return { success: true, data: tenant };
  });

  app.patch('/tenants/:tenant_id', async (req, reply) => {
    const { tenant_id } = req.params as any;
    const body = req.body as any;
    const updated = await db.tenant.update({ where: { id: tenant_id }, data: body });
    return { success: true, data: updated };
  });

  // ── Events ────────────────────────────────────────────────────────────
  app.get('/tenants/:tenant_id/events', async (req, reply) => {
    const { tenant_id } = req.params as any;
    const { status, limit = '20' } = req.query as any;
    const events = await db.event.findMany({
      where: { tenant_id, ...(status ? { status } : {}) },
      orderBy: { scheduled_at: 'asc' },
      take: parseInt(limit),
    });
    return { success: true, data: events };
  });

  app.post('/tenants/:tenant_id/events', async (req, reply) => {
    const { tenant_id } = req.params as any;
    const body = req.body as any;
    const venue = await db.venue.findFirst({ where: { tenant_id } });
    if (!venue) return reply.status(400).send({ success: false, error: { code: 'NO_VENUE', message: 'No venue configured' } });
    const event = await db.event.create({
      data: {
        tenant_id,
        venue_id: venue.id,
        name: body.name,
        type: body.type,
        opponent_or_artist: body.opponent_or_artist,
        scheduled_at: new Date(body.scheduled_at),
        gates_open_at: body.gates_open_at ? new Date(body.gates_open_at) : undefined,
        expected_attendance: body.expected_attendance,
        status: 'scheduled',
      },
    });
    return reply.status(201).send({ success: true, data: event });
  });

  app.patch('/tenants/:tenant_id/events/:event_id/status', async (req, reply) => {
    const { event_id } = req.params as any;
    const { status } = req.body as any;
    const event = await db.event.update({ where: { id: event_id }, data: { status } });
    return { success: true, data: event };
  });

  // ── Onboarding ────────────────────────────────────────────────────────
  app.post('/onboarding/step/1', async (req, reply) => {
    const body = req.body as any;
    const slug = `${body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

    const tenant = await db.tenant.create({
      data: {
        name: body.name,
        slug,
        type: body.type ?? 'stadium',
        capacity: body.capacity ? parseInt(body.capacity) : null,
        timezone: body.timezone ?? 'America/New_York',
        tier: 'starter',
        white_label_config: body.logo_url
          ? { logo_url: body.logo_url, primary_color: '#E8A838', app_name: 'VenueIQ', favicon_url: null }
          : null,
      },
    });

    await db.venue.create({
      data: { tenant_id: tenant.id, name: body.name, address: body.address, city: body.city, state: body.state },
    });

    await db.onboardingProgress.create({ data: { tenant_id: tenant.id, step: 1, step_data: body } });

    return reply.status(201).send({ success: true, data: { tenant_id: tenant.id, slug: tenant.slug } });
  });

  app.post('/onboarding/:tenant_id/step/:step', async (req, reply) => {
    const { tenant_id, step } = req.params as any;
    const body = req.body as any;
    await db.onboardingProgress.upsert({
      where: { tenant_id },
      create: { tenant_id, step: parseInt(step), step_data: body },
      update: { step: parseInt(step), step_data: body },
    });
    if (step === '7') {
      await db.tenant.update({ where: { id: tenant_id }, data: { onboarding_completed_at: new Date() } });
      await db.onboardingProgress.update({ where: { tenant_id }, data: { completed: true } });
    }
    return { success: true };
  });

  // ── Users ─────────────────────────────────────────────────────────────
  app.get('/users/:tenant_id', async (req, reply) => {
    const { tenant_id } = req.params as any;
    const users = await db.tenantUser.findMany({ where: { tenant_id } });
    return { success: true, data: users };
  });

  app.post('/users/:tenant_id/invite', async (req, reply) => {
    const { tenant_id } = req.params as any;
    const { email, role } = req.body as any;
    const user = await db.tenantUser.create({
      data: { tenant_id, user_id: `pending_${Date.now()}`, role, permissions: {} },
    });
    return reply.status(201).send({ success: true, data: user });
  });

  // ── Data Sources ──────────────────────────────────────────────────────
  app.get('/tenants/:tenant_id/data-sources', async (req, reply) => {
    const { tenant_id } = req.params as any;
    const sources = await db.tenantDataSource.findMany({
      where: { tenant_id },
      select: { id: true, source_type: true, status: true, last_sync_at: true, error_message: true },
    });
    return { success: true, data: sources };
  });

  // ── Billing ───────────────────────────────────────────────────────────
  app.post('/billing/checkout', async (req, reply) => {
    if (!stripe) return reply.status(503).send({ success: false, error: { code: 'NO_STRIPE', message: 'Stripe not configured' } });
    const { tenant_id, tier, email } = req.body as any;
    const priceMap: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_STARTER ?? '',
      professional: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
    };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceMap[tier], quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { tenant_id, tier },
    });
    return { success: true, data: { checkout_url: session.url } };
  });

  // Stripe webhook
  app.post('/billing/webhook', async (req, reply) => {
    if (!stripe) return reply.status(503).send({ received: false });
    const sig = req.headers['stripe-signature'] as string;
    try {
      const event = stripe.webhooks.constructEvent(
        (req as any).rawBody ?? JSON.stringify(req.body),
        sig,
        process.env.STRIPE_WEBHOOK_SECRET ?? '',
      );
      if (event.type === 'checkout.session.completed') {
        const s = event.data.object as any;
        await db.tenant.update({
          where: { id: s.metadata.tenant_id },
          data: { stripe_customer_id: s.customer, stripe_subscription_id: s.subscription, tier: s.metadata.tier },
        });
      }
      return { received: true };
    } catch { return reply.status(400).send({ received: false }); }
  });
}
