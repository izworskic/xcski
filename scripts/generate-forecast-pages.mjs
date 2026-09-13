import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'dist');
const esc=(s='')=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const js=v=>JSON.stringify(v).replace(/</g,'\\u003c');

const miPath=path.join(out,'index.html');
let miHtml=await readFile(miPath,'utf8');
const trailsMatch=miHtml.match(/const TRAILS = (\[[\s\S]*?\]);\nconst COLORS/);
if(!trailsMatch) throw new Error('Michigan TRAILS runtime missing before forecast page generation');
const miTrails=JSON.parse(trailsMatch[1]);
const wi=JSON.parse(await readFile(path.join(root,'state-blueprints/wisconsin/state-data.json'),'utf8'));
const mn=JSON.parse(await readFile(path.join(root,'state-blueprints/minnesota/state-data.json'),'utf8'));
if(miTrails.length!==61||wi.trails.length!==51||mn.trails.length!==60) throw new Error('forecast pages require 61 MI / 51 WI / 60 MN systems');

const groups={
  michigan:{name:'Michigan',slug:'michigan',timezone:'America/Detroit',home:'/',trails:miTrails.map(t=>({id:t.id,name:t.name,town:t.town,lat:t.lat,lon:t.lon,href:`/trails/${t.id}/`}))},
  wisconsin:{name:'Wisconsin',slug:'wisconsin',timezone:'America/Chicago',home:'/wisconsin/',trails:wi.trails.map(t=>({id:t.id,name:t.name,town:t.town,lat:t.lat,lon:t.lon,href:`/wisconsin/trails/${t.id}/`}))},
  minnesota:{name:'Minnesota',slug:'minnesota',timezone:'America/Chicago',home:'/minnesota/',trails:mn.trails.map(t=>({id:t.id,name:t.name,town:t.town,lat:t.lat,lon:t.lon,href:`/minnesota/trails/${t.id}/`}))}
};

const profiles={
  michigan:{weekend:'Compare lake-effect belts, Southeast Michigan snowmaking, northern Lower Peninsula systems and the Upper Peninsula using the same Saturday/Sunday snow and surface model.',storm:'Track where Michigan lake-effect or synoptic snow may create a cold, dry XC window before the next thaw or rain signal.'},
  wisconsin:{weekend:'Compare Birkie Country, the Northwoods, Wisconsin state parks and southern snowmaking systems for the stronger Saturday/Sunday modeled XC signal.',storm:'Track Northwoods and southern Wisconsin snow events and identify where forecast snow is followed by enough modeled depth and cold, dry hours to create a potential XC window.'},
  minnesota:{weekend:'Compare the Arrowhead and North Shore, Duluth, Bemidji and Twin Cities snowmaking systems for the stronger Saturday/Sunday modeled XC signal.',storm:'Track Minnesota snow from the Arrowhead to the Twin Cities and identify potential cold, dry XC windows after meaningful forecast accumulation.'},
  midwest:{weekend:'Compare all 172 Michigan, Wisconsin and Minnesota systems to see which state, region and trail has the strongest modeled Saturday/Sunday XC signal.',storm:'Scan all 172 systems for meaningful forecast snow, then identify where modeled depth, temperature and rain support a potential XC window before thaw risk returns.'}
};

function pageDef(scope,mode){
  const label=scope==='midwest'?'Midwest':groups[scope].name;
  const base=scope==='midwest'?'/midwest/':scope==='michigan'?'/':`/${scope}/`;
  const pathName=mode==='weekend'?'weekend/':'storm-watch/';
  const url=`https://xcski.chrisizworski.com${base}${pathName}`;
  const title=mode==='weekend'?`Best Cross Country Skiing in ${label} This Weekend | Live XC Outlook`:`${label} XC Storm Watch | Snow & Potential Ski Windows`;
  const h1=mode==='weekend'?`${label} XC Skiing This Weekend`:`${label} XC Storm Watch`;
  const description=mode==='weekend'?`Live ${label} cross-country ski weekend outlook comparing Saturday and Sunday modeled snow, surface and best-time signals.`:`Live ${label} cross-country ski storm watch identifying meaningful forecast snow and potential cold/dry ski windows before thaw or rain.`;
  const groupsForPage=scope==='midwest'?[groups.michigan,groups.wisconsin,groups.minnesota]:[groups[scope]];
  const totalTrails=groupsForPage.reduce((sum,g)=>sum+g.trails.length,0);
  return {scope,mode,label,base,pathName,url,title,h1,description,groups:groupsForPage,totalTrails,profile:profiles[scope][mode]};
}

function htmlFor(def){
  const nav='<a href="/midwest/">Midwest Today</a><a href="/">Michigan</a><a href="/wisconsin/">Wisconsin</a><a href="/minnesota/">Minnesota</a>';
  const schema={'@context':'https://schema.org','@type':'CollectionPage',name:def.h1,url:def.url,description:def.description,dateModified:'2026-09-13',about:'Cross-country skiing'};
  const counterpart=def.mode==='weekend'?`${def.base}storm-watch/`:`${def.base}weekend/`;
  const counterpartLabel=def.mode==='weekend'?'Storm Watch':'This Weekend';
  const context={mode:def.mode,totalTrails:def.totalTrails,limit:def.scope==='midwest'?30:25,groups:def.groups};
  const method=def.mode==='weekend'
    ? 'Saturday and Sunday are scored with the same modeled base, recent snow, rain, freeze/thaw and time-of-day engine used by the daily boards. A weekend score is not a grooming prediction.'
    : 'A storm signal needs at least 1.5 inches of modeled snow in a 24-hour window. A potential ski window is stricter: the model also needs at least 2 inches of depth, subfreezing temperature and very low rain. The window closes when sustained warmth or meaningful rain appears.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(def.title)}</title><meta name="description" content="${esc(def.description)}"><link rel="canonical" href="${def.url}"><link rel="author" href="https://chrisizworski.com/chris-izworski/"><meta property="og:type" content="website"><meta property="og:title" content="${esc(def.title)}"><meta property="og:description" content="${esc(def.description)}"><meta property="og:url" content="${def.url}"><meta property="og:image" content="https://xcski.chrisizworski.com/og.png"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/forecast-pages.css"><script type="application/ld+json">${js(schema)}</script></head><body class="forecast-page"><header class="forecast-top"><div class="forecast-wrap"><a href="${def.base}">${esc(def.label)} XC</a><nav class="forecast-nav" aria-label="XC forecast tools">${nav}</nav></div></header><main class="forecast-wrap"><section class="forecast-hero"><p class="forecast-kicker">${def.mode==='weekend'?'Live weekend decision board':'7-day modeled snow-window intelligence'}</p><h1>${esc(def.h1)}</h1><p>${esc(def.profile)}</p></section><section class="forecast-panel"><div class="forecast-head"><div><h2>${def.mode==='weekend'?'Saturday vs Sunday':'Where could a ski window open?'}</h2><p id="forecast-page-freshness">Loading ${def.totalTrails} systems with the 8-day forecast…</p></div><span id="forecast-page-status" class="forecast-status">Loading…</span></div><div id="forecast-page-board"><div class="forecast-empty"><strong>Building the live forecast board…</strong><p>No stale forecast values are substituted.</p></div></div><p class="forecast-note"><strong>How to read this:</strong> ${esc(method)} Current official grooming/open status remains a separate source and must be verified before travel.</p><p class="forecast-note"><a href="${counterpart}">${counterpartLabel} →</a></p></section></main><footer class="forecast-footer"><div class="forecast-wrap">XC forecast intelligence by Chris Izworski. Weather-derived future conditions are decision-support signals, not trail-opening, grooming or safety guarantees.</div></footer><script>window.XC_FORECAST_PAGE=${js(context)};</script><script src="/xc-intelligence.js" defer></script><script src="/forecast-pages.js" defer></script></body></html>`;
}

const defs=[];
for(const scope of ['michigan','wisconsin','minnesota','midwest']) for(const mode of ['weekend','storm']) defs.push(pageDef(scope,mode));
for(const def of defs){
  const relative=def.scope==='midwest'?path.join('midwest',def.pathName):def.scope==='michigan'?def.pathName:path.join(def.scope,def.pathName);
  const dir=path.join(out,relative); await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'index.html'),htmlFor(def));
}
await cp(path.join(root,'forecast-pages.js'),path.join(out,'forecast-pages.js'));
await cp(path.join(root,'forecast-pages.css'),path.join(out,'forecast-pages.css'));

const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${defs.map(def=>`<url><loc>${def.url}</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>${def.mode==='weekend'?'0.9':'0.85'}</priority></url>`).join('\n')}\n</urlset>\n`;
await writeFile(path.join(out,'forecast-sitemap.xml'),sitemap);

const miLinks='<a href="/weekend/">This weekend</a><a href="/storm-watch/">Storm watch</a>';
if(!miHtml.includes('href="/weekend/"')){
  miHtml=miHtml.replace('<strong>Regional boards</strong>',`<strong>Regional boards</strong>${miLinks}`);
  await writeFile(miPath,miHtml);
}
for(const slug of ['wisconsin','minnesota']){
  const p=path.join(out,slug,'index.html'); let h=await readFile(p,'utf8');
  if(!h.includes(`href="/${slug}/weekend/"`)) h=h.replace('</nav>',`<a href="/${slug}/weekend/">This weekend</a><a href="/${slug}/storm-watch/">Storm watch</a></nav>`);
  await writeFile(p,h);
}
const mwPath=path.join(out,'midwest','index.html'); let mw=await readFile(mwPath,'utf8');
if(!mw.includes('href="/midwest/weekend/"')) mw=mw.replace('</nav>','<a href="/midwest/weekend/">This weekend</a><a href="/midwest/storm-watch/">Storm watch</a></nav>');
await writeFile(mwPath,mw);

const robotsPath=path.join(out,'robots.txt'); let robots=await readFile(robotsPath,'utf8');
const line='Sitemap: https://xcski.chrisizworski.com/forecast-sitemap.xml';
if(!robots.includes(line)) robots=`${robots.trimEnd()}\n${line}\n`;
await writeFile(robotsPath,robots);
console.log('Generated 8 live weekend/storm XC decision pages plus dedicated forecast sitemap.');
