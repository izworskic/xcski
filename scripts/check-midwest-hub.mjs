import { readFileSync } from 'node:fs';

const fail=message=>{throw new Error(message)};
const html=readFileSync('dist/midwest/index.html','utf8');
const runtime=readFileSync('dist/midwest-xc.js','utf8');
const css=readFileSync('dist/midwest-xc.css','utf8');
const intel=readFileSync('dist/xc-intelligence.js','utf8');
const robots=readFileSync('dist/robots.txt','utf8');
const sitemap=readFileSync('dist/midwest/sitemap.xml','utf8');
const mi=readFileSync('dist/index.html','utf8');
const wi=readFileSync('dist/wisconsin/index.html','utf8');
const mn=readFileSync('dist/minnesota/index.html','utf8');

if(!html.includes('<h1>Find your Midwest XC starting point</h1>')) fail('skier-first Midwest H1 missing');
if(!html.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/midwest/">')) fail('Midwest canonical missing');
if(!html.includes('This page is a doorway, not a 172-trail horse race.')) fail('Midwest routing purpose missing');
for(const persona of ['Local / day skier','Weekend traveler','Storm chaser','Reliability seeker']) if(!html.includes(persona)) fail(`persona path missing: ${persona}`);
for(const state of ['Michigan','Wisconsin','Minnesota']) if(!html.includes(state)) fail(`state missing: ${state}`);
for(const shortcut of ['Southeast Michigan','Birkie Country','Twin Cities','North Shore','Keweenaw']) if(!html.includes(shortcut)) fail(`regional shortcut missing: ${shortcut}`);
if(!html.includes('/midwest/weekend/')||!html.includes('/midwest/storm-watch/')) fail('valid cross-state decision paths missing');
if(html.includes('data-midwest-mode=')||runtime.includes('rowCard(')||runtime.includes('selectRows(')) fail('generic cross-state trail ranking remains on Midwest gateway');
for(const dep of ['/xc-intelligence.js','/xc-model-client.js','/midwest-xc.js']) if(!html.includes(dep)) fail(`Midwest dependency missing: ${dep}`);
if(!runtime.includes('XC_MODEL.state(state.slug)')) fail('Midwest not using cached state snapshots');
if(runtime.includes('fetchWeatherChunk')||runtime.includes('forecastQuery(lats')) fail('Midwest direct Open-Meteo batching remains');
if(!runtime.includes('/api/xc-live?state=')) fail('Midwest provider layer missing');
if(!runtime.includes("live.openState === 'closed'")) fail('official closed suppression missing');
if(!runtime.includes('Promise.allSettled(ctx.states.map(loadState))')) fail('graceful partial-state loading missing');
if(!runtime.includes("failedStates.join(', ')")) fail('partial-state disclosure missing');
if(!runtime.includes('renderStateCards')||!runtime.includes('renderRadar')||!runtime.includes('pulseFor')) fail('state-level routing/radar runtime missing');
if(!intel.includes('function compareYesterday')||!intel.includes('currentIndex - 24')) fail('shared day-over-day engine missing');
if(!css.includes('.midwest-state-grid')||!css.includes('.midwest-path-grid')||!css.includes('.midwest-radar-row')) fail('Midwest gateway visual system incomplete');
if((sitemap.match(/<loc>/g)||[]).length!==1||!sitemap.includes('https://xcski.chrisizworski.com/midwest/')) fail('Midwest sitemap malformed');
if(!robots.includes('Sitemap: https://xcski.chrisizworski.com/midwest/sitemap.xml')) fail('Midwest sitemap not advertised');
if(!mi.includes('href="/midwest/"')||!wi.includes('href="/midwest/"')||!mn.includes('href="/midwest/"')) fail('cross-state discovery links missing');
if(/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition/i.test(runtime+intel)) fail('unexpected browser-state collection');
try{new Function(runtime);new Function(intel)}catch(error){fail(`Midwest JavaScript invalid: ${error.message}`)}
console.log('Midwest XC readiness: PASS — skier-first gateway routes by state/destination, reserves cross-state comparison for weekend/storm use, and uses cached state-level radar with graceful degradation.');
