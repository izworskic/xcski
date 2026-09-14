import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const fail=message=>{throw new Error(message)};
const forecast=readFileSync('dist/xc-forecast.js','utf8');
const intel=readFileSync('dist/xc-intelligence.js','utf8');
const mi=readFileSync('dist/index.html','utf8');
const wi=readFileSync('dist/wisconsin/index.html','utf8');
const mn=readFileSync('dist/minnesota/index.html','utf8');
const mw=readFileSync('dist/midwest/index.html','utf8');
const mwWeekend=readFileSync('dist/midwest/weekend/index.html','utf8');
const mwStorm=readFileSync('dist/midwest/storm-watch/index.html','utf8');
const board=readFileSync('dist/decision-board.js','utf8');
const state=readFileSync('dist/state-xc.js','utf8');
const midwest=readFileSync('dist/midwest-xc.js','utf8');
const forecastPages=readFileSync('dist/forecast-pages.js','utf8');
const api=readFileSync('api/xc-model.js','utf8');
const serverEngine=readFileSync('api/_xc-shared-engine.cjs','utf8');

for(const marker of ['function weekendOutlook','function stormWindow','forecast_days=8','rolling.totalIn < 1.5','depth >= 2.0','temp <= 32','rain6 < 0.03','warm3','rain3 >= 0.10','forecastConfidence','betterDay']) if(!forecast.includes(marker)) fail(`forecast engine marker missing: ${marker}`);
for(const [name,html] of [['Michigan',mi],['Wisconsin',wi],['Minnesota',mn],['Midwest',mw]]) {
  if(!html.includes('/xc-forecast.js')) fail(`${name} missing shared forecast runtime`);
  if(!html.includes('/xc-model-client.js')) fail(`${name} missing cached model client`);
}
if(!serverEngine.includes('xc-intelligence.js')||!serverEngine.includes('xc-forecast.js')) fail('server is not executing shared browser engines');
if(!api.includes('XC_INTEL.compareYesterday')||!api.includes('XC_FORECAST.weekendOutlook')||!api.includes('XC_FORECAST.stormWindow')) fail('cache endpoint missing shared forecast calculations');
if(!board.includes('weekend:model.weekend')||!board.includes('storm:model.storm')) fail('Michigan board not consuming cached weekend/storm fields');
if(!state.includes('weekend:model.weekend')||!state.includes('storm:model.storm')) fail('state boards not consuming cached weekend/storm fields');
if(!midwest.includes('weekendDirection')||!midwest.includes("storm?.signal === 'storm-window'")) fail('Midwest state radar is not consuming weekend/storm summaries');
if(!mw.includes('/midwest/weekend/')||!mw.includes('/midwest/storm-watch/')) fail('Midwest gateway forecast paths missing');
if(!mwWeekend.includes('Midwest XC Skiing This Weekend')||!mwStorm.includes('Midwest XC Storm Watch')) fail('Midwest dedicated weekend/storm pages missing');
if(!forecastPages.includes("ctx.mode==='weekend'")||!forecastPages.includes("ctx.mode==='storm'")) fail('dedicated forecast page modes missing');
if(!board.includes('Modeled weather/snow comparison only')||!state.includes('current grooming cannot be projected')||!mw.includes('Modeled snow and future windows are screening tools')) fail('forecast trust-boundary language missing');
for(const slug of ['wisconsin','minnesota']) {
  const trailDir=path.join('dist',slug,'trails');
  const sample=readdirSync(trailDir,{withFileTypes:true}).find(e=>e.isDirectory());
  if(!sample) fail(`${slug} trail pages missing`);
  const html=readFileSync(path.join(trailDir,sample.name,'index.html'),'utf8');
  if(!html.includes('/xc-forecast.js')||!html.includes('/xc-model-client.js')) fail(`${slug} trail forecast/cache runtime missing`);
}
if(/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition/i.test(forecast+board+state+midwest+intel)) fail('forecast engine introduced browser-state collection');
try{new Function(forecast);new Function(board);new Function(state);new Function(midwest);new Function(forecastPages)}catch(error){fail(`forecast JavaScript invalid: ${error.message}`)}
console.log('XC forecast readiness: PASS — shared 8-day/weekend/storm engine computes server-side; state pages consume it directly while Midwest reserves cross-state comparison for dedicated weekend/storm travel decisions.');
