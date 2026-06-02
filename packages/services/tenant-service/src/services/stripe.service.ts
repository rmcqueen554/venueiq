import Stripe from 'stripe';
import { logger } from '@venueiq/shared-utils';
import { SubscriptionTier } from '@venueiq/shared-types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

const PRICE_IDS: Record<SubscriptionTier, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL!,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE!,
};

export const stripeService = {
  async createCheckoutSession(
    email: string,
    tier: SubscriptionTier,
    tenantId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { tenant_id: tenantId, tier },
      subscription_data: { metadata: { tenant_id: tenantId, tier } },
    });
    return session;
  },

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session;
  },

  async handleWebhook(payload: Buffer, signature: string) {
    const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    logger.info({ type: event.type }, 'Stripe webhook received');
    return event;
  },

  async getSubscription(subscriptionId: string) {
    return stripe.subscriptions.retrieve(subscriptionId);
  },

  async cancelSubscription(subscriptionId: string) {
    return stripe.subscriptions.cancel(subscriptionId);
  },

  async createUsageRecord(subscriptionItemId: string, quantity: number) {
    return stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    });
  },
};
