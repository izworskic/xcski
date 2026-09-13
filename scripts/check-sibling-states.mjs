import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const fail=m=>{throw new Error(m)};
const wi=readFileSync('dist/wisconsin/index.html','utf8');
const mn=readFileSync('dist/minnesota/index.html','utf8');
const mi=readFileSync('dist/index.html','utf8');
const runtime=readFileSync('dist/state-xc.js','utf8');
const css=readFileSync('dist/state-xc.css','utf8');
const wiMap=readFileSync('dist/wisconsin/sitemap.xml','utf8');
const mnMap=readFileSync('dist/minnesota/sitemap.xml','utf8');
const robots=readFileSync('dist/robots.txt','utf8');

if(!wi.includes('<h1>Wisconsin Cross Country Ski Conditions</h1>')) fail('Wisconsin H1 missing');
if(!mn.includes('<h1>Minnesota Cross Country Ski Conditions</h1>')) fail('Minnesota H1 missing');
if(!wi.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/wisconsin/">')) fail('Wisconsin canonical missing');
if(!mn.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/minnesota/">')) fail('Minnesota canonical missing');
if(!wi.includes('Travel Wisconsin')||!wi.includes('Birkie')||!wi.includes('Kettle Moraine')) fail('Wisconsin state-specific source/intent language missing');
if(!mn.includes('Great Minnesota Ski Pass')||!mn.includes('Twin Cities')||!mn.includes('North Shore')) fail('Minnesota state-specific source/intent language missing');
if(wi.includes('Great Minnesota Ski Pass')) fail('Minnesota pass copy leaked into Wisconsin homepage');
if(mn.includes('Travel Wisconsin')) fail('Wisconsin report copy leaked into Minnesota homepage');
if(wi.includes('Michigan<br>Cross Country Ski Trails')||mn.includes('Michigan<br>Cross Country Ski Trails')) fail('Michigan H1 leaked into sibling state product');
if(!wi.includes('51 launch systems')) fail('Wisconsin deep coverage count missing');
if(!mn.includes('60 launch systems')) fail('Minnesota deep coverage count missing');
if(!wi.includes('/xc-intelligence.js')||!mn.includes('/xc-intelligence.js')) fail('shared XC intelligence engine missing from sibling state home');
if(!wi.includes('/state-xc.js')||!mn.includes('/state-xc.js')) fail('sibling-state runtime missing');
if(!runtime.includes('XC_INTEL.analyzeWeather')||!runtime.includes('XC_INTEL.confidence')) fail('shared intelligence functions not used by sibling runtime');
if(!runtime.includes("filter === 'northwoods'")||!runtime.includes("filter === 'ski-pass'")) fail('state-specific intent filters missing');
if(!css.includes('body.state-wisconsin')||!css.includes('body.state-minnesota')) fail('state-specific visual identities missing');

for(const marker of ['Black River State Forest','Mirror Lake State Park','Willow River State Park','Point Beach State Forest','Wyalusing State Park','Interstate State Park']) {
  if(!wi.includes(marker)) fail(`Wisconsin deep-coverage system missing: ${marker}`);
}
for(const marker of ['Magney-Snively Ski Trails','Movil Maze','Baker Park Reserve','Central Gunflint Trail Ski System','Gamehaven Park Ski Trails','Jay Cooke State Park']) {
  if(!mn.includes(marker)) fail(`Minnesota deep-coverage system missing: ${marker}`);
}

const wiTrails=readdirSync('dist/wisconsin/trails',{withFileTypes:true}).filter(e=>e.isDirectory());
const mnTrails=readdirSync('dist/minnesota/trails',{withFileTypes:true}).filter(e=>e.isDirectory());
const wiRegions=readdirSync('dist/wisconsin/regions',{withFileTypes:true}).filter(e=>e.isDirectory());
const mnRegions=readdirSync('dist/minnesota/regions',{withFileTypes:true}).filter(e=>e.isDirectory());
if(wiTrails.length!==51) fail(`expected 51 Wisconsin trail pages, found ${wiTrails.length}`);
if(mnTrails.length!==60) fail(`expected 60 Minnesota trail pages, found ${mnTrails.length}`);
if(wiRegions.length!==9) fail(`expected 9 Wisconsin regional boards, found ${wiRegions.length}`);
if(mnRegions.length!==9) fail(`expected 9 Minnesota regional boards, found ${mnRegions.length}`);

for(const entry of wiTrails){
  const html=readFileSync(path.join('dist','wisconsin','trails',entry.name,'index.html'),'utf8');
  const canonical=`https://xcski.chrisizworski.com/wisconsin/trails/${entry.name}/`;
  if(!html.includes(`<link rel="canonical" href="${canonical}">`)) fail(`Wisconsin trail canonical missing: ${entry.name}`);
  if(!html.includes('Check ')||!html.includes('Nearby Wisconsin options')) fail(`Wisconsin trail source/nearby layer missing: ${entry.name}`);
  if(!html.includes('/xc-intelligence.js')||!html.includes('/state-xc.js')) fail(`Wisconsin shared engine missing: ${entry.name}`);
}
for(const entry of mnTrails){
  const html=readFileSync(path.join('dist','minnesota','trails',entry.name,'index.html'),'utf8');
  const canonical=`https://xcski.chrisizworski.com/minnesota/trails/${entry.name}/`;
  if(!html.includes(`<link rel="canonical" href="${canonical}">`)) fail(`Minnesota trail canonical missing: ${entry.name}`);
  if(!html.includes('Check ')||!html.includes('Nearby Minnesota options')) fail(`Minnesota trail source/nearby layer missing: ${entry.name}`);
  if(!html.includes('/xc-intelligence.js')||!html.includes('/state-xc.js')) fail(`Minnesota shared engine missing: ${entry.name}`);
}
for(const entry of wiRegions){
  const html=readFileSync(path.join('dist','wisconsin','regions',entry.name,'index.html'),'utf8');
  if(!html.includes(`https://xcski.chrisizworski.com/wisconsin/regions/${entry.name}/`)) fail(`Wisconsin region canonical missing: ${entry.name}`);
  if(!html.includes('Best signals in this region')) fail(`Wisconsin regional board missing: ${entry.name}`);
}
for(const entry of mnRegions){
  const html=readFileSync(path.join('dist','minnesota','regions',entry.name,'index.html'),'utf8');
  if(!html.includes(`https://xcski.chrisizworski.com/minnesota/regions/${entry.name}/`)) fail(`Minnesota region canonical missing: ${entry.name}`);
  if(!html.includes('Best signals in this region')) fail(`Minnesota regional board missing: ${entry.name}`);
}

const wiUrls=(wiMap.match(/<loc>/g)||[]).length;
const mnUrls=(mnMap.match(/<loc>/g)||[]).length;
if(wiUrls!==61) fail(`expected 61 Wisconsin sitemap URLs, found ${wiUrls}`);
if(mnUrls!==70) fail(`expected 70 Minnesota sitemap URLs, found ${mnUrls}`);
if(!robots.includes('Sitemap: https://xcski.chrisizworski.com/wisconsin/sitemap.xml')) fail('Wisconsin sitemap not advertised in robots');
if(!robots.includes('Sitemap: https://xcski.chrisizworski.com/minnesota/sitemap.xml')) fail('Minnesota sitemap not advertised in robots');
if(!mi.includes('More Midwest XC boards')||!mi.includes('/wisconsin/')||!mi.includes('/minnesota/')) fail('Michigan sibling-state discovery links missing');

function visible(html){return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()}
function tokens(text){const stop=new Set(['cross','country','ski','skiing','trail','trails','conditions','state','today','modeled','snow','surface','system','systems','board','groomed','classic','skate','source','status','weather','window','best','official']);return new Set(text.split(' ').filter(w=>w.length>=5&&!stop.has(w)))}
function jaccard(a,b){const A=tokens(a),B=tokens(b);let intersection=0;for(const x of A) if(B.has(x)) intersection++;const union=new Set([...A,...B]).size;return union?intersection/union:1}
const similarity=jaccard(visible(wi),visible(mn));
if(similarity>0.72) fail(`Wisconsin/Minnesota homepage content too similar (${similarity.toFixed(2)})`);

const wiDesc=wi.match(/<meta name="description" content="([^"]+)"/)?.[1];
const mnDesc=mn.match(/<meta name="description" content="([^"]+)"/)?.[1];
if(!wiDesc||!mnDesc||wiDesc===mnDesc) fail('state meta descriptions are missing or duplicated');

console.log(`Sibling XC readiness: PASS — Wisconsin 51 trails/9 regions/61 URLs; Minnesota 60 trails/9 regions/70 URLs; shared engine with distinct state content (similarity ${similarity.toFixed(2)}).`);
