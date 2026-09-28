'use client';

import Link from 'next/link';
import { trackAnalytics } from '@/lib/track-analytics';

type Props = {
  href: string;
  label: string;
  pageSlug: string;
  cta: string;
  variant?: 'primary' | 'ghost';
};

export function CreatorLicensingCta({ href, label, pageSlug, cta, variant = 'primary' }: Props) {
  return (
    <Link
      className={variant === 'primary' ? 'primary-button' : 'ghost-button'}
      href={href}
      onClick={() => trackAnalytics({
        eventType: 'creator_cta_click',
        entityType: 'creator_licensing_page',
        entityId: pageSlug,
        slug: pageSlug,
        title: label,
        metadata: { cta, destination: href },
      })}
    >
      {label}
    </Link>
  );
}
