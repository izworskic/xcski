import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const esc = (s='') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const js = value => JSON.stringify(value).replace(/</g,'\u003c');

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
    eyebrow:'Great Lakes snowbelts + statewide network',
    fit:'Start here for the Upper Peninsula, northern Lower Peninsula, West Michigan or Detroit-area skiing.',
    trip:'Best fit for destination snowbelt trips plus the broadest north-to-south range of skiing in this network.',
    shortcuts:[
      {label:'Southeast Michigan',href:'/regions/southeast-michigan/'},
      {label:'Grayling / Roscommon',href:'/regions/grayling-roscommon/'},
      {label:'Central U.P.',href:'/regions/central-upper-peninsula/'},
      {label:'Keweenaw',href:'/regions/keweenaw-houghton-calumet/'}
    ],
    trails:michiganTrails.map(t => ({
      id:t.id,name:t.name,town:t.town,lat:t.lat,lon:t.lon,cat:t.cat,lit:Boolean(t.lit),rentals:Boolean(t.rentals),skate:Boolean(t.skate),
      href:`/trails/${t.id}/`
    }))
  },
  {
    name:'Wisconsin', slug:'wisconsin', timezone:'America/Chicago', href:'/wisconsin/',
    eyebrow:'Birkie Country + Northwoods + southern snowmaking',
    fit:'Start here for Hayward/Cable, the Northwoods, Wisconsin state parks, Madison or the Kettle Moraine.',
    trip:'Best fit for Birkie-country destination skiing, Northwoods natural snow and purpose-built marginal-snow options farther south.',
    shortcuts:[
      {label:'Birkie Country',href:'/wisconsin/regions/northwest-birkie/'},
      {label:'Northwoods',href:'/wisconsin/regions/northwoods/'},
      {label:'Madison / Southwest',href:'/wisconsin/regions/southwest-madison/'},
      {label:'Kettle Moraine',href:'/wisconsin/regions/southeast-kettle/'}
    ],
    trails:wi.trails.map(t => ({
      id:t.id,name:t.name,town:t.town,lat:t.lat,lon:t.lon,cat:t.cat,lit:Boolean(t.lit),rentals:Boolean(t.rentals),skate:Boolean(t.skate),snowmaking:Boolean(t.snowmaking),
      href:`/wisconsin/trails/${t.id}/`
    }))
  },
  {
    name:'Minnesota', slug:'minnesota', timezone:'America/Chicago', href:'/minnesota/',
    eyebrow:'Twin Cities + Duluth + North Shore + Arrowhead',
    fit:'Start here for Twin Cities snowmaking, Duluth, the North Shore, Arrowhead/Ely and Great Minnesota Ski Pass systems.',
    trip:'Best fit for metro reliability, North Shore/Arrowhead trips and a large pass-connected public trail network.',
    shortcuts:[
      {label:'Twin Cities',href:'/minnesota/regions/twin-cities/'},
      {label:'Duluth',href:'/minnesota/regions/duluth/'},
      {label:'North Shore',href:'/minnesota/regions/north-shore/'},
      {label:'Arrowhead / Ely',href:'/minnesota/regions/arrowhead-ely/'}
    ],
    trails:mn.trails.map(t => ({
      id:t.id,name:t.name,town:t.town,lat:t.lat,lon:t.lon,cat:t.cat,lit:Boolean(t.lit),rentals:Boolean(t.rentals),skate:Boolean(t.skate),snowmaking:Boolean(t.snowmaking),
      href:`/minnesota/trails/${t.id}/`
    }))
  }
];
const totalTrails = states.reduce((sum,state) => sum + state.trails.length,0);
if (totalTrails !== 172) throw new Error(`Expected 172 Midwest systems, found ${totalTrails}`);

const canonical = 'https://xcski.chrisizworski.com/midwest/';
const title = 'Midwest Cross Country Skiing | Michigan, Wisconsin & Minnesota XC Conditions';
const description = 'Choose the right Midwest XC skiing state or destination area, then open the detailed Michigan, Wisconsin or Minnesota condition board. Includes weekend-trip and storm-window guidance when cross-state comparison actually matters.';
const schema = {
  '@context':'https://schema.org',
  '@graph':[
    {
      '@type':'CollectionPage',
      name:'Midwest Cross Country Skiing Gateway',
      url:canonical,
      description,
      dateModified:'2026-09-14',
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
const context = { totalTrails, states };

function stateCard(state){
  const shortcuts=state.shortcuts.map(s=>`<a href="${s.href}">${esc(s.label)}</a>`).join('');
  return `<article class="midwest-state-card state-${state.slug}" data-state-card="${state.slug}"><div class="midwest-state-card-top"><div><span>${esc(state.eyebrow)}</span><h2>${esc(state.name)}</h2></div><strong>${state.trails.length}<small>systems</small></strong></div><p>${esc(state.fit)}</p><p class="midwest-state-trip">${esc(state.trip)}</p><div class="midwest-state-pulse" data-state-pulse="${state.slug}">Loading current statewide signals…</div><div class="midwest-region-shortcuts">${shortcuts}</div><a class="midwest-state-cta" href="${state.href}">Open ${esc(state.name)} conditions →</a></article>`;
}

const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}"><link rel="author" href="https://chrisizworski.com/chris-izworski/">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://xcski.chrisizworski.com/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="https://xcski.chrisizworski.com/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/midwest-xc.css">
<script type="application/ld+json">${js(schema)}</script></head>
<body class="midwest-xc"><header class="midwest-top"><div class="midwest-wrap"><a href="/midwest/">Midwest XC</a><nav class="midwest-nav" aria-label="State XC boards"><a href="/">Michigan</a><a href="/wisconsin/">Wisconsin</a><a href="/minnesota/">Minnesota</a></nav></div></header>
<main class="midwest-wrap">
<section class="midwest-hero"><p class="midwest-kicker">Start with the trip you are actually planning</p><h1>Find your Midwest XC starting point</h1><p>This page is a doorway, not a 172-trail horse race. If you already know the state, go straight there. If you are planning a weekend away or willing to cross a state line for a real snow event, use the cross-state tools below.</p></section>
<section id="midwest-state-summary" class="midwest-state-gateway" aria-label="Choose a state XC conditions board"><div class="midwest-section-head"><p class="midwest-kicker">Most skiers should start here</p><h2>Choose the state or destination area that fits the trip</h2><p>The state tools do the detailed trail-level decision work. These cards help you get into the right one quickly.</p></div><div class="midwest-state-grid">${states.map(stateCard).join('')}</div></section>
<section class="midwest-paths" aria-labelledby="midwest-paths-title"><div class="midwest-section-head"><p class="midwest-kicker">Different skier, different decision</p><h2 id="midwest-paths-title">What are you trying to decide?</h2></div><div class="midwest-path-grid"><a href="#midwest-state-summary"><small>Local / day skier</small><strong>I already know my state</strong><span>Jump into Michigan, Wisconsin or Minnesota and use the detailed live board.</span></a><a href="/midwest/weekend/"><small>Weekend traveler</small><strong>I could make a destination trip</strong><span>Compare Saturday vs. Sunday across the three states when a border-crossing trip is realistic.</span></a><a href="/midwest/storm-watch/"><small>Storm chaser</small><strong>I will travel for genuinely better snow</strong><span>Only compare states when forecast snow may create a meaningful cold/dry ski window.</span></a><div><small>Reliability seeker</small><strong>I need snowmaking, lights or a dependable metro option</strong><span><a href="/wisconsin/snowmaking/">Wisconsin snowmaking</a> · <a href="/minnesota/snowmaking/">Minnesota snowmaking</a> · <a href="/wisconsin/night-skiing/">WI night skiing</a> · <a href="/minnesota/night-skiing/">MN night skiing</a></span></div></div></section>
<section class="midwest-radar-panel"><div class="midwest-board-head"><div><p class="midwest-kicker">Cross-state radar</p><h2>When does comparing states actually matter?</h2><p id="midwest-freshness">Loading statewide weather and official-provider signals…</p></div><span id="midwest-status" class="midwest-status">Loading…</span></div><div id="midwest-radar"><div class="midwest-empty"><strong>Building the state-level radar…</strong><p>This section summarizes statewide change, weekend direction and meaningful storm windows. It does not rank individual trails across state lines.</p></div></div></section>
<section class="midwest-why"><div class="midwest-section-head"><p class="midwest-kicker">How to use this network</p><h2>Use the broad page for routing, the state page for the decision</h2></div><div class="midwest-method"><div><strong>Know your state?</strong><span>Skip the regional comparison entirely. The Michigan, Wisconsin and Minnesota boards are the main products.</span></div><div><strong>Planning a weekend?</strong><span>Cross-state comparison is useful when lodging, drive time and a two-day ski trip make a broader choice realistic.</span></div><div><strong>Chasing a storm?</strong><span>Cross-state intelligence matters when a meaningful snow event creates a temporary window worth traveling for.</span></div><div><strong>Looking for a specific experience?</strong><span>Use regional shortcuts and state decision pages for snowmaking, night skiing, pass systems and destination areas.</span></div><div><strong>Still verify locally.</strong><span>Modeled snow and future windows are screening tools. Grooming, opening and access remain with the operator or land manager.</span></div></div></section>
</main><footer class="midwest-footer"><div class="midwest-wrap">Midwest XC by Chris Izworski. This gateway routes skiers into detailed state and regional condition tools; modeled weather does not replace operator grooming or opening reports.</div></footer>
<script>window.MIDWEST_XC=${js(context)};</script><script src="/xc-intelligence.js" defer></script><script src="/midwest-xc.js" defer></script></body></html>`;

const dir = path.join(out,'midwest');
await mkdir(dir,{recursive:true});
await writeFile(path.join(dir,'index.html'),html);
await cp(path.join(root,'midwest-xc.js'),path.join(out,'midwest-xc.js'));
await cp(path.join(root,'midwest-xc.css'),path.join(out,'midwest-xc.css'));
await writeFile(path.join(dir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${canonical}</loc><lastmod>2026-09-14</lastmod><changefreq>daily</changefreq><priority>0.95</priority></url>\n</urlset>\n`);

const siblingMarker = '<strong>More Midwest XC boards</strong>';
if (michiganHtml.includes(siblingMarker) && !michiganHtml.includes('href="/midwest/"')) {
  michiganHtml = michiganHtml.replace(siblingMarker, `${siblingMarker}<a href="/midwest/">Midwest XC gateway</a>`);
  await writeFile(michiganHtmlPath,michiganHtml);
}

for (const slug of ['wisconsin','minnesota']) {
  const statePath = path.join(out,slug,'index.html');
  let stateHtml = await readFile(statePath,'utf8');
  if (!stateHtml.includes('href="/midwest/"')) {
    stateHtml = stateHtml.replace('<nav class="state-nav" aria-label="Midwest XC tools">','<nav class="state-nav" aria-label="Midwest XC tools"><a href="/midwest/">Midwest gateway</a>');
    await writeFile(statePath,stateHtml);
  }
}

const robotsPath = path.join(out,'robots.txt');
let robots = await readFile(robotsPath,'utf8');
const sitemapLine = 'Sitemap: https://xcski.chrisizworski.com/midwest/sitemap.xml';
if (!robots.includes(sitemapLine)) robots = `${robots.trimEnd()}\n${sitemapLine}\n`;
await writeFile(robotsPath,robots);

console.log(`Generated skier-first Midwest XC gateway across ${totalTrails} systems with state routing plus weekend/storm cross-state decisions.`);
