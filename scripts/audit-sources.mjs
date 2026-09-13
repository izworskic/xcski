import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const html = await readFile(path.join(out, 'index.html'), 'utf8');
const overrides = JSON.parse(await readFile(path.join(root, 'grooming-sources.json'), 'utf8'));
const trailsMatch = html.match(/const TRAILS = (\[[\s\S]*?\]);\nconst COLORS/);
if (!trailsMatch) throw new Error('TRAILS dataset missing for source audit');
const trails = JSON.parse(trailsMatch[1]);
if (trails.length !== 61) throw new Error(`Expected 61 statewide trails, found ${trails.length}`);

const strip = (s = '') => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function cardData(trail) {
  const id = trail.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<article class="card" id="t-${id}"[\\s\\S]*?<\\/article>`));
  if (!match) throw new Error(`Trail card missing for source audit: ${trail.id}`);
  const card = match[0];
  return {
    official: card.match(/<a class="ext" href="([^"]+)"/)?.[1] || '',
    description: strip(card.match(/<p class="desc">([\s\S]*?)<\/p>/)?.[1] || '')
  };
}

function classify(url, trail) {
  if (!url) return {
    sourceClass: 'none-registered',
    statusMode: 'none',
    provider: trail.cat === 'backcountry' ? 'Local land/access verification' : 'No dedicated source registered',
    label: trail.cat === 'backcountry' ? 'Access / local condition verification' : 'No dedicated current-status source registered',
    freshness: 'unknown',
    machineReadable: false
  };

  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host.endsWith('michigan.gov')) return { sourceClass:'land-manager-reference', statusMode:'land-manager-page', provider:'Michigan DNR', label:'Land-manager source', freshness:'varies', machineReadable:false };
  if (host.endsWith('fs.usda.gov')) return { sourceClass:'land-manager-reference', statusMode:'land-manager-page', provider:'U.S. Forest Service', label:'Land-manager source', freshness:'varies', machineReadable:false };
  if (host.endsWith('nps.gov')) return { sourceClass:'land-manager-reference', statusMode:'land-manager-page', provider:'National Park Service', label:'Land-manager source', freshness:'varies', machineReadable:false };
  if (host.endsWith('michigan.org')) return { sourceClass:'reference-only', statusMode:'reference-page', provider:'Michigan.org', label:'Reference page', freshness:'not a grooming feed', machineReadable:false };
  return { sourceClass:'operator-direct', statusMode:'operator-page', provider:'Trail operator / managing organization', label:'Direct operator source', freshness:'operator-controlled', machineReadable:false };
}

const sources = {};
for (const trail of trails) {
  const card = cardData(trail);
  const base = classify(card.official, trail);
  const override = overrides.sources?.[trail.id] || {};
  sources[trail.id] = {
    trailId: trail.id,
    trailName: trail.name,
    category: trail.cat,
    officialUrl: card.official || null,
    ...base,
    ...override,
    audited: '2026-09-13',
    currentIngested: override.integration === 'authorized-api' && override.liveData === true,
    weatherScoreIndependent: true
  };
}

const audit = {
  version: 3,
  updated: '2026-09-13',
  policy: 'All 61 statewide trails receive a source classification. Weather/snow scores are independent of source availability. External current values are ingested only when provider terms explicitly authorize API or machine use.',
  counts: Object.values(sources).reduce((acc, source) => {
    acc[source.sourceClass || source.kind || 'other'] = (acc[source.sourceClass || source.kind || 'other'] || 0) + 1;
    return acc;
  }, {}),
  sources
};

await writeFile(path.join(out, 'grooming-sources.json'), JSON.stringify(audit, null, 2) + '\n');
console.log(`Audited ${trails.length} statewide XC status sources across operator, land-manager, reference, and live-platform classes.`);
