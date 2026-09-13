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

if(!wi.includes('<h1>Wisconsin Cross Country Ski Conditions</h1>')||!mn.includes('<h1>Minnesota Cross Country Ski Conditions</h1>')) fail('state H1 missing');
if(!wi.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/wisconsin/">')) fail('Wisconsin canonical missing');
if(!mn.includes('<link rel="canonical" href="https://xcski.chrisizworski.com/minnesota/">')) fail('Minnesota canonical missing');
if(!wi.includes('Travel Wisconsin')||!wi.includes('Birkie')||!wi.includes('Kettle Moraine')) fail('Wisconsin state-specific content missing');
if(!mn.includes('Great Minnesota Ski Pass')||!mn.includes('Twin Cities')||!mn.includes('North Shore')) fail('Minnesota state-specific content missing');
if(wi.includes('Great Minnesota Ski Pass')||mn.includes('Travel Wisconsin')) fail('state content leakage');
if(!wi.includes('51 launch systems')||!mn.includes('60 launch systems')) fail('deep coverage counts missing');
for(const html of [wi,mn]) for(const dep of ['/xc-intelligence.js','/xc-model-client.js','/state-xc.js']) if(!html.includes(dep)) fail(`sibling dependency missing: ${dep}`);
if(!runtime.includes('XC_MODEL.state(ctx.slug)')||!runtime.includes('XC_INTEL.confidence')) fail('sibling runtime not using cached shared model + confidence');
if(!runtime.includes("'America/Chicago'")) fail('Central Time context missing');
if(!runtime.includes('scoreDelta')||!runtime.includes('weekend:model.weekend')||!runtime.includes('storm:model.storm')) fail('cached change/forecast fields missing');
if(!runtime.includes("filter === 'northwoods'")||!runtime.includes("filter === 'ski-pass'")) fail('state-specific filters missing');
if(!css.includes('body.state-wisconsin')||!css.includes('body.state-minnesota')) fail('state visual identities missing');

for(const marker of ['Black River State Forest','Mirror Lake State Park','Willow River State Park','Point Beach State Forest','Wyalusing State Park','Interstate State Park']) if(!wi.includes(marker)) fail(`Wisconsin system missing: ${marker}`);
for(const marker of ['Magney-Snively Ski Trails','Movil Maze','Baker Park Reserve','Central Gunflint Trail Ski System','Gamehaven Park Ski Trails','Jay Cooke State Park']) if(!mn.includes(marker)) fail(`Minnesota system missing: ${marker}`);

const wiTrails=readdirSync('dist/wisconsin/trails',{withFileTypes:true}).filter(e=>e.isDirectory());
const mnTrails=readdirSync('dist/minnesota/trails',{withFileTypes:true}).filter(e=>e.isDirectory());
const wiRegions=readdirSync('dist/wisconsin/regions',{withFileTypes:true}).filter(e=>e.isDirectory());
const mnRegions=readdirSync('dist/minnesota/regions',{withFileTypes:true}).filter(e=>e.isDirectory());
if(wiTrails.length!==51||mnTrails.length!==60||wiRegions.length!==9||mnRegions.length!==9) fail('state trail/region page counts changed');
for(const [slug,entries] of [['wisconsin',wiTrails],['minnesota',mnTrails]]) for(const entry of entries){
  const html=readFileSync(path.join('dist',slug,'trails',entry.name,'index.html'),'utf8');
  if(!html.includes(`https://xcski.chrisizworski.com/${slug}/trails/${entry.name}/`)) fail(`${slug} trail canonical missing: ${entry.name}`);
  if(!html.includes('/xc-model-client.js')||!html.includes('/state-xc.js')) fail(`${slug} cached runtime missing: ${entry.name}`);
}
for(const [slug,entries] of [['wisconsin',wiRegions],['minnesota',mnRegions]]) for(const entry of entries){
  const html=readFileSync(path.join('dist',slug,'regions',entry.name,'index.html'),'utf8');
  if(!html.includes(`https://xcski.chrisizworski.com/${slug}/regions/${entry.name}/`)||!html.includes('Best signals in this region')) fail(`${slug} regional board missing: ${entry.name}`);
}
if((wiMap.match(/<loc>/g)||[]).length!==61) fail('Wisconsin sitemap count changed');
if((mnMap.match(/<loc>/g)||[]).length!==70) fail('Minnesota sitemap count changed');
if(!robots.includes('Sitemap: https://xcski.chrisizworski.com/wisconsin/sitemap.xml')||!robots.includes('Sitemap: https://xcski.chrisizworski.com/minnesota/sitemap.xml')) fail('state sitemaps not advertised');
if(!mi.includes('More Midwest XC boards')||!mi.includes('/wisconsin/')||!mi.includes('/minnesota/')) fail('Michigan sibling discovery missing');

function visible(html){return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()}
function tokens(text){const stop=new Set(['cross','country','ski','skiing','trail','trails','conditions','state','today','modeled','snow','surface','system','systems','board','groomed','classic','skate','source','status','weather','window','best','official']);return new Set(text.split(' ').filter(w=>w.length>=5&&!stop.has(w)))}
function jaccard(a,b){const A=tokens(a),B=tokens(b);let intersection=0;for(const x of A) if(B.has(x)) intersection++;const union=new Set([...A,...B]).size;return union?intersection/union:1}
const similarity=jaccard(visible(wi),visible(mn));
if(similarity>0.72) fail(`Wisconsin/Minnesota homepage content too similar (${similarity.toFixed(2)})`);
const wiDesc=wi.match(/<meta name="description" content="([^"]+)"/)?.[1];
const mnDesc=mn.match(/<meta name="description" content="([^"]+)"/)?.[1];
if(!wiDesc||!mnDesc||wiDesc===mnDesc) fail('state meta descriptions duplicated');
console.log(`Sibling XC readiness: PASS — Wisconsin 51/9, Minnesota 60/9, cached shared model with distinct content (similarity ${similarity.toFixed(2)}).`);
