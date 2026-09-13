import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const fail = message => { throw new Error(message); };
const forecast = readFileSync('dist/xc-forecast.js','utf8');
const intel = readFileSync('dist/xc-intelligence.js','utf8');
const mi = readFileSync('dist/index.html','utf8');
const wi = readFileSync('dist/wisconsin/index.html','utf8');
const mn = readFileSync('dist/minnesota/index.html','utf8');
const mw = readFileSync('dist/midwest/index.html','utf8');
const board = readFileSync('dist/decision-board.js','utf8');
const state = readFileSync('dist/state-xc.js','utf8');
const midwest = readFileSync('dist/midwest-xc.js','utf8');

if (!forecast.includes('function weekendOutlook')) fail('weekend outlook engine missing');
if (!forecast.includes('function stormWindow')) fail('storm-window engine missing');
if (!forecast.includes('forecast_days=8')) fail('8-day forecast horizon missing');
if (!forecast.includes("rolling.totalIn < 1.5")) fail('meaningful storm threshold missing');
if (!forecast.includes('depth >= 2.0') || !forecast.includes('temp <= 32') || !forecast.includes('rain6 < 0.03')) fail('cold/dry ski-window gate missing');
if (!forecast.includes('windowEnd') || !forecast.includes('warm3') || !forecast.includes('rain3 >= 0.10')) fail('thaw/rain window closure logic missing');
if (!forecast.includes('forecastConfidence')) fail('forecast lead-time confidence missing');
if (!forecast.includes("betterDay")) fail('Saturday/Sunday comparison missing');

for (const [name,html] of [['Michigan',mi],['Wisconsin',wi],['Minnesota',mn],['Midwest',mw]]) {
  if (!html.includes('/xc-forecast.js')) fail(`${name} page missing shared forecast runtime`);
}
if (!board.includes('XC_FORECAST.weekendOutlook') || !board.includes('XC_FORECAST.stormWindow')) fail('Michigan board not using weekend/storm engine');
if (!state.includes('XC_FORECAST.weekendOutlook') || !state.includes('XC_FORECAST.stormWindow')) fail('state boards not using weekend/storm engine');
if (!midwest.includes("mode === 'weekend'") || !midwest.includes("mode === 'storm'")) fail('Midwest weekend/storm modes missing');
if (!mw.includes('data-midwest-mode="weekend"') || !mw.includes('data-midwest-mode="storm"')) fail('Midwest weekend/storm controls missing');
if (!board.includes('Modeled weather/snow comparison only') || !state.includes('current grooming cannot be projected') || !mw.includes('It is not a grooming prediction')) fail('forecast trust-boundary language missing');

for (const slug of ['wisconsin','minnesota']) {
  const trailDir = path.join('dist',slug,'trails');
  const sample = readdirSync(trailDir,{withFileTypes:true}).find(e=>e.isDirectory());
  if (!sample) fail(`${slug} trail pages missing`);
  const html = readFileSync(path.join(trailDir,sample.name,'index.html'),'utf8');
  if (!html.includes('/xc-forecast.js')) fail(`${slug} trail pages missing forecast runtime`);
}

if (/localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition/i.test(forecast + board + state + midwest + intel)) fail('forecast engine introduced browser-state/location collection');
try { new Function(forecast); new Function(board); new Function(state); new Function(midwest); } catch (error) { fail(`forecast JavaScript invalid: ${error.message}`); }

console.log('XC forecast readiness: PASS — 8-day weekend comparison, storm-window opening/closure logic, shared state/Midwest runtime, and trust boundaries enforced.');
