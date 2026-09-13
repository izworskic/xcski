const fs = require('node:fs');
const assert = require('node:assert/strict');

const apiText = fs.readFileSync('api/xc-model.js','utf8');
const client = fs.readFileSync('dist/xc-model-client.js','utf8');
const registry = require('../api/_xc-registry.cjs');
const engine = require('../api/_xc-shared-engine.cjs');
const handler = require('../api/xc-model.js');

assert.equal(registry.states.michigan.trails.length,61,'Michigan cache registry count');
assert.equal(registry.states.wisconsin.trails.length,51,'Wisconsin cache registry count');
assert.equal(registry.states.minnesota.trails.length,60,'Minnesota cache registry count');
assert.equal(typeof engine.XC_INTEL.compareYesterday,'function','shared intelligence engine unavailable server-side');
assert.equal(typeof engine.XC_FORECAST.weekendOutlook,'function','shared weekend engine unavailable server-side');
assert.equal(typeof engine.XC_FORECAST.stormWindow,'function','shared storm engine unavailable server-side');
assert(apiText.includes("VALID_STATES = new Set(['michigan','wisconsin','minnesota'])"),'fixed-scope cache boundary missing');
assert(apiText.includes('s-maxage=600'),'CDN fresh cache TTL missing');
assert(apiText.includes('stale-while-revalidate=1800'),'stale-while-revalidate missing');
assert(apiText.includes('stale-if-error=86400'),'stale-if-error protection missing');
assert(apiText.includes('Vercel-Cache-Tag'),'cache tags missing');
assert(client.includes('/api/xc-model?state='),'browser cache client endpoint missing');

for (const page of ['dist/index.html','dist/wisconsin/index.html','dist/minnesota/index.html','dist/midwest/index.html','dist/weekend/index.html','dist/midwest/storm-watch/index.html']) {
  const html = fs.readFileSync(page,'utf8');
  assert(html.includes('/xc-model-client.js'),`model client not injected: ${page}`);
}
for (const runtime of ['dist/decision-board.js','dist/state-xc.js','dist/midwest-xc.js','dist/forecast-pages.js','dist/trail-page.js','dist/region-page.js']) {
  const js = fs.readFileSync(runtime,'utf8');
  assert(js.includes('XC_MODEL.state('),`cached model not used: ${runtime}`);
  assert(!js.includes('fetch(XC_FORECAST.forecastQuery'),`direct forecast fetch remains: ${runtime}`);
  assert(!js.includes('fetch(XC_INTEL.forecastQuery'),`direct weather fetch remains: ${runtime}`);
}

function dates(start, count) {
  const base = Date.parse(`${start}T00:00:00Z`);
  return Array.from({length:count},(_,i)=>new Date(base+i*86400000).toISOString().slice(0,10));
}
function syntheticWeather() {
  const daily = dates('2026-01-12',11);
  const hours=[];
  for (const day of daily) for (let h=0;h<24;h++) hours.push(`${day}T${String(h).padStart(2,'0')}:00`);
  const n=hours.length;
  return {
    current:{ time:'2026-01-15T12:00', temperature_2m:-6 },
    hourly:{
      time:hours,
      temperature_2m:Array.from({length:n},(_,i)=>-8 + 3*Math.sin(i/24*Math.PI*2)),
      snow_depth:Array(n).fill(0.16),
      snowfall:Array.from({length:n},(_,i)=>i>=108&&i<120?0.22:0.01),
      rain:Array(n).fill(0),
      wind_speed_10m:Array(n).fill(7),
      cloud_cover:Array(n).fill(55)
    },
    daily:{
      time:daily,
      temperature_2m_max:Array(11).fill(-3),
      temperature_2m_min:Array(11).fill(-11),
      rain_sum:Array(11).fill(0),
      snowfall_sum:Array(11).fill(1.2)
    }
  };
}

const originalFetch = global.fetch;
let fetchCount=0;
global.fetch = async url => {
  fetchCount++;
  const parsed = new URL(url);
  const count=(parsed.searchParams.get('latitude')||'').split(',').filter(Boolean).length || 1;
  const payload=Array.from({length:count},()=>syntheticWeather());
  return { ok:true, status:200, async json(){ return count===1?payload[0]:payload; } };
};

function responseMock(){
  return {
    code:null, body:null, headers:{},
    setHeader(k,v){this.headers[k]=v;},
    status(code){this.code=code;return this;},
    json(body){this.body=body;return body;}
  };
}

(async()=>{
  const bad=responseMock();
  await handler({method:'GET',query:{state:'ohio'}},bad);
  assert.equal(bad.code,400,'arbitrary state should be rejected');

  const res=responseMock();
  await handler({method:'GET',query:{state:'wisconsin'}},res);
  assert.equal(res.code,200,'Wisconsin model endpoint failed');
  assert.equal(res.body.rows.length,51,'Wisconsin snapshot row count');
  assert.equal(fetchCount,2,'Wisconsin should use two upstream batches, not per-trail requests');
  assert.equal(res.headers['X-XC-Model-Cache'],'state-snapshot-v1','cache contract header missing');
  assert.match(res.headers['Vercel-CDN-Cache-Control'],/max-age=600/,'Vercel CDN cache header missing');
  assert.equal(typeof res.body.rows[0].current.snowScore,'number','server score missing');
  assert(res.body.rows[0].weekend && 'available' in res.body.rows[0].weekend,'server weekend model missing');
  assert(res.body.rows[0].storm && 'signal' in res.body.rows[0].storm,'server storm model missing');

  console.log('XC model cache: PASS — fixed state scopes, shared server engine, compact snapshots, two-batch Wisconsin cold fill, CDN SWR/error caching, and zero direct browser weather fetches.');
})().finally(()=>{global.fetch=originalFetch;}).catch(error=>{global.fetch=originalFetch;console.error(error);process.exit(1);});
