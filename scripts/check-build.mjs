import { readFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const llms = readFileSync('dist/llms.txt', 'utf8');
const robots = readFileSync('dist/robots.txt', 'utf8');
const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const fail = (m) => { throw new Error(m); };

if (!html.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/">')) fail('canonical owner changed');
if (!html.includes('<h1>Northern Michigan<br>Cross Country Ski Trails</h1>')) fail('H1 owner changed');
if ((html.match(/class="card"/g) || []).length !== 48) fail('expected 48 trail cards');
if ((html.match(/>Verify trail status<\/a>/g) || []).length !== 48) fail('every trail must retain an operator/land-manager verification path');
if (!html.includes('Live snow is a screening signal.')) fail('visible trust boundary missing');
if (!html.includes('ET via Open-Meteo')) fail('live signal freshness timestamp missing');
if (!html.includes('role="region" aria-label="Map of northern Michigan cross country ski trail systems"')) fail('map accessibility role missing');
if (!html.includes('Compare flagship Michigan XC trails and planning sources')) fail('main-domain planning handoff missing');
if (!html.includes('https://tile.openstreetmap.org/{z}/{x}/{y}.png')) fail('no-key OpenStreetMap basemap missing');
if (/basemaps\.cartocdn\.com|api\.mapbox\.com|api\.maptiler\.com|tiles\.stadiamaps\.com/i.test(html)) fail('keyed or provider-specific basemap dependency detected');
for (const phrase of ['Groomed systems ski', 'Most systems skiing well', 'Everything skis, backcountry included', 'No base. Nothing to ski yet.', 'plain language skiability read']) {
  if ((html + llms).toLowerCase().includes(phrase.toLowerCase())) fail(`unsupported model-derived skiability claim remains: ${phrase}`);
}
if (!robots.includes('Sitemap: https://xcski.chrisizworski.com/sitemap.xml')) fail('robots sitemap owner changed');
if (!sitemap.includes('<loc>https://xcski.chrisizworski.com/</loc>')) fail('sitemap owner changed');
const runtimeMarker = 'const TRAILS = [';
const runtimeMarkerIndex = html.indexOf(runtimeMarker);
const runtimeStart = html.lastIndexOf('<script>', runtimeMarkerIndex);
const runtimeEnd = html.indexOf('</script>', runtimeMarkerIndex);
if (runtimeMarkerIndex < 0 || runtimeStart < 0 || runtimeEnd < 0) fail('generated XC runtime script missing');
const runtimeJs = html.slice(runtimeStart + '<script>'.length, runtimeEnd);
try {
  new Function(runtimeJs);
} catch (error) {
  fail('generated inline JavaScript invalid: ' + error.message);
}
if (/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition|fingerprint/i.test(html)) fail('unexpected personal/browser-state collection detected');
console.log('XC 2026-27 readiness: PASS — 48 trails, canonical intact, trust boundary explicit, verification handoff preserved.');
