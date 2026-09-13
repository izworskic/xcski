import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const html = readFileSync('dist/index.html', 'utf8');
const llms = readFileSync('dist/llms.txt', 'utf8');
const robots = readFileSync('dist/robots.txt', 'utf8');
const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
const boardJs = readFileSync('dist/decision-board.js', 'utf8');
const boardCss = readFileSync('dist/decision-board.css', 'utf8');
const trailJs = readFileSync('dist/trail-page.js', 'utf8');
const trailCss = readFileSync('dist/trail-page.css', 'utf8');
const fail = (m) => { throw new Error(m); };

if (!html.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/">')) fail('canonical owner changed');
if (!html.includes('<h1>Northern Michigan<br>Cross Country Ski Trails</h1>')) fail('H1 owner changed');
if (!html.includes('<link rel="author" href="https://chrisizworski.com/chris-izworski/">')) fail('canonical creator profile link missing');
if (!html.includes('"@id":"https://chrisizworski.com/#person"')) fail('canonical Person ID missing');
if (html.includes('https://xcski.chrisizworski.com/#person')) fail('local duplicate Person ID detected');

if ((html.match(/class="card"/g) || []).length !== 48) fail('expected 48 trail cards');
if ((html.match(/>Verify trail status<\/a>/g) || []).length !== 48) fail('every trail must retain an operator/land-manager verification path');
if (!html.includes('Live snow is a screening signal.')) fail('visible trust boundary missing');
if (!html.includes('ET via Open-Meteo')) fail('live signal freshness timestamp missing');
if (!html.includes('role="region" aria-label="Map of northern Michigan cross country ski trail systems"')) fail('map accessibility role missing');
if (!html.includes('Compare flagship Michigan XC trails and planning sources')) fail('main-domain planning handoff missing');
if (!html.includes('https://tile.openstreetmap.org/{z}/{x}/{y}.png')) fail('no-key OpenStreetMap basemap missing');
if (/basemaps\.cartocdn\.com|api\.mapbox\.com|api\.maptiler\.com|tiles\.stadiamaps\.com/i.test(html)) fail('keyed or provider-specific basemap dependency detected');

if (!html.includes('id="ski-board"')) fail('Michigan Nordic Board missing');
if (!html.includes('Where does the snow look best?')) fail('decision-first board headline missing');
if (!html.includes('modeled natural-snow signal')) fail('board trust language missing');
if (!html.includes('/decision-board.css')) fail('decision board stylesheet missing from page');
if (!html.includes('/decision-board.js')) fail('decision board runtime missing from page');
if (!boardJs.includes('scoreSignal')) fail('snow signal scoring engine missing');
if (!boardJs.includes('past_days=3&forecast_days=3')) fail('72-hour/forecast weather window missing');
if (!boardJs.includes('rainToday')) fail('rain risk not included in score');
if (!boardJs.includes('minToday < 31 && row.maxToday > 35')) fail('freeze/thaw risk not included');
if (!boardJs.includes('Preseason mode')) fail('off-season decision state missing');
if (!boardJs.includes('Verify official status')) fail('operator verification handoff missing from board');
if (!boardCss.includes('.ski-pick')) fail('decision board styles missing');

const trailDirs = readdirSync('dist/trails', { withFileTypes: true }).filter(entry => entry.isDirectory());
if (trailDirs.length !== 48) fail(`expected 48 generated trail pages, found ${trailDirs.length}`);
for (const entry of trailDirs) {
  const trailHtml = readFileSync(path.join('dist', 'trails', entry.name, 'index.html'), 'utf8');
  const canonical = `https://xcski.chrisizworski.com/trails/${entry.name}/`;
  if (!trailHtml.includes(`<link rel="canonical" href="${canonical}">`)) fail(`trail canonical missing for ${entry.name}`);
  if (!trailHtml.includes('id="trail-live"')) fail(`live trail signal missing for ${entry.name}`);
  if (!trailHtml.includes('Verify official trail status')) fail(`official trail handoff missing for ${entry.name}`);
  if (!trailHtml.includes('/trail-page.js')) fail(`trail runtime missing for ${entry.name}`);
  if ((trailHtml.match(/class="trail-related"/g) || []).length !== 1) fail(`nearby-trail links missing for ${entry.name}`);
}
if (!trailJs.includes('scoreSignal')) fail('trail-page snow scoring missing');
if (!trailJs.includes('Preseason mode')) fail('trail-page off-season state missing');
if (!trailCss.includes('.trail-live-metrics')) fail('trail page styles missing');
const trailSitemapUrls = (sitemap.match(/<loc>https:\/\/xcski\.chrisizworski\.com\/trails\//g) || []).length;
if (trailSitemapUrls !== 48) fail(`expected 48 trail URLs in sitemap, found ${trailSitemapUrls}`);

for (const phrase of ['Groomed systems ski', 'Most systems skiing well', 'Everything skis, backcountry included', 'No base. Nothing to ski yet.', 'plain language skiability read']) {
  if ((html + llms + boardJs + trailJs).toLowerCase().includes(phrase.toLowerCase())) fail(`unsupported model-derived skiability claim remains: ${phrase}`);
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
  new Function(boardJs);
  new Function(trailJs);
} catch (error) {
  fail('generated JavaScript invalid: ' + error.message);
}

if (/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition|fingerprint/i.test(html + boardJs + trailJs)) fail('unexpected personal/browser-state collection detected');

console.log('XC 2026-27 readiness: PASS — 48 trail cards, Nordic Board, 48 indexable trail pages, expanded sitemap, and verification handoffs preserved.');
