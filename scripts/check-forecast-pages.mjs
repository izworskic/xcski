import { readFileSync } from 'node:fs';
import path from 'node:path';

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
  if(!html.includes('/xc-intelligence.js')||!html.includes('/xc-forecast.js')||!html.includes('/forecast-pages.js')) fail(`${name} shared forecast runtime missing`);
  if(!html.includes('not a grooming')&&!html.includes('not trail-opening')&&!html.includes('not a trail-opening')) fail(`${name} trust boundary missing`);
}
if(new Set(bodies).size!==8) fail('forecast decision pages collapsed into duplicate visible content');
if((sitemap.match(/<loc>/g)||[]).length!==8) fail('forecast sitemap must contain 8 URLs');
for(const [, ,canonical] of pages) if(!sitemap.includes(`<loc>${canonical}</loc>`)) fail(`forecast sitemap missing ${canonical}`);
if(!robots.includes('Sitemap: https://xcski.chrisizworski.com/forecast-sitemap.xml')) fail('forecast sitemap not advertised');
if(!mi.includes('href="/weekend/"')||!mi.includes('href="/storm-watch/"')) fail('Michigan forecast discovery links missing');
if(!wi.includes('href="/wisconsin/weekend/"')||!wi.includes('href="/wisconsin/storm-watch/"')) fail('Wisconsin forecast discovery links missing');
if(!mn.includes('href="/minnesota/weekend/"')||!mn.includes('href="/minnesota/storm-watch/"')) fail('Minnesota forecast discovery links missing');
if(!mw.includes('href="/midwest/weekend/"')||!mw.includes('href="/midwest/storm-watch/"')) fail('Midwest forecast discovery links missing');
if(!runtime.includes("ctx.mode==='weekend'")||!runtime.includes('XC_FORECAST.weekendOutlook')||!runtime.includes('XC_FORECAST.stormWindow')) fail('forecast page runtime modes missing');
if(!runtime.includes('i+=40')) fail('forecast page weather requests are not chunked');
if(!css.includes('.forecast-grid')||!css.includes('.forecast-storm')) fail('forecast page styles incomplete');
if(/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition/i.test(runtime)) fail('forecast decision pages introduced browser-state/location collection');
try{new Function(runtime)}catch(error){fail(`forecast decision runtime invalid: ${error.message}`)}
console.log('XC forecast pages readiness: PASS — 8 distinct live weekend/storm pages, forecast sitemap, shared runtime and discovery links.');
