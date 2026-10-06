import Stripe from 'stripe';

export type StripeFeeBreakdown = {
  stripeFee: number;
  netAmount: number;
  stripeBalanceTransactionId: string;
};

function balanceTransactionFromCharge(charge: any) {
  const value = charge?.balance_transaction;
  if (!value) return null;
  if (typeof value === 'string') return { id: value, fee: 0, net: 0 };
  return {
    id: String(value.id || ''),
    fee: Number(value.fee || 0),
    net: Number(value.net || 0),
  };
}

export async function stripeFeeFromInvoice(stripe: Stripe, invoice: Stripe.Invoice): Promise<StripeFeeBreakdown | null> {
  const invoiceAny = invoice as Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null;
    charge?: string | Stripe.Charge | null;
  };

  const paymentIntentId = typeof invoiceAny.payment_intent === 'string'
    ? invoiceAny.payment_intent
    : invoiceAny.payment_intent?.id || '';

  if (paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    });
    const charge = typeof paymentIntent.latest_charge === 'string' ? null : paymentIntent.latest_charge;
    const balance = balanceTransactionFromCharge(charge);
    if (balance?.id) return { stripeFee: balance.fee, netAmount: balance.net, stripeBalanceTransactionId: balance.id };
  }

  const chargeId = typeof invoiceAny.charge === 'string' ? invoiceAny.charge : invoiceAny.charge?.id || '';
  if (chargeId) {
    const charge = await stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] });
    const balance = balanceTransactionFromCharge(charge);
    if (balance?.id) return { stripeFee: balance.fee, netAmount: balance.net, stripeBalanceTransactionId: balance.id };
  }

  return null;
}
