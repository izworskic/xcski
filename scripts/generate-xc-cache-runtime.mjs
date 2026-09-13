import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const apiDir = path.join(root, 'api');
await mkdir(apiDir, { recursive: true });

const source = await readFile(path.join(root, 'index.html'), 'utf8');
const trailsMatch = source.match(/const TRAILS = (\[[\s\S]*?\]);\nconst COLORS/);
if (!trailsMatch) throw new Error('Base Michigan TRAILS dataset missing for cache registry');
const baseMichigan = JSON.parse(trailsMatch[1]);
const expansion = JSON.parse(await readFile(path.join(root, 'statewide-expansion.json'), 'utf8'));
if (baseMichigan.length !== 48 || expansion.trails?.length !== 13) throw new Error('Michigan cache registry requires 48 + 13 trails');

const michigan = [
  ...baseMichigan,
  ...expansion.trails.map(t => ({ id:t.id, name:t.name, town:t.town, lat:t.lat, lon:t.lon, cat:t.cat, lit:t.lit, rentals:t.rentals, skate:t.skate }))
];
const wisconsinData = JSON.parse(await readFile(path.join(root, 'state-blueprints/wisconsin/state-data.json'), 'utf8'));
const minnesotaData = JSON.parse(await readFile(path.join(root, 'state-blueprints/minnesota/state-data.json'), 'utf8'));
if (michigan.length !== 61) throw new Error(`Expected 61 Michigan cache trails, found ${michigan.length}`);
if (wisconsinData.trails?.length !== 51) throw new Error(`Expected 51 Wisconsin cache trails, found ${wisconsinData.trails?.length}`);
if (minnesotaData.trails?.length !== 60) throw new Error(`Expected 60 Minnesota cache trails, found ${minnesotaData.trails?.length}`);

const compactTrail = t => ({ id:t.id, name:t.name, town:t.town, lat:Number(t.lat), lon:Number(t.lon) });
const registry = {
  version: 1,
  generatedBy: 'scripts/generate-xc-cache-runtime.mjs',
  states: {
    michigan: { name:'Michigan', timezone:'America/Detroit', trails:michigan.map(compactTrail) },
    wisconsin: { name:'Wisconsin', timezone:'America/Chicago', trails:wisconsinData.trails.map(compactTrail) },
    minnesota: { name:'Minnesota', timezone:'America/Chicago', trails:minnesotaData.trails.map(compactTrail) }
  }
};
await writeFile(path.join(apiDir, '_xc-registry.cjs'), `module.exports = ${JSON.stringify(registry)};\n`);

const intel = await readFile(path.join(root, 'xc-intelligence.js'), 'utf8');
const forecast = await readFile(path.join(root, 'xc-forecast.js'), 'utf8');
const sharedEngine = `const vm = require('node:vm');\n` +
`const sandbox = { window:{}, console, Intl, Date, Math, Number, String, Array, Object, JSON, URL, Map, Set, parseInt, parseFloat, isFinite };\n` +
`vm.createContext(sandbox);\n` +
`vm.runInContext(${JSON.stringify(intel)}, sandbox, { filename:'xc-intelligence.js' });\n` +
`vm.runInContext(${JSON.stringify(forecast)}, sandbox, { filename:'xc-forecast.js' });\n` +
`if (!sandbox.window.XC_INTEL || !sandbox.window.XC_FORECAST) throw new Error('Shared XC engine failed to initialize');\n` +
`module.exports = { XC_INTEL:sandbox.window.XC_INTEL, XC_FORECAST:sandbox.window.XC_FORECAST };\n`;
await writeFile(path.join(apiDir, '_xc-shared-engine.cjs'), sharedEngine);

console.log('Generated server XC cache registry: MI 61, WI 51, MN 60 using the shared browser intelligence/forecast engines.');
