import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const esc = (s='') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const js = value => JSON.stringify(value).replace(/</g,'\\u003c');

const michiganHtmlPath = path.join(out, 'index.html');
let michiganHtml = await readFile(michiganHtmlPath, 'utf8');
const trailsMatch = michiganHtml.match(/const TRAILS = (\[[\s\S]*?\]);\nconst COLORS/);
if (!trailsMatch) throw new Error('Michigan TRAILS runtime missing before Midwest generation');
const michiganTrails = JSON.parse(trailsMatch[1]);
if (michiganTrails.length !== 61) throw new Error(`Expected 61 Michigan trails, found ${michiganTrails.length}`);

const wi = JSON.parse(await readFile(path.join(root,'state-blueprints/wisconsin/state-data.json'),'utf8'));
const mn = JSON.parse(await readFile(path.join(root,'state-blueprints/minnesota/state-data.json'),'utf8'));
if (wi.trails.length !== 51) throw new Error(`Expected 51 Wisconsin trails, found ${wi.trails.length}`);
if (mn.trails.length !== 60) throw new Error(`Expected 60 Minnesota trails, found ${mn.trails.length}`);

const states = [
  {
    name:'Michigan', slug:'michigan', timezone:'America/Detroit', href:'/',
    trails:michiganTrails.map(t => ({
      id:t.id,name:t.name,town:t.town,lat:t.lat,lon:t.lon,cat:t.cat,lit:Boolean(t.lit),rentals:Boolean(t.rentals),skate:Boolean(t.skate),
      href:`/trails/${t.id}/`
    }))
  },
  {
    name:'Wisconsin', slug:'wisconsin', timezone:'America/Chicago', href:'/wisconsin/',
    trails:wi.trails.map(t => ({
      id:t.id,name:t.name,town:t.town,lat:t.lat,lon:t.lon,cat:t.cat,lit:Boolean(t.lit),rentals:Boolean(t.rentals),skate:Boolean(t.skate),snowmaking:Boolean(t.snowmaking),
      href:`/wisconsin/trails/${t.id}/`
    }))
  },
  {
    name:'Minnesota', slug:'minnesota', timezone:'America/Chicago', href:'/minnesota/',
    trails:mn.trails.map(t => ({
      id:t.id,name:t.name,town:t.town,lat:t.lat,lon:t.lon,cat:t.cat,lit:Boolean(t.lit),rentals:Boolean(t.rentals),skate:Boolean(t.skate),snowmaking:Boolean(t.snowmaking),
      href:`/minnesota/trails/${t.id}/`
    }))
  }
];
const totalTrails = states.reduce((sum,state) => sum + state.trails.length,0);
if (totalTrails !== 172) throw new Error(`Expected 172 Midwest systems, found ${totalTrails}`);

const canonical = 'https://xcski.chrisizworski.com/midwest/';
const title = 'Midwest Cross Country Ski Conditions Today | Michigan, Wisconsin & Minnesota';
const description = 'Compare Michigan, Wisconsin and Minnesota cross-country ski conditions across 172 Nordic systems, including modeled snow, surface timing, day-over-day change, weekend outlook, storm-window potential and official status provenance.';
const schema = {
  '@context':'https://schema.org',
  '@graph':[
    {
      '@type':'CollectionPage',
      name:'Midwest XC Ski Conditions Today',
      url:canonical,
      description,
      dateModified:'2026-09-13',
      about:['Cross-country skiing in Michigan','Cross-country skiing in Wisconsin','Cross-country skiing in Minnesota']
    },
    {
      '@type':'ItemList',
      name:'Midwest state cross-country ski condition boards',
      numberOfItems:3,
      itemListElement:states.map((state,index) => ({'@type':'ListItem',position:index+1,name:`${state.name} XC Ski Conditions`,url:`https://xcski.chrisizworski.com${state.href}`}))
    }
  ]
};
const context = { totalTrails, states, defaultMode:'best' };
const stateLinks = states.map(state => `<a href="${state.href}"><strong>${esc(state.name)}</strong><span>${state.trails.length} systems</span></a>`).join('');

const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}"><link rel="author" href="https://chrisizworski.com/chris-izworski/">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://xcski.chrisizworski.com/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="https://xcski.chrisizworski.com/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/midwest-xc.css">
<script type="application/ld+json">${js(schema)}</script></head>
<body class="midwest-xc"><header class="midwest-top"><div class="midwest-wrap"><a href="/midwest/">Midwest XC Today</a><nav class="midwest-nav" aria-label="State XC boards"><a href="/">Michigan</a><a href="/wisconsin/">Wisconsin</a><a href="/minnesota/">Minnesota</a></nav></div></header>
<main class="midwest-wrap">
<section class="midwest-hero"><p class="midwest-kicker">Upper Midwest Nordic intelligence</p><h1>Midwest XC Ski Conditions Today</h1><p>One decision layer across ${totalTrails} Michigan, Wisconsin and Minnesota Nordic systems. Compare the strongest modeled snow signals, what improved since the same local hour yesterday, the Saturday-versus-Sunday outlook, and where forecast snow may open a cold/dry ski window—while official grooming/open status remains a separate provenance layer.</p></section>
<section id="midwest-state-summary" class="midwest-state-summary" aria-label="State condition summary"><a class="midwest-state-card state-michigan" href="/"><span>Michigan</span><strong>Loading…</strong><small>61 systems</small></a><a class="midwest-state-card state-wisconsin" href="/wisconsin/"><span>Wisconsin</span><strong>Loading…</strong><small>51 systems</small></a><a class="midwest-state-card state-minnesota" href="/minnesota/"><span>Minnesota</span><strong>Loading…</strong><small>60 systems</small></a></section>
<section class="midwest-panel"><div class="midwest-board-head"><div><h2 id="midwest-board-label">Best modeled signals across the Midwest</h2><p id="midwest-freshness">Loading weather, change, weekend, storm-window and provider layers…</p></div><span id="midwest-status" class="midwest-status">Loading…</span></div><div class="midwest-tabs"><button type="button" data-midwest-mode="best" aria-pressed="true">Best today</button><button type="button" data-midwest-mode="weekend" aria-pressed="false">This weekend</button><button type="button" data-midwest-mode="storm" aria-pressed="false">Storm watch</button><button type="button" data-midwest-mode="improvers" aria-pressed="false">Biggest improvers</button><button type="button" data-midwest-mode="fresh" aria-pressed="false">Fresh snow</button><button type="button" data-midwest-mode="lighted" aria-pressed="false">Lighted</button><button type="button" data-midwest-mode="skate" aria-pressed="false">Skate</button></div><div id="midwest-board"><div class="midwest-empty"><strong>Building the Midwest board…</strong><p>Checking all ${totalTrails} systems in state-local time with an 8-day forecast.</p></div></div></section>
<section class="midwest-panel"><h2>How this comparison works</h2><div class="midwest-method"><div><strong>Same engine</strong><span>Michigan, Wisconsin and Minnesota use the same snow, freeze/thaw, surface and best-window intelligence so the cross-state comparison is internally consistent.</span></div><div><strong>Weekend uses the same model</strong><span>Saturday and Sunday are scored with forecast base, recent snow, rain, freeze/thaw and time-of-day windows. It is not a grooming prediction.</span></div><div><strong>Storm windows are conservative</strong><span>The engine needs at least a 1.5-inch modeled 24-hour snow burst, at least 2 inches of modeled depth, subfreezing temperature and low rain before it flags a potential ski window.</span></div><div><strong>Same local hour yesterday</strong><span>Change is reconstructed from Open-Meteo's prior-day hourly model data. No cookies, browser storage or fabricated snapshots are used.</span></div><div><strong>Official status stays separate</strong><span>Fresh authorized provider data can confirm open/closed status and raise confidence. It never rewrites the modeled snow score.</span></div></div></section>
<section class="midwest-panel"><h2>Go deeper by state</h2><div class="midwest-state-summary">${stateLinks}</div></section>
</main><footer class="midwest-footer"><div class="midwest-wrap">Midwest XC conditions by Chris Izworski. Modeled weather and future ski-window signals are screening tools; verify grooming, opening and access with the linked operator or land manager before traveling.</div></footer>
<script>window.MIDWEST_XC=${js(context)};</script><script src="/xc-intelligence.js" defer></script><script src="/midwest-xc.js" defer></script></body></html>`;

const dir = path.join(out,'midwest');
await mkdir(dir,{recursive:true});
await writeFile(path.join(dir,'index.html'),html);
await cp(path.join(root,'midwest-xc.js'),path.join(out,'midwest-xc.js'));
await cp(path.join(root,'midwest-xc.css'),path.join(out,'midwest-xc.css'));
await writeFile(path.join(dir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${canonical}</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>0.95</priority></url>\n</urlset>\n`);

const siblingMarker = '<strong>More Midwest XC boards</strong>';
if (michiganHtml.includes(siblingMarker) && !michiganHtml.includes('href="/midwest/"')) {
  michiganHtml = michiganHtml.replace(siblingMarker, `${siblingMarker}<a href="/midwest/">Midwest XC Today</a>`);
  await writeFile(michiganHtmlPath,michiganHtml);
}

for (const slug of ['wisconsin','minnesota']) {
  const statePath = path.join(out,slug,'index.html');
  let stateHtml = await readFile(statePath,'utf8');
  if (!stateHtml.includes('href="/midwest/"')) {
    stateHtml = stateHtml.replace('<nav class="state-nav" aria-label="Midwest XC tools">','<nav class="state-nav" aria-label="Midwest XC tools"><a href="/midwest/">Midwest Today</a>');
    await writeFile(statePath,stateHtml);
  }
}

const robotsPath = path.join(out,'robots.txt');
let robots = await readFile(robotsPath,'utf8');
const sitemapLine = 'Sitemap: https://xcski.chrisizworski.com/midwest/sitemap.xml';
if (!robots.includes(sitemapLine)) robots = `${robots.trimEnd()}\n${sitemapLine}\n`;
await writeFile(robotsPath,robots);

console.log(`Generated Midwest XC Today across ${totalTrails} systems with weekend and storm-window intelligence.`);