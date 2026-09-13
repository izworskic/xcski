import { readFileSync } from 'node:fs';
import path from 'node:path';

const fail=m=>{throw new Error(m)};
const states={
  wisconsin:{intents:['snowmaking','northwoods','state-parks','night-skiing'],home:'dist/wisconsin/index.html'},
  minnesota:{intents:['snowmaking','ski-pass','twin-cities','night-skiing'],home:'dist/minnesota/index.html'}
};
const robots=readFileSync('dist/robots.txt','utf8');
for(const [state,cfg] of Object.entries(states)){
  const home=readFileSync(cfg.home,'utf8');
  if(!home.includes(`${state==='wisconsin'?'Wisconsin':'Minnesota'} decision boards`)) fail(`${state} decision-board links missing from home`);
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
console.log('Deep XC intent readiness: PASS — 8 distinct state decision boards with separate canonicals and intent sitemaps.');
