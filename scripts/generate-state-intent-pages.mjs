import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'dist');
const states={
  wisconsin:JSON.parse(await readFile(path.join(root,'state-blueprints/wisconsin/state-data.json'),'utf8')),
  minnesota:JSON.parse(await readFile(path.join(root,'state-blueprints/minnesota/state-data.json'),'utf8'))
};
const esc=(s='')=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const js=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const intents={
  wisconsin:[
    {slug:'snowmaking',title:'Wisconsin XC Ski Snowmaking Trails',heading:'Wisconsin snowmaking XC options',intro:'When natural snow is marginal, Wisconsin snowmaking systems deserve their own board. This view isolates machine-made-snow Nordic options instead of letting nearby modeled natural depth misrepresent them.',match:t=>t.snowmaking},
    {slug:'northwoods',title:'Northwoods Wisconsin XC Ski Conditions',heading:'Northwoods Nordic conditions',intro:'A cross-region Northwoods board for the places that tend to hold cold and natural snow longest, from Birkie Country through Vilas, Oneida and Iron County systems.',match:t=>['northwest-birkie','northwoods'].includes(t.region)},
    {slug:'state-parks',title:'Wisconsin State Park XC Ski Conditions',heading:'Wisconsin DNR ski conditions board',intro:'A decision board for Wisconsin DNR parks, forests and state trails. Weather and surface timing are modeled; property grooming, closures and pass rules remain with Wisconsin DNR.',match:t=>/Wisconsin DNR/.test(t.sourceProvider||'')},
    {slug:'night-skiing',title:'Lighted XC Ski Trails in Wisconsin',heading:'Wisconsin night-skiing conditions',intro:'Lighted Wisconsin Nordic systems for after-work and evening skiing, ranked with the same snow and surface engine but filtered for places that actually support night use.',match:t=>t.lit}
  ],
  minnesota:[
    {slug:'snowmaking',title:'Minnesota XC Ski Snowmaking Trails',heading:'Minnesota snowmaking XC options',intro:'A separate board for Minnesota machine-made-snow systems. Metro and destination snowmaking loops can remain viable when nearby natural-snow trails are closed or deteriorating.',match:t=>t.snowmaking},
    {slug:'ski-pass',title:'Great Minnesota Ski Pass Trail Conditions',heading:'Great Minnesota Ski Pass conditions',intro:'A live decision view across systems identified with Great Minnesota Ski Pass access, keeping modeled snow and surface intelligence separate from DNR or operator grooming status.',match:t=>/Great Minnesota Ski Pass/.test(t.pass||'')},
    {slug:'twin-cities',title:'Twin Cities Cross Country Ski Conditions',heading:'Twin Cities Nordic conditions',intro:'A metro-wide board that compares natural-snow parks, snowmaking systems, lighted loops and daily operator reports across Minneapolis, St. Paul and the surrounding park districts.',match:t=>t.region==='twin-cities'},
    {slug:'night-skiing',title:'Lighted XC Ski Trails in Minnesota',heading:'Minnesota night-skiing conditions',intro:'Minnesota systems with lighted cross-country skiing, built for the after-work decision: where the surface should hold and which official source to verify before leaving.',match:t=>t.lit}
  ]
};

function regionNames(state){return Object.fromEntries(state.regions.map(r=>[r.id,r.name]));}
function nav(state){return `<header class="state-top"><div class="state-wrap"><a href="/${state.slug}/">${esc(state.boardName)}</a><nav class="state-nav" aria-label="Midwest XC tools"><a href="/">Michigan</a><a href="/wisconsin/">Wisconsin</a><a href="/minnesota/">Minnesota</a></nav></div></header>`;}
function page(state,intent,trails){
  const url=`https://xcski.chrisizworski.com/${state.slug}/${intent.slug}/`;
  const desc=`${intent.heading}: live modeled snow score, surface timing, best ski window and source confidence across ${trails.length} ${state.state} Nordic systems.`;
  const schema={'@context':'https://schema.org','@type':'CollectionPage',name:intent.title,url,description:desc,mainEntity:{'@type':'ItemList',numberOfItems:trails.length,itemListElement:trails.map((t,i)=>({'@type':'ListItem',position:i+1,name:t.name,url:`https://xcski.chrisizworski.com/${state.slug}/trails/${t.id}/`}))}};
  const cards=trails.map(t=>`<a class="state-trail-card" href="/${state.slug}/trails/${t.id}/"><strong>${esc(t.name)}</strong><span>${esc(t.town)} · ${esc(t.sourceProvider)}</span></a>`).join('');
  const ctx={state:state.state,slug:state.slug,trails,regionNames:regionNames(state),preseason:`This ${intent.heading.toLowerCase()} board returns to live winter ranking when meaningful snow returns.`};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(intent.title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}"><link rel="author" href="https://chrisizworski.com/chris-izworski/"><meta property="og:type" content="website"><meta property="og:title" content="${esc(intent.title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><link rel="stylesheet" href="/state-xc.css"><script type="application/ld+json">${js(schema)}</script></head><body class="state-${state.slug}">${nav(state)}<main class="state-wrap"><section class="state-hero"><p class="state-kicker">${esc(state.state)} XC decision board</p><h1>${esc(intent.heading)}</h1><p>${esc(intent.intro)}</p></section><section class="state-panel"><div class="state-board-head"><div><h2>Best signals today</h2><p id="state-board-freshness" class="state-freshness">Loading snow, surface and timing intelligence…</p></div><span id="state-board-status" class="state-status">Loading…</span></div><div id="state-live-board"><div class="state-empty">Building decision board…</div></div></section><section class="state-panel" style="margin-top:18px"><h2>${trails.length} matching systems</h2><div class="state-trail-grid">${cards}</div></section></main><footer class="state-footer"><div class="state-wrap"><a href="/${state.slug}/">← ${esc(state.state)} XC Ski Conditions</a></div></footer><script>window.STATE_XC_PAGE=${js(ctx)};</script><script src="/xc-intelligence.js" defer></script><script src="/state-xc.js" defer></script></body></html>`;
}

for(const [slug,state] of Object.entries(states)){
  const links=[];
  for(const intent of intents[slug]){
    const trails=state.trails.filter(intent.match);
    if(!trails.length) throw new Error(`${state.state} intent ${intent.slug} has no trails`);
    const dir=path.join(out,slug,intent.slug);
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'index.html'),page(state,intent,trails));
    links.push(`<a class="state-region-card" href="/${slug}/${intent.slug}/"><strong>${esc(intent.heading)}</strong><span>${trails.length} matching systems · live snow, surface and best-window ranking</span></a>`);
  }
  const homePath=path.join(out,slug,'index.html');
  let home=await readFile(homePath,'utf8');
  const anchor='<section class="state-panel" style="margin-top:18px"><h2>'+state.state+' regions</h2>';
  if(!home.includes(anchor)) throw new Error(`${state.state} intent link anchor missing`);
  const block=`<section class="state-panel" style="margin-top:18px"><h2>${esc(state.state)} decision boards</h2><p>Purpose-built views for high-intent ski decisions, separate from the geographic regional boards.</p><div class="state-regions">${links.join('')}</div></section>`;
  home=home.replace(anchor,block+anchor);
  await writeFile(homePath,home);
}
console.log('Generated 8 state-specific XC decision-intent pages and linked them from Wisconsin and Minnesota homes.');
