import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'dist');
const states=[
  JSON.parse(await readFile(path.join(root,'state-blueprints/wisconsin/state-data.json'),'utf8')),
  JSON.parse(await readFile(path.join(root,'state-blueprints/minnesota/state-data.json'),'utf8'))
];
const intentSlugs={
  wisconsin:['snowmaking','northwoods','state-parks','night-skiing'],
  minnesota:['snowmaking','ski-pass','twin-cities','night-skiing']
};

let rootSitemap=await readFile(path.join(out,'sitemap.xml'),'utf8');
rootSitemap=rootSitemap.split('\n').filter(line=>!line.includes('xcski.chrisizworski.com/wisconsin/')&&!line.includes('xcski.chrisizworski.com/minnesota/')).join('\n');
await writeFile(path.join(out,'sitemap.xml'),rootSitemap);

for(const state of states){
  const urls=[
    `https://xcski.chrisizworski.com/${state.slug}/`,
    ...state.regions.map(r=>`https://xcski.chrisizworski.com/${state.slug}/regions/${r.id}/`),
    ...state.trails.map(t=>`https://xcski.chrisizworski.com/${state.slug}/trails/${t.id}/`)
  ];
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url,i)=>`<url><loc>${url}</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>${i===0?'0.95':'0.8'}</priority></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(path.join(out,state.slug,'sitemap.xml'),xml);

  const intentUrls=(intentSlugs[state.slug]||[]).map(slug=>`https://xcski.chrisizworski.com/${state.slug}/${slug}/`);
  const intentXml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${intentUrls.map(url=>`<url><loc>${url}</loc><lastmod>2026-09-13</lastmod><changefreq>daily</changefreq><priority>0.85</priority></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(path.join(out,state.slug,'intent-sitemap.xml'),intentXml);
}

let robots=await readFile(path.join(out,'robots.txt'),'utf8');
for(const state of states){
  for(const suffix of ['sitemap.xml','intent-sitemap.xml']){
    const line=`Sitemap: https://xcski.chrisizworski.com/${state.slug}/${suffix}`;
    if(!robots.includes(line)) robots=robots.trimEnd()+`\n${line}\n`;
  }
}
await writeFile(path.join(out,'robots.txt'),robots);
console.log('Separated Wisconsin and Minnesota state and intent sitemaps while preserving the Michigan sitemap contract.');
