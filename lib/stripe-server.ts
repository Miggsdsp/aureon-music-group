import Stripe from 'stripe';
import { assertStripeKeyIsolation } from '@/lib/runtime-safety';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  assertStripeKeyIsolation(secretKey);

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      appInfo: {
        name: 'Aureon Music Group',
        version: '1.0.0'
      }
    });
  }

  return stripeClient;
}
