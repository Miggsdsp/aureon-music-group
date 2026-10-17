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
 const cookieStore=new Map(),cookieAssignments=[];
 const document={referrer};
 Object.defineProperty(document,'cookie',{get:()=>Array.from(cookieStore,([key,value])=>`${key}=${value}`).join('; '),set:value=>{cookieAssignments.push(String(value));const pair=String(value).split(';',1)[0],separator=pair.indexOf('=');if(separator>0)cookieStore.set(pair.slice(0,separator).trim(),pair.slice(separator+1).trim())}});
 const context={module,exports:module.exports,require,URL,URLSearchParams,Date,console,process,crypto:{randomUUID:crypto.randomUUID},CustomEvent:class{},localStorage,sessionStorage,location,document,window};
 vm.runInNewContext(code,context,{filename:'lib/analytics-attribution.ts'});
 return{api:module.exports,localStorage,sessionStorage,location,context,cookieAssignments};
}

function analyticsServerRuntime(){
 const code=ts.transpileModule(read('lib/analytics-server.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 const dependencies={'firebase-admin/firestore':{FieldValue:{serverTimestamp(){},increment(){}}},'@/lib/firebase-admin':{adminFirestore:{}},'@/lib/analytics-model':{ANALYTICS_EVENTS:[],TRUSTED_ANALYTICS_EVENTS:[]}};
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>id==='crypto'?crypto:dependencies[id],console,Date,process,fetch});
 return module.exports;
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
 const ads=attributionRuntime('https://www.aureonmusicgroup.com/?gclid=click-token-123&utm_source=google&utm_medium=cpc');ads.localStorage.setItem(ads.api.ANALYTICS_CONSENT_KEY,'granted');ads.api.initialiseAttribution();ads.context.location=new URL('https://www.aureonmusicgroup.com/account?mode=signup');assert.equal(ads.api.getAnalyticsContext().firstTouch.googleClickId,'click-token-123');assert.equal(ads.api.getAnalyticsContext().firstTouch.googleClickIdType,'gclid');
});

test('analytics consent withdrawal removes optional identifiers and attribution',()=>{const runtime=attributionRuntime('https://www.aureonmusicgroup.com/');const calls=[];runtime.context.window.gtag=(...args)=>calls.push(args);runtime.api.setAnalyticsConsent(true);runtime.api.initialiseAttribution();assert.ok(runtime.api.getAnalyticsContext().visitorId);runtime.api.setAnalyticsConsent(false);assert.equal(runtime.api.getAnalyticsContext(),null);assert.equal(runtime.localStorage.getItem('aureon-analytics-visitor'),null);assert.equal(JSON.stringify(calls.at(-1)),JSON.stringify(['consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'}]))});

test('analytics consent is restored from a one-year first-party cookie',()=>{const runtime=attributionRuntime('https://www.aureonmusicgroup.com/account');runtime.api.setAnalyticsConsent(true);assert.match(runtime.context.document.cookie,/aureon_analytics_consent=granted/);assert.match(runtime.cookieAssignments.at(-1),/Max-Age=31536000/);runtime.localStorage.removeItem(runtime.api.ANALYTICS_CONSENT_KEY);assert.equal(runtime.api.getAnalyticsConsentChoice(),'granted');assert.equal(runtime.localStorage.getItem(runtime.api.ANALYTICS_CONSENT_KEY),'granted')});

test('internal visitor/session IDs stay separate from GA4 IDs through Stripe attribution',()=>{
 const browser=attributionRuntime('https://www.aureonmusicgroup.com/membership?utm_source=google&utm_medium=cpc');
 browser.api.setAnalyticsConsent(true);browser.context.document.cookie='_ga=GA1.1.123456.789012';browser.context.document.cookie='_ga_TN4LEXL6CB=GS2.1.s987654321$o1$g0$t1792220000$j10$l0$h0';browser.api.initialiseAttribution();
 const checkout=browser.api.analyticsCheckoutContext();assert.ok(checkout.visitorId);assert.ok(checkout.sessionId);assert.equal(checkout.analyticsClientId,'123456.789012');assert.equal(checkout.analyticsSessionId,'987654321');
 const analytics=analyticsServerRuntime();
 const context=analytics.analyticsContextFromBody({...checkout,firstTouch:{source:'google',medium:'cpc'}});
 assert.ok(context.visitorId);assert.ok(context.sessionId);assert.equal(context.ga4ClientId,'123456.789012');assert.equal(context.ga4SessionId,'987654321');
 const restored=analytics.analyticsContextFromStripe(analytics.stripeAnalyticsMetadata(context));
 assert.equal(restored.visitorId,context.visitorId);assert.equal(restored.sessionId,context.sessionId);assert.equal(restored.ga4ClientId,'123456.789012');assert.equal(restored.ga4SessionId,'987654321');
 const legacy=analytics.analyticsContextFromStripe({analyticsConsent:'true',analyticsClientId:'123456.789012',analyticsSessionId:'987654321'});
 assert.equal(legacy.ga4ClientId,'123456.789012');assert.equal(legacy.ga4SessionId,'987654321');assert.equal(legacy.visitorId,'');
});

test('browser endpoint cannot accept trusted conversions or revenue',()=>{const model=read('lib/analytics-model.ts'),route=read('app/api/analytics/track/route.ts');assert.match(model,/CLIENT_ANALYTICS_EVENTS/);for(const event of ['registration_complete','subscription_complete','purchase_complete','purchase_checkout_start','subscription_checkout_start']){const clientSection=model.split('TRUSTED_ANALYTICS_EVENTS')[0];assert.equal(clientSection.includes(`'${event}'`),false)}assert.match(route,/new Set<string>\(CLIENT_ANALYTICS_EVENTS\)/);assert.doesNotMatch(route,/\.\.\.body/);assert.doesNotMatch(route,/revenueCents/)});

test('paid conversions are server-authoritative and deduplicated',()=>{const purchase=read('app/api/stripe/webhook/route.ts'),subscriptions=read('app/api/stripe/subscriptions/route.ts'),analytics=read('lib/analytics-server.ts'),checkout=read('app/api/checkout/route.ts'),subscriptionCheckout=read('app/api/subscriptions/checkout/route.ts');assert.match(purchase,/payment_status!=='paid'/);assert.match(purchase,/eventType:'purchase_complete'/);assert.match(subscriptions,/eventType:'subscription_complete'/);assert.match(subscriptions,/event\.livemode===true&&session\.payment_status==='paid'/);assert.match(subscriptions,/Number\(session\.amount_total\|\|0\)>0/);assert.match(subscriptions,/subscription\.status==='active'/);assert.match(analytics,/createHash\('sha256'\)/);assert.match(analytics,/transaction\.get\(eventRef\)/);assert.match(checkout,/checkout\.sessions\.create/);assert.match(checkout,/eventType:'purchase_checkout_start'/);assert.match(subscriptionCheckout,/checkout\.sessions\.create/);assert.match(subscriptionCheckout,/eventType:'subscription_checkout_start'/)});

test('successful paid subscription is recorded once even when GA4 consent delivery is skipped',()=>{
 const subscriptions=read('app/api/stripe/subscriptions/route.ts'),analytics=read('lib/analytics-server.ts');
 const completedBlock=subscriptions.match(/case 'checkout\.session\.completed': \{[\s\S]*?case 'customer\.subscription\.created'/)?.[0]||'';
 assert.match(completedBlock,/event\.livemode===true&&session\.payment_status==='paid'/);
 assert.match(completedBlock,/recordTrustedAnalyticsEvent\(\{\.\.\.context,eventType:'subscription_complete'/);
 assert.doesNotMatch(completedBlock,/if\(context\.analyticsConsent\)await recordTrustedAnalyticsEvent\(\{\.\.\.context,eventType:'subscription_complete'/);
 assert.match(completedBlock,/subscription\.id\)/);
 assert.match(analytics,/if\(!result\.created\)\{trustedLog\('duplicate_suppressed'/);
 assert.match(analytics,/skipped_no_consent/);
 assert.match(analytics,/skipped_no_client_id/);
 assert.match(analytics,/not_configured/);
 assert.match(analytics,/ga4_delivery_result/);
 assert.doesNotMatch(analytics,/console\.(?:info|warn|error)\([^)]*apiSecret/);
});

test('monthly renewal does not create acquisition subscription_complete conversion',()=>{
 const subscriptions=read('app/api/stripe/subscriptions/route.ts');
 const invoicePaidBlock=subscriptions.match(/case 'invoice\.paid': \{[\s\S]*?break;\s*\}/)?.[0]||'';
 assert.match(invoicePaidBlock,/billing_reason/);
 assert.doesNotMatch(invoicePaidBlock,/subscription_complete/);
});

test('paid plan upgrades are tracked separately from new subscription acquisition',()=>{
 const model=read('lib/analytics-model.ts'),checkout=read('app/api/subscriptions/checkout/route.ts');
 assert.match(model,/'membership_upgraded'/);
 const upgrade=checkout.match(/if \(isUpgrade\) \{[\s\S]*?Creator upgrade analytics failed:[\s\S]*?\)\);/)?.[0]||'';
 assert.match(upgrade,/eventType:'membership_upgraded'/);
 assert.doesNotMatch(upgrade,/eventType:'subscription_complete'/);
});

test('manual subscription conversion repair is admin-only and read-only against Stripe billing',()=>{
 const route=read('app/api/admin/analytics/repair-subscription-conversion/route.ts'),analytics=read('lib/analytics-server.ts');
 assert.match(route,/requireAdminApi\(request\)/);
 assert.match(route,/stripe\.events\.retrieve\(stripeEventId\)/);
 assert.match(route,/event\.type !== 'checkout\.session\.completed'/);
 assert.match(route,/checkoutSession\.mode !== 'subscription'/);
 assert.match(route,/checkoutSession\.payment_status !== 'paid'/);
 assert.match(route,/Number\(checkoutSession\.amount_total \|\| 0\) <= 0/);
 assert.match(route,/subscription\.status !== 'active'/);
 assert.match(route,/repairTrustedAnalyticsDelivery\(analyticsInput, subscription\.id\)/);
 assert.doesNotMatch(route,/syncStripeSubscription|checkout\.sessions\.create|subscriptions\.create|invoices\.create|sendSubscriptionLifecycleEmail/);
 assert.match(analytics,/repairTrustedAnalyticsDelivery/);
 assert.match(analytics,/current\.ga4Status==='sent'/);
 assert.match(analytics,/duplicate_suppressed/);
});

test('preview analytics uses bounded milestones and never includes audio URLs',()=>{const player=read('components/LatestPlayButton.tsx');for(const event of ['music_preview_start','music_preview_progress','music_preview_complete'])assert.match(player,new RegExp(`eventType:'${event}'`));assert.match(player,/\[25,50,75\]/);assert.doesNotMatch(read('lib/track-analytics.ts'),/protectedUrl|previewUrl|audioUrl|\bsrc:/)});

test('public preview media session sends artwork and track controls to external displays',()=>{
 const player=read('components/LatestPlayButton.tsx');
 const metadata=read('lib/media-session-metadata.ts');
 assert.match(metadata,/new MediaMetadata/);
 assert.match(metadata,/sizes: '512x512', type: 'image\/jpeg'/);
 assert.match(metadata,/\/api\/media\/artwork\?format=jpeg/);
 assert.match(player,/publishMediaMetadata/);
 assert.match(player,/setHandler\('previoustrack'/);
 assert.match(player,/setHandler\('nexttrack'/);
 assert.match(player,/setHandler\('seekbackward',null\)/);
 assert.match(player,/setHandler\('seekforward',null\)/);
 assert.match(player,/getSharedPreviewAudio/);
 assert.match(player,/sharedPreviewAudio = new Audio\(\)/);
 assert.match(player,/document\.body\.appendChild\(sharedPreviewAudio\)/);
 assert.match(player,/prepareSharedPreviewAudio\(audio\);/);
 assert.doesNotMatch(player,/requestMetadata|onPointerEnter=|onFocus=|onTouchStart=/);
 assert.match(player,/updateMediaSession\('playing'\);\s*await audio\.play\(\)/);
 assert.match(player,/audio\.title =/);
 assert.match(player,/data-aureon-current-title/);
 assert.match(player,/data-aureon-current-artist/);
 assert.match(player,/data-aureon-current-artwork/);
 assert.match(player,/webkit-playsinline/);
 assert.match(player,/x-webkit-airplay/);
 assert.match(player,/data-aureon-preview-button="true"/);
 assert.match(player,/data-aureon-preview-audio', 'true'/);
 assert.doesNotMatch(player,/<audio[^>]*data-aureon-preview-audio/);
 assert.match(player,/audio\.onplay=\(\)=>\{if\(activePreviewOwner===ownerRef\.current\)\{setIsPlaying\(true\);updateMediaSession\('playing'\)\}\}/);
 const bridge=read('components/music/BackgroundPlaybackBridge.tsx');
 const provider=read('components/music/MusicPlayerProvider.tsx');
 assert.match(bridge,/audio\[data-aureon-member-audio="true"\]/);
 assert.match(provider,/data-aureon-member-audio="true"/);
 assert.match(provider,/useEffect\(\(\) => \{\s*if \(currentSong\) \{\s*updateNativeMetadata\(currentSong, audioRef\.current, isPlaying \? 'playing' : 'paused'\)/);
 assert.match(provider,/onPlaying=\{event => \{\s*const song = queueRef\.current\[indexRef\.current\]/);
});

test('GA4 is single, consent-gated and strips sensitive return parameters',()=>{const bridge=read('components/AnalyticsBridge.tsx'),layout=read('app/layout.tsx'),firebase=read('lib/firebase-client.ts');assert.match(bridge,/NEXT_PUBLIC_GA_MEASUREMENT_ID/);assert.match(bridge,/NEXT_PUBLIC_GOOGLE_ADS_ID/);assert.match(bridge,/send_page_view:false/);assert.match(bridge,/process\.env\.NODE_ENV==='production'/);assert.match(bridge,/if\(!granted\)/);assert.match(bridge,/ad_storage:'denied'/);assert.match(bridge,/ad_user_data:'granted'/);assert.match(bridge,/ad_personalization:'denied'/);assert.match(bridge,/page_view/);assert.match(bridge,/dataLayer\?\.push\(arguments\)/);assert.doesNotMatch(layout,/googletagmanager|gtag\('config'/);assert.doesNotMatch(firebase,/G-[A-Z0-9]+/)});
test('GA4 trusted conversions use only the consented GA4 client and session IDs',()=>{const analytics=read('lib/analytics-server.ts');assert.match(analytics,/engagement_time_msec:1/);assert.match(analytics,/if\(\/\^\\d\+\$\/\.test\(clean\(event\.ga4SessionId,30\)\)\)params\.session_id=Number\(event\.ga4SessionId\)/);assert.match(analytics,/client_id:event\.ga4ClientId,events:\[\{name:event\.eventType,params\}\]/);assert.match(analytics,/if\(!event\.ga4ClientId\)/)});
test('Google Ads click IDs persist to checkout only with consent',()=>{const attribution=read('lib/analytics-attribution.ts'),analytics=read('lib/analytics-server.ts');assert.match(attribution,/\['gclid','gbraid','wbraid'\]/);assert.match(analytics,/if\(body\?\.analyticsConsent!==true\)return\{analyticsConsent:false\}/);assert.match(analytics,/googleClickId:clean\(first\.googleClickId,200\)/);assert.match(analytics,/googleClickId:clean\(context\.googleClickId,200\)/);assert.match(analytics,/if\(m\.analyticsConsent!=='true'\)return\{analyticsConsent:false\}/)});
test('GA4 page views wait for Google tag readiness after consent',()=>{const bridge=read('components/AnalyticsBridge.tsx');assert.match(bridge,/gaReady/);assert.match(bridge,/document\.createElement\('script'\)/);assert.match(bridge,/addEventListener\('load'/);assert.match(bridge,/dataset\.loaded/);assert.match(bridge,/!granted\|\|!gaReady\|\|!pathname/);assert.match(bridge,/aureon-ga4/);});
test('public preview playback uses bounded API route when a private master exists',()=>{const ts=require('typescript'),vm=require('node:vm');const code=ts.transpileModule(read('lib/get-preview-url.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require},{filename:'lib/get-preview-url.ts'});assert.equal(module.exports.getPreviewUrl({id:'song-1',privateFilePath:'private/full-tracks/artist/song.wav',previewUrl:'https://storage.googleapis.com/legacy-short.wav'}),'/api/preview/song-1');assert.equal(module.exports.getPreviewUrl({id:'song-2',details:{privateFilePath:'private/full-tracks/artist/song two.wav'}}),'/api/preview/song-2');assert.equal(module.exports.getPreviewUrl({id:'song-3',previewUrl:'https://example.com/public-preview.wav'}),'https://example.com/public-preview.wav')});

test('Search Console verification is environment driven and homepage has an initial H1',()=>{const layout=read('app/layout.tsx'),hero=read('components/CinematicHero.tsx');assert.match(layout,/process\.env\.GOOGLE_SITE_VERIFICATION\?\.trim\(\)/);assert.match(layout,/verification:\{google:googleSiteVerification\}/);assert.doesNotMatch(layout,/google-site-verification/);assert.match(hero,/<h1 className="sr-only">Aureon Music Group music discovery platform<\/h1>/)});

test('creator funnel events are present with non-PII parameters',()=>{const page=read('components/CreatorLicensingPage.tsx'),cta=read('components/CreatorLicensingCta.tsx');assert.match(page,/eventType: 'creator_landing_view'/);assert.match(page,/entityType: 'creator_licensing_page'/);assert.match(page,/metadata: \{ useCase: page\.useCase \}/);assert.match(cta,/eventType: 'creator_cta_click'/);assert.match(cta,/metadata: \{ cta, destination: href \}/);assert.doesNotMatch(`${page}\n${cta}`,/email|phone|customerName|firebaseUid|payment/i)});

test('subscription analytics omits customer PII and failed revenue',()=>{const source=read('lib/subscription-sync.ts'),failed=source.match(/export async function markInvoicePaymentFailure[\s\S]*?export async function recordInvoicePaid/)?.[0]||'';assert.doesNotMatch(source,/metadata:\s*\{[^}]*email/);assert.match(failed,/revenueCents:0/);assert.doesNotMatch(read('lib/analytics-server.ts'),/api_secret[^\n]*metadata/)});
