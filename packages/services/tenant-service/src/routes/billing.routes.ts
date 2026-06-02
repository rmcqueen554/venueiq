import { FastifyInstance } from 'fastify';
import { createPrismaClient } from '@venueiq/shared-utils';
import { stripeService } from '../services/stripe.service';

const prisma = createPrismaClient(process.env.TENANTS_DATABASE_URL!);

export async function billingRoutes(app: FastifyInstance) {
  // Create checkout session (self-serve signup)
  app.post('/checkout', async (request, reply) => {
    const { tenant_id, tier, email } = request.body as any;
    const session = await stripeService.createCheckoutSession(
      email,
      tier,
      tenant_id,
      `${process.env.FRONTEND_URL}/onboarding?step=2`,
      `${process.env.FRONTEND_URL}/pricing`,
    );
    return { success: true, data: { checkout_url: session.url } };
  });

  // Customer portal (manage subscription)
  app.post('/portal', async (request, reply) => {
    const { tenant_id } = request.body as any;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenant_id } });
    if (!tenant?.stripe_customer_id) {
      return reply.status(400).send({ success: false, error: { code: 'NO_CUSTOMER', message: 'No Stripe customer found' } });
    }
    const session = await stripeService.createCustomerPortalSession(
      tenant.stripe_customer_id,
      `${process.env.FRONTEND_URL}/settings/billing`,
    );
    return { success: true, data: { portal_url: session.url } };
  });

  // Stripe webhook handler
  app.post('/webhook', { config: { rawBody: true } }, async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string;
    try {
      const event = await stripeService.handleWebhook(
        (request as any).rawBody,
        signature,
      );

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const { tenant_id, tier } = session.metadata;
          await prisma.tenant.update({
            where: { id: tenant_id },
            data: {
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              tier,
            },
          });
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data.object as any;
          const tenantId = sub.metadata.tenant_id;
          if (tenantId) {
            await prisma.tenant.update({
              where: { id: tenantId },
              data: { tier: sub.metadata.tier ?? 'starter' },
            });
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as any;
          const tenantId = sub.metadata.tenant_id;
          if (tenantId) {
            await prisma.tenant.update({
              where: { id: tenantId },
              data: { tier: 'starter', stripe_subscription_id: null },
            });
          }
          break;
        }
      }

      return { success: true };
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: 'WEBHOOK_ERROR', message: err.message } });
    }
  });
}
