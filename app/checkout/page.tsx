import { PageShell } from '@/components/PageShell';
import { CheckoutForm } from '@/components/CheckoutForm';

export default function CheckoutPage() {
  return (
    <PageShell title="Checkout" kicker="Secure Order">
      <CheckoutForm />
    </PageShell>
  );
}
