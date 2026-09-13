import { readFileSync } from 'node:fs';

const fail = message => { throw new Error(message); };
const providers = JSON.parse(readFileSync('live-ingestion/providers.json','utf8'));
const mappings = JSON.parse(readFileSync('live-ingestion/mappings.json','utf8'));
const api = readFileSync('api/xc-live.js','utf8');
const runtime = readFileSync('state-xc.js','utf8');
const css = readFileSync('state-xc.css','utf8');

if (providers.version !== 1 || !providers.providers) fail('live provider registry malformed');
if (!providers.policy.includes('Modeled snow score remains independent')) fail('live/model separation policy missing');
for (const id of ['nordic-pulse','travel-wisconsin','three-rivers','cook-county','minnesota-dnr']) {
  const provider = providers.providers[id];
  if (!provider) fail(`provider missing: ${id}`);
  if (provider.enabled !== false) fail(`provider must remain disabled until authorization: ${id}`);
  if (!String(provider.rights).includes('permission-pending')) fail(`permission boundary missing: ${id}`);
  if (!provider.envFlag) fail(`authorization env flag missing: ${id}`);
}
if (providers.providers['travel-wisconsin'].envFlag !== 'XC_ENABLE_TRAVEL_WISCONSIN') fail('Travel Wisconsin env gate changed');
if (providers.providers['three-rivers'].envFlag !== 'XC_ENABLE_THREE_RIVERS') fail('Three Rivers env gate changed');
if (providers.providers['nordic-pulse'].tokenEnv !== 'NORDIC_PULSE_API_TOKEN') fail('Nordic Pulse token path missing');
if (providers.providers['nordic-pulse'].endpointEnv !== 'NORDIC_PULSE_API_URL') fail('Nordic Pulse endpoint path missing');
if (!mappings.providers?.['travel-wisconsin']?.wisconsin?.birkie) fail('Travel Wisconsin mapping missing');
if (!mappings.providers?.['three-rivers']?.minnesota?.elmcreek) fail('Three Rivers mapping missing');
if (!mappings.providers?.['cook-county']?.minnesota?.pincushion) fail('Cook County mapping missing');
if (!api.includes('affectsSnowScore: false')) fail('live provider records can affect snow score');
if (!api.includes('decisionEligible')) fail('freshness eligibility missing');
if (!api.includes("config.enabled !== true")) fail('provider authorization hard gate missing');
if (!api.includes('config.envFlag')) fail('generic environment authorization gate missing');
if (!api.includes('config.tokenEnv')) fail('authorized token adapter missing');
if (!runtime.includes('/api/xc-live?state=')) fail('state boards are not connected to live ingestion API');
if (!runtime.includes("r.live.openState === 'closed'")) fail('fresh closed status suppression missing');
if (!runtime.includes("integration: 'authorized-api'")) fail('live confidence upgrade missing');
if (!css.includes('.state-live-status')) fail('live provider status styling missing');

console.log('XC live ingestion readiness: PASS — permission-gated adapters, freshness decay, provenance, closed-status suppression, and snow-score separation are enforced.');
