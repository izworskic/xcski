import { cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'dist');
for(const slug of ['wisconsin','minnesota']){
  const file=path.join(out,slug,'index.html');
  let html=await readFile(file,'utf8');
  const state=slug==='wisconsin'?'Wisconsin':'Minnesota';
  const anchor=`<section class="state-panel" style="margin-top:18px"><h2>Major ${state} Nordic systems</h2>`;
  if(!html.includes(anchor)) throw new Error(`${state} map anchor missing`);
  const map=`<section class="state-panel state-map-shell"><div class="state-map-copy"><h2>${state} XC trail map</h2><p>Explore every system in the statewide board. Pins open the dedicated trail-intelligence page; map locations represent the ski property or system and may not be a precise trailhead.</p></div><div id="state-xc-map" class="state-map" role="region" aria-label="Map of ${state} cross country ski trail systems"></div></section>`;
  html=html.replace(anchor,map+anchor);
  html=html.replace('<link rel="stylesheet" href="/state-xc.css">','<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><link rel="stylesheet" href="/state-xc.css"><link rel="stylesheet" href="/state-xc-map.css">');
  html=html.replace('</body>','<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script src="/state-xc-map.js"></script></body>');
  await writeFile(file,html);
}
await cp(path.join(root,'state-xc-map.js'),path.join(out,'state-xc-map.js'));
await cp(path.join(root,'state-xc-map.css'),path.join(out,'state-xc-map.css'));
console.log('Added interactive statewide maps to Wisconsin and Minnesota XC homes.');
