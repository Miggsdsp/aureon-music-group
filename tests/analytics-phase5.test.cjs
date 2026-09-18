const{test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const crypto=require('node:crypto');
const read=path=>fs.readFileSync(path,'utf8');

class Storage{constructor(){this.data=new Map()}getItem(key){return this.data.has(key)?this.data.get(key):null}setItem(key,value){this.data.set(key,String(value))}removeItem(key){this.data.delete(key)}}
function attributionRuntime(url,referrer=''){
 const localStorage=new Storage(),sessionStorage=new Storage(),location=new URL(url),window={dispatchEvent(){},gtag:undefined};
 const code=ts.transpileModule(read('lib/analytics-attribution.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 const document={referrer,cookie:''};
 const context={module,exports:module.exports,require,URL,URLSearchParams,Date,console,crypto:{randomUUID:crypto.randomUUID},CustomEvent:class{},localStorage,sessionStorage,location,document,window};
 vm.runInNewContext(code,context,{filename:'lib/analytics-attribution.ts'});
 return{api:module.exports,localStorage,sessionStorage,location,context};
}

test('standard campaign sources normalize and persist through a catalogue-to-signup journey',()=>{
 const cases=[
  ['https://www.aureonmusicgroup.com/?utm_source=tiktok&utm_medium=organic_social&utm_campaign=aureon_discovery','','tiktok','organic_social'],
  ['https://www.aureonmusicgroup.com/?utm_source=instagram&utm_medium=organic_social&utm_campaign=aureon_discovery','','instagram','organic_social'],
  ['https://www.aureonmusicgroup.com/?utm_source=youtube&utm_medium=organic_social&utm_campaign=aureon_discovery','','youtube','organic_social'],
  ['https://www.aureonmusicgroup.com/','https://www.google.com/search?q=aureon','google','organic_search'],
  ['https://www.aureonmusicgroup.com/?utm_source=google&utm_medium=cpc&utm_campaign=brand_search','','google','cpc'],
  ['https://www.aureonmusicgroup.com/','','direct','none'],
 ];
 for(const[url,referrer,source,medium]of cases){const runtime=attributionRuntime(url,referrer);runtime.localStorage.setItem(runtime.api.ANALYTICS_CONSENT_KEY,'granted');runtime.api.initialiseAttribution();assert.equal(runtime.api.getAnalyticsContext().firstTouch.source,source);assert.equal(runtime.api.getAnalyticsContext().firstTouch.medium,medium)}
 const runtime=attributionRuntime('https://www.aureonmusicgroup.com/songs/dust-on-my-boots?utm_source=tiktok&utm_medium=organic_social&utm_campaign=dust_launch');runtime.localStorage.setItem(runtime.api.ANALYTICS_CONSENT_KEY,'granted');runtime.api.initialiseAttribution();runtime.api.recordContentView('song','dust-on-my-boots');runtime.api.recordContentView('artist','dalton-creed');runtime.context.location=new URL('https://www.aureonmusicgroup.com/account?mode=signup');runtime.api.initialiseAttribution();const context=runtime.api.getAnalyticsContext();assert.equal(context.firstTouch.source,'tiktok');assert.equal(context.firstTouch.landingPage,'/songs/dust-on-my-boots?utm_source=tiktok&utm_medium=organic_social&utm_campaign=dust_launch');assert.equal(context.content.firstSongViewed,'dust-on-my-boots');assert.equal(context.content.lastArtistViewed,'dalton-creed');
});

test('analytics consent withdrawal removes optional identifiers and attribution',()=>{const runtime=attributionRuntime('https://www.aureonmusicgroup.com/');runtime.api.setAnalyticsConsent(true);runtime.api.initialiseAttribution();assert.ok(runtime.api.getAnalyticsContext().visitorId);runtime.api.setAnalyticsConsent(false);assert.equal(runtime.api.getAnalyticsContext(),null);assert.equal(runtime.localStorage.getItem('aureon-analytics-visitor'),null)});

test('analytics consent is restored from a one-year first-party cookie',()=>{const runtime=attributionRuntime('https://www.aureonmusicgroup.com/account');runtime.api.setAnalyticsConsent(true);assert.match(runtime.context.document.cookie,/aureon_analytics_consent=granted/);assert.match(runtime.context.document.cookie,/Max-Age=31536000/);runtime.localStorage.removeItem(runtime.api.ANALYTICS_CONSENT_KEY);assert.equal(runtime.api.getAnalyticsConsentChoice(),'granted');assert.equal(runtime.localStorage.getItem(runtime.api.ANALYTICS_CONSENT_KEY),'granted')});

test('browser endpoint cannot accept trusted conversions or revenue',()=>{const model=read('lib/analytics-model.ts'),route=read('app/api/analytics/track/route.ts');assert.match(model,/CLIENT_ANALYTICS_EVENTS/);for(const event of ['registration_complete','subscription_complete','purchase_complete','purchase_checkout_start','subscription_checkout_start']){const clientSection=model.split('TRUSTED_ANALYTICS_EVENTS')[0];assert.equal(clientSection.includes(`'${event}'`),false)}assert.match(route,/new Set<string>\(CLIENT_ANALYTICS_EVENTS\)/);assert.doesNotMatch(route,/\.\.\.body/);assert.doesNotMatch(route,/revenueCents/)});

test('paid conversions are server-authoritative and deduplicated',()=>{const purchase=read('app/api/stripe/webhook/route.ts'),subscriptions=read('app/api/stripe/subscriptions/route.ts'),analytics=read('lib/analytics-server.ts'),checkout=read('app/api/checkout/route.ts'),subscriptionCheckout=read('app/api/subscriptions/checkout/route.ts');assert.match(purchase,/payment_status!=='paid'/);assert.match(purchase,/eventType:'purchase_complete'/);assert.match(subscriptions,/eventType:'subscription_complete'/);assert.match(subscriptions,/session\.payment_status!=='unpaid'/);assert.match(analytics,/createHash\('sha256'\)/);assert.match(analytics,/transaction\.get\(eventRef\)/);assert.match(checkout,/checkout\.sessions\.create/);assert.match(checkout,/eventType:'purchase_checkout_start'/);assert.match(subscriptionCheckout,/checkout\.sessions\.create/);assert.match(subscriptionCheckout,/eventType:'subscription_checkout_start'/)});

test('preview analytics uses bounded milestones and never includes audio URLs',()=>{const player=read('components/LatestPlayButton.tsx');for(const event of ['music_preview_start','music_preview_progress','music_preview_complete'])assert.match(player,new RegExp(`eventType:'${event}'`));assert.match(player,/\[25,50,75\]/);assert.doesNotMatch(read('lib/track-analytics.ts'),/protectedUrl|previewUrl|audioUrl|\bsrc:/)});

test('GA4 is single, consent-gated and strips sensitive return parameters',()=>{const bridge=read('components/AnalyticsBridge.tsx'),layout=read('app/layout.tsx'),firebase=read('lib/firebase-client.ts');assert.match(bridge,/NEXT_PUBLIC_GA_MEASUREMENT_ID/);assert.match(bridge,/send_page_view:false/);assert.match(bridge,/process\.env\.NODE_ENV==='production'/);assert.match(bridge,/!gaEnabled\|\|!granted/);assert.doesNotMatch(bridge,/session_id/);assert.doesNotMatch(layout,/googletagmanager|gtag\('config'/);assert.doesNotMatch(firebase,/G-[A-Z0-9]+/)});

test('subscription analytics omits customer PII and failed revenue',()=>{const source=read('lib/subscription-sync.ts'),failed=source.match(/export async function markInvoicePaymentFailure[\s\S]*?export async function recordInvoicePaid/)?.[0]||'';assert.doesNotMatch(source,/metadata:\s*\{[^}]*email/);assert.match(failed,/revenueCents:0/);assert.doesNotMatch(read('lib/analytics-server.ts'),/api_secret[^\n]*metadata/)});
