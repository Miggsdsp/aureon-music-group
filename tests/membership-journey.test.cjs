const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');

test('membership plan survives registration and Firebase email verification return',()=>{
 const membership=read('app/membership/page.tsx'),account=read('app/account/page.tsx');
 assert.match(membership,/\/account\?mode=signup&plan=\$\{plan\}/);
 assert.match(account,/params\.get\('plan'\)/);
 assert.match(account,/function verificationContinueUrl\(plan\?:'listener'\|'creator'\).*url\.searchParams\.set\('verified','1'\)/);
 assert.match(account,/url\.searchParams\.set\('plan',plan\)/);
 assert.match(account,/sendEmailVerification\(result\.user,\{url:verificationContinueUrl\(selectedPlan\|\|undefined\)\}\)/);
 assert.match(account,/subscribe\(selectedPlan,false\)/);
 assert.match(account,/if\(!user\.emailVerified\).*Verify your email/);
 assert.match(account,/Your selection is saved/);
});

test('existing signed-in members can continue from selected plan and preserve Stripe verification',()=>{
 const membership=read('app/membership/page.tsx'),account=read('app/account/page.tsx'),checkout=read('app/api/subscriptions/checkout/route.ts');
 assert.match(membership,/if\(!current\).*\/account\?mode=signup&plan=/);
 assert.match(membership,/analyticsCheckoutContext\(\)/);
 assert.match(account,/if\(!user\.emailVerified\)/);
 assert.match(account,/window\.location\.href=data\.url/);
 assert.match(checkout,/requireMember\(request\)/);
 assert.match(checkout,/mode: 'subscription'/);
 assert.match(checkout,/subscription_data:\{metadata:/);
});

test('membership funnel has consent-gated plan selection and checkout failure events',()=>{
 const model=read('lib/analytics-model.ts'),tracker=read('lib/track-analytics.ts'),membership=read('app/membership/page.tsx'),account=read('app/account/page.tsx'),registration=read('app/api/analytics/registration/route.ts');
 for(const event of ['membership_view','membership_plan_select','registration_start','registration_complete','subscription_checkout_start','membership_checkout_failure','subscription_complete'])assert.ok(model.includes(`'${event}'`),`${event} is declared`);
 assert.match(tracker,/!analyticsConsent\(\)/);
 assert.match(membership,/eventType:'membership_view'/);
 assert.match(membership,/aureon-consent-change/);
 assert.match(membership,/eventType:'membership_plan_select'/);
 assert.match(membership,/eventType:'membership_checkout_failure'/);
 assert.match(account,/eventType:'registration_start'/);
 assert.match(account,/aureon-consent-change/);
 assert.match(account,/eventType:'membership_checkout_failure'/);
 assert.match(account,/analyticsCheckoutContext\(\),plan:selectedPlan/);
 assert.match(registration,/plan=body\?\.plan==='listener'\|\|body\?\.plan==='creator'\?body\.plan:undefined/);
});

test('membership prices, plan terms and mobile call to action remain clear',()=>{
 const membership=read('app/membership/page.tsx'),styles=read('app/membership/membership.css');
 assert.match(membership,/price:'€8\.99'/);assert.match(membership,/price:'€24\.99'/);
 assert.match(membership,/Cancel anytime/);assert.match(membership,/Subscriptions renew monthly until cancelled/);
 assert.match(membership,/Not included \/ limits/);
 assert.match(styles,/@media\(max-width:700px\)/);assert.match(styles,/min-height:46px/);
});
