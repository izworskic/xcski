import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const fail = message => { throw new Error(message); };
const runtime = readFileSync('dist/xc-analytics.js','utf8');
const gaInjector = readFileSync('scripts/inject-ga4.mjs','utf8');

for (const event of [
  'xc_decision_surface_view',
  'xc_filter_use',
  'xc_decision_nav',
  'xc_trail_open',
  'xc_official_source',
  'xc_state_open',
  'xc_map_interact'
]) {
  if (!runtime.includes(`'${event}'`) && !runtime.includes(`"${event}"`)) fail(`analytics event missing: ${event}`);
}

for (const parameter of ['xc_state','xc_surface','trail_id','placement','rank','active_mode','provider_host','decision_target','destination_state']) {
  if (!runtime.includes(parameter)) fail(`analytics parameter missing: ${parameter}`);
}

if (!runtime.includes("window.gtag('event'")) fail('analytics must use the existing GA4 gtag queue');
if (!gaInjector.includes("G-Y5D2V2W7HN")) fail('existing GA4 measurement ID changed or missing');
if (/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|geolocation|getCurrentPosition|watchPosition|fingerprint/i.test(runtime)) {
  fail('XC analytics introduced direct network, storage, location, or fingerprint collection');
}
if (/href\s*:/i.test(runtime) && /emit\([^)]*href/i.test(runtime)) fail('full href must not be emitted as analytics data');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir,{withFileTypes:true})) {
    const full = path.join(dir,entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const htmlFiles = walk('dist');
if (htmlFiles.length < 150) fail(`unexpectedly small generated site: ${htmlFiles.length} HTML files`);
for (const file of htmlFiles) {
  const html = readFileSync(file,'utf8');
  if (!html.includes('<script src="/xc-analytics.js" defer></script>')) fail(`analytics runtime missing from ${file}`);
}

try { new Function(runtime); } catch (error) { fail(`XC analytics JavaScript invalid: ${error.message}`); }

console.log(`XC analytics readiness: PASS — ${htmlFiles.length} pages instrumented with aggregate decision-funnel events and no new storage/location collection.`);
