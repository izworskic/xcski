import { readFileSync } from 'node:fs';

const fail = message => { throw new Error(message); };
const html = readFileSync('dist/midwest/index.html','utf8');
const runtime = readFileSync('dist/midwest-xc.js','utf8');
const css = readFileSync('dist/midwest-xc.css','utf8');
const intel = readFileSync('dist/xc-intelligence.js','utf8');
const robots = readFileSync('dist/robots.txt','utf8');
const sitemap = readFileSync('dist/midwest/sitemap.xml','utf8');
const mi = readFileSync('dist/index.html','utf8');
const wi = readFileSync('dist/wisconsin/index.html','utf8');
const mn = readFileSync('dist/minnesota/index.html','utf8');

if (!html.includes('<h1>Midwest XC Ski Conditions Today</h1>')) fail('Midwest H1 missing');
if (!html.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/midwest/">')) fail('Midwest canonical missing');
if (!html.includes('172 Michigan, Wisconsin and Minnesota Nordic systems')) fail('Midwest 172-system promise missing');
if (!html.includes('same local hour yesterday')) fail('day-over-day explanation missing');
for (const state of ['Michigan','Wisconsin','Minnesota']) if (!html.includes(state)) fail(`state missing from Midwest hub: ${state}`);
if (!html.includes('data-midwest-mode="improvers"')) fail('biggest improvers mode missing');
if (!html.includes('data-midwest-mode="fresh"')) fail('fresh snow mode missing');
if (!html.includes('data-midwest-mode="lighted"')) fail('lighted mode missing');
if (!html.includes('data-midwest-mode="skate"')) fail('skate mode missing');
if (!html.includes('/xc-intelligence.js') || !html.includes('/midwest-xc.js')) fail('Midwest runtime dependencies missing');
if (!runtime.includes('XC_INTEL.compareYesterday')) fail('Midwest runtime not using yesterday comparison');
if (!runtime.includes('i += 40')) fail('Midwest weather requests are not chunked');
if (!runtime.includes('/api/xc-live?state=')) fail('Midwest provider layer missing');
if (!runtime.includes("live.openState === 'closed'")) fail('official closed suppression missing from Midwest board');
if (!intel.includes('function compareYesterday')) fail('shared yesterday comparison missing');
if (!intel.includes('currentIndex - 24')) fail('same-hour prior-day reconstruction missing');
if (!intel.includes('timezone = "America/Detroit"')) fail('timezone-aware forecast function missing');
if (!css.includes('.midwest-state-summary') || !css.includes('.delta-up')) fail('Midwest visual system incomplete');
if ((sitemap.match(/<loc>/g) || []).length !== 1 || !sitemap.includes('https://xcski.chrisizworski.com/midwest/')) fail('Midwest sitemap malformed');
if (!robots.includes('Sitemap: https://xcski.chrisizworski.com/midwest/sitemap.xml')) fail('Midwest sitemap not advertised');
if (!mi.includes('href="/midwest/"')) fail('Michigan does not link to Midwest hub');
if (!wi.includes('href="/midwest/"')) fail('Wisconsin does not link to Midwest hub');
if (!mn.includes('href="/midwest/"')) fail('Minnesota does not link to Midwest hub');
if (/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition/i.test(runtime + intel)) fail('unexpected browser-state or location collection in Midwest/change engine');
try { new Function(runtime); new Function(intel); } catch (error) { fail(`Midwest/change JavaScript invalid: ${error.message}`); }
console.log('Midwest XC readiness: PASS — 172-system hub, state-local yesterday comparison, chunked weather, live-provider separation and cross-state discovery links.');