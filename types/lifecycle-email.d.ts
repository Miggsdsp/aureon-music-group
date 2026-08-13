import type { LifecycleJourney } from '@/lib/lifecycle-email';

declare module '@/lib/lifecycle-email' {
  export function sendLifecycleEmail(
    member: Record<string, unknown> & { id: string },
    journey: LifecycleJourney,
    content: {
      subject: string;
      preheader: string;
      heading: string;
      body: string;
      cta: string;
      href: string;
    },
    dedupeKey?: string,
  ): Promise<{ sent: boolean; reason?: string; id?: string }>;
}
