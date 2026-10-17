type FunnelEvent = {
  eventType?: string;
  plan?: string;
  analyticsConsent?: boolean;
  trusted?: boolean;
  memberId?: string;
  revenueCents?: number;
};

export function buildMembershipFunnel(events: FunnelEvent[], excludedMemberIds: ReadonlySet<string> | null) {
  const consented = events.filter(event => event.analyticsConsent === true);
  const count = (eventType: string, plan?: 'listener' | 'creator') => consented.filter(event =>
    event.eventType === eventType && (!plan || event.plan === plan)
  ).length;

  // Stripe's webhook writes this trusted event only for a live, paid, active checkout.
  const verifiedPaidSubscriptions = excludedMemberIds === null ? null : events.filter(event =>
    event.eventType === 'subscription_complete' &&
    event.trusted === true &&
    Boolean(event.memberId) &&
    !excludedMemberIds.has(String(event.memberId)) &&
    Number(event.revenueCents) > 0
  ).length;

  return {
    pageViews: count('page_view'),
    previewStarts: count('music_preview_start'),
    previewCompletions: count('music_preview_complete'),
    membershipVisits: count('membership_view'),
    listenerSelections: count('membership_plan_select', 'listener'),
    creatorSelections: count('membership_plan_select', 'creator'),
    registrationStarts: count('registration_start'),
    registrationCompletions: count('registration_complete'),
    checkoutStarts: count('subscription_checkout_start'),
    checkoutFailures: count('membership_checkout_failure'),
    verifiedPaidSubscriptions,
  };
}
