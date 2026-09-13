import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root,'dist');
const states = [
  JSON.parse(await readFile(path.join(root,'state-blueprints/wisconsin/state-data.json'),'utf8')),
  JSON.parse(await readFile(path.join(root,'state-blueprints/minnesota/state-data.json'),'utf8'))
];
const esc=(s='')=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const js=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const strip=s=>String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

function validate(state){
  if(!state.state||!state.slug||!Array.isArray(state.regions)||!Array.isArray(state.trails)) throw new Error(`Malformed state blueprint: ${state.state||'unknown'}`);
  if(state.trails.length<15) throw new Error(`${state.state} needs at least 15 launch systems`);
  const ids=new Set();
  for(const trail of state.trails){
    if(ids.has(trail.id)) throw new Error(`${state.state} duplicate trail id ${trail.id}`);
    ids.add(trail.id);
    if(!trail.sourceUrl||!trail.description||!Number.isFinite(trail.lat)||!Number.isFinite(trail.lon)) throw new Error(`${state.state} incomplete trail ${trail.id}`);
    if(!state.regions.some(r=>r.id===trail.region)) throw new Error(`${state.state} unknown region ${trail.region}`);
  }
}
states.forEach(validate);

function haversine(a,b){
  const R=3958.8, rad=d=>d*Math.PI/180;
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function regionNames(state){ return Object.fromEntries(state.regions.map(r=>[r.id,r.name])); }
function filters(state){
  if(state.slug==='wisconsin') return [
    ['all','Best today'],['classic','Classic'],['skate','Skate'],['northwoods','Northwoods'],['snowmaking','Snowmaking']
  ];
  return [['all','Best today'],['classic','Classic'],['skate','Skate'],['ski-pass','Ski Pass'],['snowmaking','Snowmaking'],['twin-cities','Twin Cities']];
}
function tags(t){
  return [t.classic?'Classic':null,t.skate?'Skate':null,t.rentals?'Rentals':null,t.lit?'Lighted':null,t.snowmaking?'Snowmaking':null,t.pass].filter(Boolean);
}
function stateContext(state,trails,statePage=true){
  return {state:state.state,slug:state.slug,trails,regionNames:regionNames(state),preseason:state.slug==='wisconsin'
    ? 'Wisconsin winter rankings return with sustained snow. Use the trail directory now to compare Birkie, Northwoods and southern systems and bookmark official condition sources.'
    : 'Minnesota winter rankings return with sustained snow. Use the trail directory now to compare Ski Pass destinations, snowmaking systems and northern natural-snow options.'};
}
function head(state,title,description,url,schema){
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${url}"><link rel="author" href="https://chrisizworski.com/chris-izworski/"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="https://xcski.chrisizworski.com/og.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="https://xcski.chrisizworski.com/og.png"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/state-xc.css"><script type="application/ld+json">${js(schema)}</script>`;
}
function topNav(state){
  return `<header class="state-top"><div class="state-wrap"><a href="/${state.slug}/">${esc(state.boardName)}</a><nav class="state-nav" aria-label="Midwest XC tools"><a href="/">Michigan</a><a href="/wisconsin/">Wisconsin</a><a href="/minnesota/">Minnesota</a></nav></div></header>`;
}
function filtersHtml(state){ return filters(state).map(([id,label],i)=>`<button type="button" data-state-filter="${id}" aria-pressed="${i===0?'true':'false'}">${esc(label)}</button>`).join(''); }

function homePage(state){
  const base=`https://xcski.chrisizworski.com/${state.slug}/`;
  const title=`${state.state} Cross Country Ski Conditions | ${state.boardName}`;
  const description=`${state.state} cross-country ski conditions with statewide snow score, surface timing, best ski window, trail-source confidence and ${state.trails.length} major Nordic systems.`;
  const schema={ '@context':'https://schema.org','@graph':[
    {'@type':'CollectionPage',name:title,url:base,description,mainEntity:{'@type':'ItemList',numberOfItems:state.trails.length,itemListElement:state.trails.map((t,i)=>({'@type':'ListItem',position:i+1,name:t.name,url:`${base}trails/${t.id}/`}))}},
    {'@type':'FAQPage',mainEntity:state.faqs.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}
  ]};
  const context=stateContext(state,state.trails);
  const regionCards=state.regions.map(r=>`<a class="state-region-card" href="/${state.slug}/regions/${r.id}/"><strong>${esc(r.name)}</strong><span>${esc(r.blurb)}</span></a>`).join('');
  const trailCards=state.trails.map(t=>`<a class="state-trail-card" href="/${state.slug}/trails/${t.id}/"><strong>${esc(t.name)}</strong><span>${esc(t.town)} · ${esc(regionNames(state)[t.region])} · ${t.classic?'classic':''}${t.classic&&t.skate?' + ':''}${t.skate?'skate':''}</span></a>`).join('');
  const faq=state.faqs.map(f=>`<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  return `<!doctype html><html lang="en"><head>${head(state,title,description,base,schema)}</head><body class="state-${state.slug}">${topNav(state)}<main class="state-wrap"><section class="state-hero"><p class="state-kicker">${esc(state.state)} XC intelligence</p><h1>${esc(state.state)} Cross Country Ski Conditions</h1><p>${esc(state.hero)}</p></section><section class="state-identity"><div class="state-panel state-distinct"><h2>What makes this ${esc(state.state)} board different</h2><p>${esc(state.sourceStory)}</p></div><div class="state-panel"><h2>${state.trails.length} launch systems</h2><p>${state.regions.length} state-specific regions · one shared XC weather/surface engine · separate operator-status provenance.</p></div></section><section class="state-panel"><div class="state-board-head"><div><h2>Where should I ski today, and when?</h2><p id="state-board-freshness" class="state-freshness">Loading ${esc(state.state)} snow, surface and timing intelligence…</p></div><span class="state-status" id="state-board-status">Loading…</span></div><div class="state-filters">${filtersHtml(state)}</div><div id="state-live-board"><div class="state-empty"><strong>Building the ${esc(state.boardName)}…</strong><p>Checking modeled base, recent snow, rain, freeze/thaw, hourly temperature, wind and source confidence.</p></div></div></section><section class="state-panel" style="margin-top:18px"><h2>${esc(state.state)} regions</h2><div class="state-regions">${regionCards}</div></section><section class="state-panel" style="margin-top:18px"><h2>Major ${esc(state.state)} Nordic systems</h2><div class="state-trail-grid">${trailCards}</div></section><section class="state-panel" style="margin-top:18px"><h2>${esc(state.state)} XC questions</h2><div class="state-faq">${faq}</div></section></main><footer class="state-footer"><div class="state-wrap">${esc(state.state)} XC conditions by Chris Izworski. Weather intelligence uses Open-Meteo; grooming/open status stays with the named operator, DNR, club or reporting network.</div></footer><script>window.STATE_XC_PAGE=${js(context)};</script><script src="/xc-intelligence.js" defer></script><script src="/state-xc.js" defer></script></body></html>`;
}

function regionPage(state,region){
  const trails=state.trails.filter(t=>t.region===region.id);
  const base=`https://xcski.chrisizworski.com/${state.slug}/regions/${region.id}/`;
  const title=`${region.name} XC Ski Conditions | ${state.state}`;
  const description=`${region.name} cross-country ski conditions: modeled snow, surface timing, best ski window and official status sources for ${trails.length} ${state.state} systems.`;
  const schema={'@context':'https://schema.org','@type':'CollectionPage',name:title,url:base,description,mainEntity:{'@type':'ItemList',numberOfItems:trails.length,itemListElement:trails.map((t,i)=>({'@type':'ListItem',position:i+1,name:t.name,url:`https://xcski.chrisizworski.com/${state.slug}/trails/${t.id}/`}))}};
  const context=stateContext(state,trails);
  const cards=trails.map(t=>`<a class="state-trail-card" href="/${state.slug}/trails/${t.id}/"><strong>${esc(t.name)}</strong><span>${esc(t.town)} · ${esc(t.sourceProvider)}</span></a>`).join('');
  return `<!doctype html><html lang="en"><head>${head(state,title,description,base,schema)}</head><body class="state-${state.slug}">${topNav(state)}<main class="state-wrap"><section class="state-hero"><p class="state-kicker">${esc(state.state)} regional Nordic board</p><h1>${esc(region.name)}</h1><p>${esc(region.blurb)}</p></section><section class="state-panel"><div class="state-board-head"><div><h2>Best signals in this region</h2><p id="state-board-freshness" class="state-freshness">Loading regional intelligence…</p></div><span id="state-board-status" class="state-status">Loading…</span></div><div class="state-filters">${filtersHtml(state)}</div><div id="state-live-board"><div class="state-empty">Building regional board…</div></div></section><section class="state-panel" style="margin-top:18px"><h2>${trails.length} systems in ${esc(region.name)}</h2><div class="state-trail-grid">${cards}</div></section></main><footer class="state-footer"><div class="state-wrap"><a href="/${state.slug}/">← ${esc(state.state)} XC Ski Conditions</a></div></footer><script>window.STATE_XC_PAGE=${js(context)};</script><script src="/xc-intelligence.js" defer></script><script src="/state-xc.js" defer></script></body></html>`;
}

function trailPage(state,trail){
  const base=`https://xcski.chrisizworski.com/${state.slug}/trails/${trail.id}/`;
  const region=state.regions.find(r=>r.id===trail.region);
  const title=`${trail.name} XC Ski Conditions | ${state.state}`;
  const description=`${trail.name} cross-country ski conditions near ${trail.town}, ${state.abbr}: snow score, surface timing, recent snow, best window and official trail-status source.`;
  const schema={'@context':'https://schema.org','@graph':[{'@type':'SportsActivityLocation','@id':`${base}#trail`,name:trail.name,url:base,description:trail.description,address:{'@type':'PostalAddress',addressLocality:trail.town,addressRegion:state.abbr,addressCountry:'US'},geo:{'@type':'GeoCoordinates',latitude:trail.lat,longitude:trail.lon},sameAs:[trail.sourceUrl]},{'@type':'WebPage',url:base,name:title,description,about:{'@id':`${base}#trail`}}]};
  const nearby=state.trails.filter(t=>t.id!==trail.id).map(t=>({...t,distance:haversine(trail,t)})).sort((a,b)=>a.distance-b.distance).slice(0,3);
  const context={...stateContext(state,[trail]),trail};
  return `<!doctype html><html lang="en"><head>${head(state,title,description,base,schema)}</head><body class="state-${state.slug}">${topNav(state)}<main class="state-wrap"><section class="state-trail-hero"><p class="state-kicker">${esc(state.state)} cross-country ski system</p><h1>${esc(trail.name)}</h1><p>${esc(trail.town)} · <a href="/${state.slug}/regions/${trail.region}/">${esc(region?.name||trail.region)}</a></p><div class="state-tags">${tags(trail).map(t=>`<span class="state-tag">${esc(t)}</span>`).join('')}</div></section><div class="state-trail-layout"><div><section class="state-panel"><h2>Live XC intelligence</h2><div id="state-trail-live"><div class="state-empty">Loading snow, surface and best-window model…</div></div></section><section class="state-panel" style="margin-top:18px"><h2>About ${esc(trail.name)}</h2><p>${esc(trail.description)}</p><a class="state-source-link" href="${esc(trail.sourceUrl)}" target="_blank" rel="noopener">Check ${esc(trail.sourceProvider)}</a><p style="margin-top:12px;font-size:.8rem;color:var(--muted)">Modeled weather and surface timing are screening signals. Grooming, opening, pass requirements and actual trail conditions must be verified with the official source.</p></section></div><aside><section class="state-panel"><h2>Trail profile</h2><p><strong>Classic:</strong> ${trail.classic?'Yes':'Not listed'}</p><p><strong>Skate:</strong> ${trail.skate?'Yes':'Not listed'}</p><p><strong>Rentals:</strong> ${trail.rentals?'Yes / listed':'Not listed'}</p><p><strong>Lighted:</strong> ${trail.lit?'Yes':'No / not listed'}</p><p><strong>Snowmaking:</strong> ${trail.snowmaking?'Yes / partial system':'No / not listed'}</p><p><strong>Pass:</strong> ${esc(trail.pass)}</p></section><section class="state-panel" style="margin-top:18px"><h2>Nearby ${esc(state.state)} options</h2><div class="state-related">${nearby.map(n=>`<a href="/${state.slug}/trails/${n.id}/">${esc(n.name)} · ${n.distance.toFixed(0)} mi</a>`).join('')}</div></section></aside></div></main><footer class="state-footer"><div class="state-wrap"><a href="/${state.slug}/">← ${esc(state.state)} XC Ski Conditions</a></div></footer><script>window.STATE_XC_PAGE=${js(context)};</script><script src="/xc-intelligence.js" defer></script><script src="/state-xc.js" defer></script></body></html>`;
}

const sitemapEntries=[];
for(const state of states){
  const stateDir=path.join(out,state.slug); await mkdir(stateDir,{recursive:true});
  await writeFile(path.join(stateDir,'index.html'),homePage(state));
  sitemapEntries.push(`<url><loc>https://xcski.chrisizworski.com/${state.slug}/</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>0.95</priority></url>`);
  for(const region of state.regions){
    const dir=path.join(stateDir,'regions',region.id); await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'index.html'),regionPage(state,region));
    sitemapEntries.push(`<url><loc>https://xcski.chrisizworski.com/${state.slug}/regions/${region.id}/</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`);
  }
  for(const trail of state.trails){
    const dir=path.join(stateDir,'trails',trail.id); await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'index.html'),trailPage(state,trail));
    sitemapEntries.push(`<url><loc>https://xcski.chrisizworski.com/${state.slug}/trails/${trail.id}/</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>0.75</priority></url>`);
  }
}
await cp(path.join(root,'state-xc.js'),path.join(out,'state-xc.js'));
await cp(path.join(root,'state-xc.css'),path.join(out,'state-xc.css'));
let sitemap=await readFile(path.join(out,'sitemap.xml'),'utf8');
sitemap=sitemap.replace('</urlset>',`${sitemapEntries.join('\n')}\n</urlset>`);
await writeFile(path.join(out,'sitemap.xml'),sitemap);

const indexPath=path.join(out,'index.html');
let index=await readFile(indexPath,'utf8');
const siblingBlock='<div class="ski-region-links" aria-label="More Midwest XC boards"><strong>More Midwest XC boards</strong><a href="/wisconsin/">Wisconsin XC</a><a href="/minnesota/">Minnesota XC</a></div>';
const anchor='    <p class="ski-board-note"><strong>How to read this:';
if(index.includes(anchor)&&!index.includes('More Midwest XC boards')) index=index.replace(anchor,`${siblingBlock}\n${anchor}`);
await writeFile(indexPath,index);

const wiText=strip(await readFile(path.join(out,'wisconsin/index.html'),'utf8'));
const mnText=strip(await readFile(path.join(out,'minnesota/index.html'),'utf8'));
if(wiText===mnText) throw new Error('Sibling state pages became duplicate content');
console.log(`Generated Wisconsin (${states[0].trails.length} trails/${states[0].regions.length} regions) and Minnesota (${states[1].trails.length} trails/${states[1].regions.length} regions) XC products.`);
