import { readFileSync } from 'node:fs';

const fail=m=>{throw new Error(m)};
const pages=[
  ['Michigan weekend','dist/weekend/index.html','https://xcski.chrisizworski.com/weekend/','Michigan XC Skiing This Weekend'],
  ['Michigan storm','dist/storm-watch/index.html','https://xcski.chrisizworski.com/storm-watch/','Michigan XC Storm Watch'],
  ['Wisconsin weekend','dist/wisconsin/weekend/index.html','https://xcski.chrisizworski.com/wisconsin/weekend/','Wisconsin XC Skiing This Weekend'],
  ['Wisconsin storm','dist/wisconsin/storm-watch/index.html','https://xcski.chrisizworski.com/wisconsin/storm-watch/','Wisconsin XC Storm Watch'],
  ['Minnesota weekend','dist/minnesota/weekend/index.html','https://xcski.chrisizworski.com/minnesota/weekend/','Minnesota XC Skiing This Weekend'],
  ['Minnesota storm','dist/minnesota/storm-watch/index.html','https://xcski.chrisizworski.com/minnesota/storm-watch/','Minnesota XC Storm Watch'],
  ['Midwest weekend','dist/midwest/weekend/index.html','https://xcski.chrisizworski.com/midwest/weekend/','Midwest XC Skiing This Weekend'],
  ['Midwest storm','dist/midwest/storm-watch/index.html','https://xcski.chrisizworski.com/midwest/storm-watch/','Midwest XC Storm Watch']
];
const runtime=readFileSync('dist/forecast-pages.js','utf8');
const css=readFileSync('dist/forecast-pages.css','utf8');
const sitemap=readFileSync('dist/forecast-sitemap.xml','utf8');
const robots=readFileSync('dist/robots.txt','utf8');
const mi=readFileSync('dist/index.html','utf8');
const wi=readFileSync('dist/wisconsin/index.html','utf8');
const mn=readFileSync('dist/minnesota/index.html','utf8');
const mw=readFileSync('dist/midwest/index.html','utf8');

const bodies=[];
for(const [name,file,canonical,h1] of pages){
  const html=readFileSync(file,'utf8');
  bodies.push(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().toLowerCase());
  if(!html.includes(`<link rel="canonical" href="${canonical}">`)) fail(`${name} canonical missing`);
  if(!html.includes(`<h1>${h1}</h1>`)) fail(`${name} H1 missing`);
  for(const dep of ['/xc-intelligence.js','/xc-forecast.js','/xc-model-client.js','/forecast-pages.js']) if(!html.includes(dep)) fail(`${name} dependency missing: ${dep}`);
  if(!html.includes('not a grooming')&&!html.includes('not trail-opening')&&!html.includes('not a trail-opening')) fail(`${name} trust boundary missing`);
}
if(new Set(bodies).size!==8) fail('forecast pages collapsed into duplicate visible content');
if((sitemap.match(/<loc>/g)||[]).length!==8) fail('forecast sitemap must contain 8 URLs');
for(const [, ,canonical] of pages) if(!sitemap.includes(`<loc>${canonical}</loc>`)) fail(`forecast sitemap missing ${canonical}`);
if(!robots.includes('Sitemap: https://xcski.chrisizworski.com/forecast-sitemap.xml')) fail('forecast sitemap not advertised');
if(!mi.includes('href="/weekend/"')||!mi.includes('href="/storm-watch/"')) fail('Michigan forecast discovery missing');
if(!wi.includes('href="/wisconsin/weekend/"')||!wi.includes('href="/wisconsin/storm-watch/"')) fail('Wisconsin forecast discovery missing');
if(!mn.includes('href="/minnesota/weekend/"')||!mn.includes('href="/minnesota/storm-watch/"')) fail('Minnesota forecast discovery missing');
if(!mw.includes('href="/midwest/weekend/"')||!mw.includes('href="/midwest/storm-watch/"')) fail('Midwest forecast discovery missing');
if(!runtime.includes("ctx.mode==='weekend'")||!runtime.includes('model.weekend')||!runtime.includes('model.storm')) fail('forecast page cached modes missing');
if(!runtime.includes('XC_MODEL.state(group.slug)')) fail('forecast pages not using cached state snapshots');
if(runtime.includes('fetchChunk')||runtime.includes('forecastQuery(lats')) fail('forecast pages still make direct weather batches');
if(!runtime.includes('Promise.allSettled(ctx.groups.map(loadGroup))')) fail('forecast partial-state resilience missing');
if(!css.includes('.forecast-grid')||!css.includes('.forecast-storm')) fail('forecast page styles incomplete');
if(/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition/i.test(runtime)) fail('forecast pages introduced browser-state collection');
try{new Function(runtime)}catch(error){fail(`forecast runtime invalid: ${error.message}`)}
console.log('XC forecast pages readiness: PASS — 8 distinct decision pages consume cached state snapshots with forecast sitemap, discovery and graceful partial-state behavior.');
