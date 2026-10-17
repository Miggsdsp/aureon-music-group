const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('lib/admin-funnel.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const transpiledModule = { exports: {} };
vm.runInNewContext(code, { module: transpiledModule, exports: transpiledModule.exports, require });
const { buildMembershipFunnel } = transpiledModule.exports;

test('membership funnel separates consented steps from verified Stripe acquisitions', () => {
  const result = buildMembershipFunnel([
    { eventType: 'page_view', analyticsConsent: true },
    { eventType: 'music_preview_start', analyticsConsent: true },
    { eventType: 'membership_plan_select', plan: 'listener', analyticsConsent: true },
    { eventType: 'membership_plan_select', plan: 'creator', analyticsConsent: false },
    { eventType: 'registration_complete', analyticsConsent: true },
    { eventType: 'subscription_checkout_start', analyticsConsent: true },
    { eventType: 'membership_checkout_failure', analyticsConsent: true },
    { eventType: 'subscription_complete', trusted: true, memberId: 'member-1', revenueCents: 899 },
    { eventType: 'subscription_complete', trusted: true, memberId: 'member-2', revenueCents: 2499 },
    { eventType: 'subscription_complete', trusted: false, memberId: 'client-claim', revenueCents: 899 },
    { eventType: 'subscription_complete', trusted: true, memberId: 'free-session', revenueCents: 0 },
    { eventType: 'membership_renewed', trusted: true, memberId: 'member-1', revenueCents: 899 },
  ], new Set(['member-1']));

  assert.equal(result.pageViews, 1);
  assert.equal(result.previewStarts, 1);
  assert.equal(result.listenerSelections, 1);
  assert.equal(result.creatorSelections, 0);
  assert.equal(result.registrationCompletions, 1);
  assert.equal(result.checkoutStarts, 1);
  assert.equal(result.checkoutFailures, 1);
  assert.equal(result.verifiedPaidSubscriptions, 1);
  assert.equal(buildMembershipFunnel([], null).verifiedPaidSubscriptions, null);
});
