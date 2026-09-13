import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
for (const slug of ['wisconsin','minnesota']) {
  const dir = path.join(root, 'state-blueprints', slug);
  const basePath = path.join(dir, 'state-data.json');
  const expansionPath = path.join(dir, 'deep-expansion.json');
  const base = JSON.parse(await readFile(basePath, 'utf8'));
  const expansion = JSON.parse(await readFile(expansionPath, 'utf8'));

  const mergeUnique = (current, added, key) => {
    const map = new Map(current.map(item => [item[key], item]));
    for (const item of added || []) {
      if (map.has(item[key])) throw new Error(`${base.state} deep expansion duplicates ${key}: ${item[key]}`);
      map.set(item[key], item);
    }
    return [...map.values()];
  };

  base.regions = mergeUnique(base.regions || [], expansion.regionAdditions || [], 'id');
  base.trails = mergeUnique(base.trails || [], expansion.trails || [], 'id');
  base.faqs = [...(base.faqs || []), ...(expansion.faqAdditions || [])];
  base.depth = {
    expanded: expansion.updated,
    sourceBasis: expansion.sourceBasis || [],
    trailCount: base.trails.length,
    regionCount: base.regions.length
  };

  for (const trail of base.trails) {
    if (!base.regions.some(region => region.id === trail.region)) throw new Error(`${base.state} trail ${trail.id} references missing region ${trail.region}`);
    if (!Number.isFinite(trail.lat) || !Number.isFinite(trail.lon)) throw new Error(`${base.state} trail ${trail.id} missing weather coordinate`);
    if (!trail.sourceUrl || !trail.sourceProvider) throw new Error(`${base.state} trail ${trail.id} missing source provenance`);
  }

  await writeFile(basePath, JSON.stringify(base, null, 2) + '\n');
  console.log(`${base.state} deep XC data: ${base.trails.length} trails across ${base.regions.length} regions.`);
}
