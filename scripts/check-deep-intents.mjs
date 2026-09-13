import { readFileSync } from 'node:fs';
import path from 'node:path';

const fail=m=>{throw new Error(m)};
const states={
  wisconsin:{intents:['snowmaking','northwoods','state-parks','night-skiing'],home:'dist/wisconsin/index.html',label:'Wisconsin'},
  minnesota:{intents:['snowmaking','ski-pass','twin-cities','night-skiing'],home:'dist/minnesota/index.html',label:'Minnesota'}
};
const robots=readFileSync('dist/robots.txt','utf8');
const mapJs=readFileSync('dist/state-xc-map.js','utf8');
const mapCss=readFileSync('dist/state-xc-map.css','utf8');
if(!mapJs.includes('tile.openstreetmap.org')||!mapJs.includes('fitBounds')) fail('shared state map runtime incomplete');
if(!mapCss.includes('.state-map')) fail('shared state map styles missing');
for(const [state,cfg] of Object.entries(states)){
  const home=readFileSync(cfg.home,'utf8');
  if(!home.includes(`${cfg.label} decision boards`)) fail(`${state} decision-board links missing from home`);
  if(!home.includes('id="state-xc-map"')) fail(`${state} statewide map missing from home`);
  if(!home.includes(`aria-label="Map of ${cfg.label} cross country ski trail systems"`)) fail(`${state} map accessibility label missing`);
  if(!home.includes('/state-xc-map.js')||!home.includes('/state-xc-map.css')) fail(`${state} map assets missing`);
  const intentMap=readFileSync(path.join('dist',state,'intent-sitemap.xml'),'utf8');
  if((intentMap.match(/<loc>/g)||[]).length!==4) fail(`${state} intent sitemap must contain 4 URLs`);
  if(!robots.includes(`Sitemap: https://xcski.chrisizworski.com/${state}/intent-sitemap.xml`)) fail(`${state} intent sitemap missing from robots`);
  for(const slug of cfg.intents){
    const html=readFileSync(path.join('dist',state,slug,'index.html'),'utf8');
    const canonical=`https://xcski.chrisizworski.com/${state}/${slug}/`;
    if(!html.includes(`<link rel="canonical" href="${canonical}">`)) fail(`${state}/${slug} canonical missing`);
    if(!html.includes('id="state-live-board"')) fail(`${state}/${slug} live board missing`);
    if(!html.includes('/xc-intelligence.js')||!html.includes('/state-xc.js')) fail(`${state}/${slug} shared engine missing`);
    if(!html.includes('matching systems')) fail(`${state}/${slug} matching-system directory missing`);
  }
}
console.log('Deep XC readiness: PASS — 8 distinct decision boards, separate intent sitemaps, and statewide Wisconsin/Minnesota maps.');
