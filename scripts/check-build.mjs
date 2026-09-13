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
const intelJs = readFileSync('dist/xc-intelligence.js', 'utf8');
const regionJs = readFileSync('dist/region-page.js', 'utf8');
const regionCss = readFileSync('dist/region-page.css', 'utf8');
const groomingRegistry = JSON.parse(readFileSync('dist/grooming-sources.json', 'utf8'));
const fail = m => { throw new Error(m); };

if (!html.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/">')) fail('canonical owner changed');
if (!html.includes('<h1>Northern Michigan<br>Cross Country Ski Trails</h1>')) fail('H1 owner changed');
if (!html.includes('<link rel="author" href="https://chrisizworski.com/chris-izworski/">')) fail('canonical creator profile link missing');
if (!html.includes('"@id":"https://chrisizworski.com/#person"')) fail('canonical Person ID missing');
if (html.includes('https://xcski.chrisizworski.com/#person')) fail('local duplicate Person ID detected');
if ((html.match(/class="card"/g) || []).length !== 48) fail('expected 48 trail cards');
if ((html.match(/>Verify trail status<\/a>/g) || []).length !== 48) fail('every trail must retain operator/land-manager verification');
if (!html.includes('Live snow is a screening signal.')) fail('visible trust boundary missing');
if (!html.includes('ET via Open-Meteo')) fail('legacy live signal freshness marker missing');
if (!html.includes('role="region" aria-label="Map of northern Michigan cross country ski trail systems"')) fail('map accessibility role missing');
if (!html.includes('https://tile.openstreetmap.org/{z}/{x}/{y}.png')) fail('OpenStreetMap basemap missing');

if (!html.includes('id="ski-board"')) fail('Michigan Nordic Board missing');
if (!html.includes('Where should I ski, and when?')) fail('decision-first board headline missing');
if (!html.includes('four independent layers')) fail('engine-layer explanation missing');
for (const filter of ['classic','skate','rentals','lighted','backcountry']) {
  if (!html.includes(`data-board-filter="${filter}"`)) fail(`best-by-use filter missing: ${filter}`);
}
for (const slug of ['grayling-roscommon','gaylord-pigeon-river','traverse-leelanau-antrim','cadillac-benzie-manistee','petoskey-harbor-springs-boyne','northeast-lower','straits-eastern-up']) {
  if (!html.includes(`/regions/${slug}/`)) fail(`regional board link missing: ${slug}`);
}
if (!html.includes('/xc-intelligence.js')) fail('shared intelligence runtime missing from homepage');
if (!boardJs.includes('XC_INTEL.analyzeWeather')) fail('homepage not using shared intelligence engine');
if (!boardJs.includes('surface.label')) fail('surface state missing from board');
if (!boardJs.includes('bestWindow.label')) fail('time-of-day window missing from board');
if (!boardJs.includes('confidence.label')) fail('source confidence missing from board');
if (!boardCss.includes('.ski-decision-strip')) fail('decision strip styles missing');
if (!boardCss.includes('.ski-region-links')) fail('regional navigation styles missing');

if (!intelJs.includes('function surfaceState')) fail('surface-state engine missing');
if (!intelJs.includes('function bestWindow')) fail('best-window engine missing');
if (!intelJs.includes('row.freezeThaw')) fail('freeze/thaw engine missing');
if (!intelJs.includes('rain24')) fail('24-hour rain intelligence missing');
if (!intelJs.includes('snow24')) fail('24-hour snowfall intelligence missing');
if (!intelJs.includes('wind_speed_10m')) fail('wind input missing from hourly engine');
if (!intelJs.includes('function confidence')) fail('source-confidence engine missing');
if (!intelJs.includes('authorized-api')) fail('authorized live-feed upgrade path missing');

if (!groomingRegistry || groomingRegistry.version !== 2 || !groomingRegistry.sources) fail('audited source registry malformed');
if (Object.keys(groomingRegistry.sources).length !== 48) fail(`expected 48 audited sources, found ${Object.keys(groomingRegistry.sources).length}`);
if (!String(groomingRegistry.policy || '').includes('Weather/snow scores are independent')) fail('source-independence policy missing');
for (const [id, source] of Object.entries(groomingRegistry.sources)) {
  if (!source.audited) fail(`source audit date missing: ${id}`);
  if (!source.sourceClass && !source.kind) fail(`source classification missing: ${id}`);
  if (source.weatherScoreIndependent !== true) fail(`source/weather separation missing: ${id}`);
}
const forbushSource = groomingRegistry.sources.forbush;
if (!forbushSource || forbushSource.provider !== 'Nordic Pulse') fail('Forbush Nordic Pulse source missing');
if (forbushSource.integration !== 'link-only-until-authorized-api') fail('Forbush API authorization boundary missing');
if (!/^https:\/\/www\.nordic-pulse\.com\//.test(forbushSource.url || '')) fail('Forbush Nordic Pulse URL missing');

const trailDirs = readdirSync('dist/trails', { withFileTypes:true }).filter(entry => entry.isDirectory());
if (trailDirs.length !== 48) fail(`expected 48 generated trail pages, found ${trailDirs.length}`);
for (const entry of trailDirs) {
  const trailHtml = readFileSync(path.join('dist','trails',entry.name,'index.html'),'utf8');
  const canonical = `https://xcski.chrisizworski.com/trails/${entry.name}/`;
  if (!trailHtml.includes(`<link rel="canonical" href="${canonical}">`)) fail(`trail canonical missing: ${entry.name}`);
  if (!trailHtml.includes('id="trail-live"')) fail(`trail intelligence mount missing: ${entry.name}`);
  if (!trailHtml.includes('Grooming &amp; status sources')) fail(`source panel missing: ${entry.name}`);
  if (!trailHtml.includes('/xc-intelligence.js')) fail(`shared engine missing from trail page: ${entry.name}`);
  if (!trailHtml.includes('/trail-page.js')) fail(`trail runtime missing: ${entry.name}`);
  if ((trailHtml.match(/class="trail-related"/g) || []).length !== 1) fail(`nearby trail links missing: ${entry.name}`);
}
const forbushHtml = readFileSync(path.join('dist','trails','forbush','index.html'),'utf8');
if (!forbushHtml.includes('Nordic Pulse source linked')) fail('Forbush live-source badge missing');
if (!forbushHtml.includes('provider-authorized API access')) fail('Forbush authorization note missing');
if (!trailJs.includes('XC_INTEL.analyzeWeather')) fail('trail pages not using shared intelligence engine');
if (!trailJs.includes('Decision confidence')) fail('trail decision confidence missing');
if (!trailCss.includes('.trail-decision-grid')) fail('trail decision styles missing');

const regionSlugs = ['grayling-roscommon','gaylord-pigeon-river','traverse-leelanau-antrim','cadillac-benzie-manistee','petoskey-harbor-springs-boyne','northeast-lower','straits-eastern-up'];
const regionDirs = readdirSync('dist/regions', { withFileTypes:true }).filter(entry => entry.isDirectory());
if (regionDirs.length !== 7) fail(`expected 7 regional pages, found ${regionDirs.length}`);
for (const slug of regionSlugs) {
  const regionHtml = readFileSync(path.join('dist','regions',slug,'index.html'),'utf8');
  const canonical = `https://xcski.chrisizworski.com/regions/${slug}/`;
  if (!regionHtml.includes(`<link rel="canonical" href="${canonical}">`)) fail(`region canonical missing: ${slug}`);
  if (!regionHtml.includes('id="region-board"')) fail(`regional live board missing: ${slug}`);
  if (!regionHtml.includes('/xc-intelligence.js')) fail(`shared engine missing from region: ${slug}`);
  if (!regionHtml.includes('/region-page.js')) fail(`regional runtime missing: ${slug}`);
}
if (!regionJs.includes('XC_INTEL.analyzeWeather')) fail('regional pages not using shared engine');
if (!regionCss.includes('.region-decision')) fail('regional decision styles missing');

const trailSitemapUrls = (sitemap.match(/<loc>https:\/\/xcski\.chrisizworski\.com\/trails\//g) || []).length;
const regionSitemapUrls = (sitemap.match(/<loc>https:\/\/xcski\.chrisizworski\.com\/regions\//g) || []).length;
if (trailSitemapUrls !== 48) fail(`expected 48 trail URLs in sitemap, found ${trailSitemapUrls}`);
if (regionSitemapUrls !== 7) fail(`expected 7 region URLs in sitemap, found ${regionSitemapUrls}`);

for (const phrase of ['Groomed systems ski','Most systems skiing well','Everything skis, backcountry included','No base. Nothing to ski yet.','plain language skiability read']) {
  if ((html + llms + boardJs + trailJs + regionJs + intelJs).toLowerCase().includes(phrase.toLowerCase())) fail(`unsupported skiability claim remains: ${phrase}`);
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
  new Function(intelJs);
  new Function(boardJs);
  new Function(trailJs);
  new Function(regionJs);
} catch (error) {
  fail('generated JavaScript invalid: ' + error.message);
}

if (/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition|fingerprint/i.test(html + boardJs + trailJs + regionJs + intelJs)) fail('unexpected personal/browser-state collection detected');
console.log('XC 2026-27 readiness: PASS — 48 audited sources, shared surface/timing engine, best-by-use rankings, 48 trail pages, 7 regional boards, and 56 sitemap URLs.');
