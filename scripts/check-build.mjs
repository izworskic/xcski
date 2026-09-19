import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const html = readFileSync('dist/index.html','utf8');
const llms = readFileSync('dist/llms.txt','utf8');
const robots = readFileSync('dist/robots.txt','utf8');
const sitemap = readFileSync('dist/sitemap.xml','utf8');
const boardJs = readFileSync('dist/decision-board.js','utf8');
const boardCss = readFileSync('dist/decision-board.css','utf8');
const trailJs = readFileSync('dist/trail-page.js','utf8');
const trailCss = readFileSync('dist/trail-page.css','utf8');
const intelJs = readFileSync('dist/xc-intelligence.js','utf8');
const regionJs = readFileSync('dist/region-page.js','utf8');
const regionCss = readFileSync('dist/region-page.css','utf8');
const groomingRegistry = JSON.parse(readFileSync('dist/grooming-sources.json','utf8'));
const fail = m => { throw new Error(m); };

if (!html.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/">')) fail('canonical owner changed');
if (!html.includes('<h1>Michigan<br>Cross Country Ski Trails</h1>')) fail('statewide H1 missing');
if (!html.includes('Statewide Michigan cross-country ski conditions for 61 trail systems')) fail('statewide meta description missing');
if (!html.includes('<link rel="author" href="https://chrisizworski.com/chris-izworski/">')) fail('canonical creator profile link missing');
if ((html.match(/class="card"/g)||[]).length !== 61) fail('expected 61 statewide trail cards');
if ((html.match(/>Verify trail status<\/a>/g)||[]).length !== 61) fail('every trail must retain status verification');
for (const id of ['huronmeadows','kensington','stonycreek','pigeoncreek','muskegonluge','valleyspur','noque','alqua','michigantech','swedetown','abr','wolverine','porkies']) if (!html.includes(`id="t-${id}"`)) fail(`statewide expansion missing: ${id}`);
if (!html.includes('role="region" aria-label="Map of Michigan cross country ski trail systems"')) fail('statewide map accessibility label missing');
if (!html.includes('setView([44.8, -85.7], 6)')) fail('statewide map extent missing');
if (!html.includes('>All 61</button>')) fail('statewide filter count missing');
if (!html.includes('https://tile.openstreetmap.org/{z}/{x}/{y}.png')) fail('OpenStreetMap basemap missing');

if (!html.includes('id="ski-board"') || !html.includes('Where should I ski, and when?')) fail('Michigan Nordic Board missing');
for (const filter of ['classic','skate','rentals','lighted','backcountry']) if (!html.includes(`data-board-filter="${filter}"`)) fail(`filter missing: ${filter}`);
for (const dep of ['/xc-intelligence.js','/xc-model-client.js']) if (!html.includes(dep)) fail(`homepage dependency missing: ${dep}`);
if (!boardJs.includes("XC_MODEL.state('michigan')")) fail('homepage not using cached Michigan model');
if (!boardJs.includes('TRAILS.length')) fail('homepage trail count is not runtime-driven');
for (const marker of ['surface.label','bestWindow.label','confidence.label','scoreDelta','weekend','storm']) if (!boardJs.includes(marker)) fail(`homepage decision marker missing: ${marker}`);
if (!boardCss.includes('.ski-decision-strip')) fail('decision strip styles missing');

for (const marker of ['function surfaceState','function bestWindow','function compareYesterday','row.freezeThaw','rain24','snow24','wind_speed_10m','function confidence']) if (!intelJs.includes(marker)) fail(`shared engine marker missing: ${marker}`);

if (!groomingRegistry || groomingRegistry.version !== 3 || !groomingRegistry.sources) fail('source registry malformed');
if (Object.keys(groomingRegistry.sources).length !== 61) fail('expected 61 audited Michigan sources');
for (const [id,source] of Object.entries(groomingRegistry.sources)) {
  if (!source.audited) fail(`source audit missing: ${id}`);
  if (!source.sourceClass && !source.kind) fail(`source class missing: ${id}`);
  if (source.weatherScoreIndependent !== true) fail(`source/model separation missing: ${id}`);
}
for (const id of ['forbush','noque','swedetown']) {
  const source=groomingRegistry.sources[id];
  if (!source || source.provider !== 'Nordic Pulse' || source.integration !== 'link-only-until-authorized-api') fail(`Nordic Pulse boundary missing: ${id}`);
}

const trailDirs=readdirSync('dist/trails',{withFileTypes:true}).filter(e=>e.isDirectory());
if (trailDirs.length !== 61) fail(`expected 61 trail pages, found ${trailDirs.length}`);
for (const entry of trailDirs) {
  const trailHtml=readFileSync(path.join('dist','trails',entry.name,'index.html'),'utf8');
  if (!trailHtml.includes(`<link rel="canonical" href="https://xcski.chrisizworski.com/trails/${entry.name}/">`)) fail(`trail canonical missing: ${entry.name}`);
  if (!trailHtml.includes('id="trail-live"') || !trailHtml.includes('Grooming &amp; status sources')) fail(`trail live/source layer missing: ${entry.name}`);
  if (!trailHtml.includes('/xc-model-client.js')) fail(`cached model client missing from trail: ${entry.name}`);
}
if (!trailJs.includes("XC_MODEL.state('michigan')")) fail('Michigan trail pages not using cached model');
if (!trailCss.includes('.trail-decision-grid')) fail('trail decision styles missing');

const regionSlugs=['southeast-michigan','west-michigan','grayling-roscommon','gaylord-pigeon-river','traverse-leelanau-antrim','cadillac-benzie-manistee','petoskey-harbor-springs-boyne','northeast-lower','straits-eastern-up','central-upper-peninsula','keweenaw-houghton-calumet','western-upper-peninsula'];
const regionDirs=readdirSync('dist/regions',{withFileTypes:true}).filter(e=>e.isDirectory());
if (regionDirs.length !== 12) fail(`expected 12 regional pages, found ${regionDirs.length}`);
for (const slug of regionSlugs) {
  const regionHtml=readFileSync(path.join('dist','regions',slug,'index.html'),'utf8');
  if (!regionHtml.includes(`<link rel="canonical" href="https://xcski.chrisizworski.com/regions/${slug}/">`)) fail(`region canonical missing: ${slug}`);
  if (!regionHtml.includes('id="region-board"') || !regionHtml.includes('/xc-model-client.js')) fail(`region cached live board missing: ${slug}`);
}
if (!regionJs.includes("XC_MODEL.state('michigan')")) fail('Michigan regions not using cached model');
if (!regionCss.includes('.region-decision')) fail('region decision styles missing');

const trailUrls=(sitemap.match(/<loc>https:\/\/xcski\.chrisizworski\.com\/trails\//g)||[]).length;
const regionUrls=(sitemap.match(/<loc>https:\/\/xcski\.chrisizworski\.com\/regions\//g)||[]).length;
if (trailUrls !== 61 || regionUrls !== 12 || (sitemap.match(/<loc>/g)||[]).length !== 74) fail('Michigan sitemap counts changed');
for (const phrase of ['Groomed systems ski','Most systems skiing well','Everything skis, backcountry included','No base. Nothing to ski yet.','plain language skiability read']) if ((html+llms+boardJs+trailJs+regionJs+intelJs).toLowerCase().includes(phrase.toLowerCase())) fail(`unsupported skiability claim remains: ${phrase}`);
if (!robots.includes('Sitemap: https://xcski.chrisizworski.com/sitemap.xml')) fail('robots sitemap owner changed');
if (!html.includes('https://chrisizworski.com/tahquamenon-falls/#winter')) fail('Tahquamenon winter cross-link missing');

const marker='const TRAILS = [';
const mi=html.indexOf(marker), rs=html.lastIndexOf('<script>',mi), re=html.indexOf('</script>',mi);
if (mi<0||rs<0||re<0) fail('generated XC runtime script missing');
try { new Function(html.slice(rs+8,re)); new Function(intelJs); new Function(boardJs); new Function(trailJs); new Function(regionJs); } catch (error) { fail('generated JavaScript invalid: '+error.message); }
if (/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition|fingerprint/i.test(html+boardJs+trailJs+regionJs+intelJs)) fail('unexpected browser-state collection');
console.log('XC statewide readiness: PASS — 61 audited trails, cached shared intelligence, 61 trail pages, 12 regional boards, and 74 sitemap URLs.');
