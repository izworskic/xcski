import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.join(process.cwd(), 'dist');

function sectionBounds(html, needle) {
  const start = html.indexOf(needle);
  if (start < 0) return null;
  const end = html.indexOf('</section>', start);
  if (end < 0) return null;
  return { start, end: end + '</section>'.length, text: html.slice(start, end + '</section>'.length) };
}

function insertAfterSection(html, needle, addition) {
  const bounds = sectionBounds(html, needle);
  if (!bounds) throw new Error(`section missing: ${needle}`);
  return html.slice(0, bounds.end) + addition + html.slice(bounds.end);
}

async function patchStateHome(slug) {
  const file = path.join(out, slug, 'index.html');
  let html = await readFile(file, 'utf8');
  const identity = sectionBounds(html, '<section class="state-identity">');
  const board = sectionBounds(html, '<section class="state-panel"><div class="state-board-head">');
  if (!identity || !board) throw new Error(`${slug} production sections missing`);

  if (identity.start < board.start) {
    const identityText = identity.text;
    html = html.slice(0, identity.start) + html.slice(identity.end);
    const newBoard = sectionBounds(html, '<section class="state-panel"><div class="state-board-head">');
    html = html.slice(0, newBoard.end) + identityText + html.slice(newBoard.end);
  }

  const base = `/${slug}/`;
  const quick = `<nav class="xc-quicknav" aria-label="Quick XC decisions"><a href="#state-live-board">Today</a><a href="${base}weekend/">This weekend</a><a href="${base}storm-watch/">Storm watch</a><a href="#state-regions">Regions</a></nav>`;
  if (!html.includes('aria-label="Quick XC decisions"')) html = insertAfterSection(html, '<section class="state-hero">', quick);
  html = html.replace('<div class="state-regions">', '<div class="state-regions" id="state-regions">');
  html = html.replace('<div id="state-live-board">', '<div id="state-live-board" aria-live="polite">');
  await writeFile(file, html);
}

async function patchMidwestHome() {
  const file = path.join(out, 'midwest', 'index.html');
  let html = await readFile(file, 'utf8');
  const summary = sectionBounds(html, '<section id="midwest-state-summary"');
  const board = sectionBounds(html, '<section class="midwest-panel">');
  if (!summary || !board) throw new Error('Midwest production sections missing');
  if (summary.start < board.start) {
    const summaryText = summary.text;
    html = html.slice(0, summary.start) + html.slice(summary.end);
    const newBoard = sectionBounds(html, '<section class="midwest-panel">');
    html = html.slice(0, newBoard.end) + summaryText + html.slice(newBoard.end);
  }
  const quick = '<nav class="xc-quicknav" aria-label="Quick Midwest XC decisions"><a href="#midwest-board">Today</a><a href="/midwest/weekend/">This weekend</a><a href="/midwest/storm-watch/">Storm watch</a><a href="/">Michigan</a><a href="/wisconsin/">Wisconsin</a><a href="/minnesota/">Minnesota</a></nav>';
  if (!html.includes('aria-label="Quick Midwest XC decisions"')) html = insertAfterSection(html, '<section class="midwest-hero">', quick);
  html = html.replace('<div id="midwest-board">', '<div id="midwest-board" aria-live="polite">');
  await writeFile(file, html);
}

async function patchForecastPage(file) {
  let html = await readFile(file, 'utf8');
  const contextMatch = html.match(/<script>window\.XC_FORECAST_PAGE=(\{[\s\S]*?\});<\/script>/);
  if (!contextMatch) return;
  const ctx = JSON.parse(contextMatch[1]);
  const home = ctx.groups.length === 3 ? '/midwest/' : ctx.groups[0].slug === 'michigan' ? '/' : `/${ctx.groups[0].slug}/`;
  const weekend = home === '/' ? '/weekend/' : `${home}weekend/`;
  const storm = home === '/' ? '/storm-watch/' : `${home}storm-watch/`;
  const quick = `<nav class="xc-quicknav forecast-quicknav" aria-label="Quick XC forecast decisions"><a href="${home}">Today</a><a href="${weekend}">This weekend</a><a href="${storm}">Storm watch</a></nav>`;
  if (!html.includes('aria-label="Quick XC forecast decisions"')) html = insertAfterSection(html, '<section class="forecast-hero">', quick);

  const picks = [];
  if (ctx.groups.length === 3) {
    for (const group of ctx.groups) picks.push(...group.trails.slice(0, 4).map(t => ({ ...t, group: group.name })));
  } else {
    const group = ctx.groups[0];
    picks.push(...group.trails.slice(0, 12).map(t => ({ ...t, group: group.name })));
  }
  const links = picks.map(t => `<a href="${t.href}"><strong>${String(t.name).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</strong><span>${String(t.town || t.group).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')} · ${t.group}</span></a>`).join('');
  const coverage = `<section class="forecast-panel forecast-coverage"><h2>Explore systems covered by this forecast</h2><p>These are static trail links for planning and search discovery; the ranking above remains live and weather-driven.</p><div class="forecast-coverage-grid">${links}</div></section>`;
  if (!html.includes('class="forecast-panel forecast-coverage"')) {
    const panel = sectionBounds(html, '<section class="forecast-panel">');
    if (!panel) throw new Error(`forecast panel missing: ${file}`);
    html = html.slice(0, panel.end) + coverage + html.slice(panel.end);
  }
  html = html.replace('<div id="forecast-page-board">', '<div id="forecast-page-board" aria-live="polite">');
  await writeFile(file, html);
}

async function patchForecastPages() {
  const files = [
    path.join(out,'weekend','index.html'), path.join(out,'storm-watch','index.html'),
    path.join(out,'wisconsin','weekend','index.html'), path.join(out,'wisconsin','storm-watch','index.html'),
    path.join(out,'minnesota','weekend','index.html'), path.join(out,'minnesota','storm-watch','index.html'),
    path.join(out,'midwest','weekend','index.html'), path.join(out,'midwest','storm-watch','index.html')
  ];
  for (const file of files) await patchForecastPage(file);
}

async function appendCss(file, css) {
  const current = await readFile(file, 'utf8');
  if (!current.includes('/* production-audit-pass */')) await writeFile(file, `${current.trimEnd()}\n/* production-audit-pass */\n${css}\n`);
}

async function patchStyles() {
  const quick = `.xc-quicknav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px;padding:0}.xc-quicknav a{display:inline-flex;align-items:center;min-height:42px;padding:8px 12px;border:1px solid var(--line,#d6e1e6);border-radius:999px;background:#fff;text-decoration:none;font-size:.8rem;font-weight:800}`;
  await appendCss(path.join(out,'state-xc.css'), `${quick}\n.state-identity{margin-top:18px}.state-filters button{min-height:42px}\n@media(max-width:780px){.state-hero{padding:28px 0 18px}.state-hero h1{font-size:clamp(2.1rem,11vw,3.45rem)}.state-identity{margin-top:14px}.state-decision-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.state-decision-grid span{display:none}.state-decision-grid>div{padding:8px}.state-decision-grid strong{font-size:.8rem}.state-metrics>span{min-width:calc(50% - 4px);flex:1}.xc-quicknav{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}.xc-quicknav a{white-space:nowrap;min-height:44px}}`);
  await appendCss(path.join(out,'midwest-xc.css'), `${quick.replace('var(--line,#d6e1e6)','var(--mw-line)')}\n.midwest-state-summary{margin-top:18px}.midwest-tabs button{min-height:42px}\n@media(max-width:780px){.midwest-hero{padding:28px 0 18px}.midwest-hero h1{font-size:clamp(2.15rem,11vw,3.55rem)}.midwest-decision span{display:none}.midwest-state-summary{margin-top:14px}.xc-quicknav{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}.xc-quicknav a{white-space:nowrap;min-height:44px}}`);
  await appendCss(path.join(out,'forecast-pages.css'), `${quick.replace('var(--line,#d6e1e6)','var(--fp-line)')}\n.forecast-coverage{margin-top:18px}.forecast-coverage>p{color:var(--fp-muted);font-size:.84rem}.forecast-coverage-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.forecast-coverage-grid a{display:block;border:1px solid var(--fp-line);border-radius:11px;padding:11px;text-decoration:none;background:var(--fp-soft)}.forecast-coverage-grid strong,.forecast-coverage-grid span{display:block}.forecast-coverage-grid strong{color:var(--fp-ink);font-size:.86rem}.forecast-coverage-grid span{color:var(--fp-muted);font-size:.72rem;margin-top:2px}\n@media(max-width:780px){.forecast-hero{padding:28px 0 18px}.forecast-hero h1{font-size:clamp(2.1rem,11vw,3.45rem)}.forecast-grid{grid-template-columns:1fr 1fr}.forecast-grid>div:last-child{grid-column:1/-1}.forecast-coverage-grid{grid-template-columns:1fr 1fr}.xc-quicknav{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}.xc-quicknav a{white-space:nowrap;min-height:44px}}`);
  await appendCss(path.join(out,'decision-board.css'), `${quick}\n.ski-board-filters button{min-height:42px}\n@media(max-width:720px){.ski-decision-strip{grid-template-columns:repeat(3,minmax(0,1fr))}.ski-decision-strip span{display:none}.ski-decision-strip>div{padding:8px}.ski-decision-strip strong{font-size:.8rem}.xc-quicknav{flex-wrap:nowrap;overflow-x:auto}.xc-quicknav a{white-space:nowrap;min-height:44px}}`);
}

async function patchGracefulDegradation() {
  const mwPath = path.join(out,'midwest-xc.js');
  let mw = await readFile(mwPath,'utf8');
  const oldMw = `      const results = await Promise.all(ctx.states.map(loadState));\n      const rows = results.flatMap(result => result.rows);\n      if (rows.length !== ctx.totalTrails) throw new Error(\`expected \${ctx.totalTrails} rows, got \${rows.length}\`);`;
  const newMw = `      const settled = await Promise.allSettled(ctx.states.map(loadState));\n      const results = settled.filter(result => result.status === 'fulfilled').map(result => result.value);\n      const failedStates = settled.map((result,index) => result.status === 'rejected' ? ctx.states[index].name : null).filter(Boolean);\n      const rows = results.flatMap(result => result.rows);\n      if (!rows.length) throw new Error('no state weather returned');`;
  if (!mw.includes(oldMw)) throw new Error('Midwest all-or-nothing load contract changed');
  mw = mw.replace(oldMw,newMw);
  mw = mw.replace("if (freshness) freshness.textContent = `Open-Meteo 8-day weather · same-local-hour change since yesterday · weekend + storm-window intelligence · ${liveCount} fresh official provider update${liveCount===1?'':'s'} · ${pending} provider permission${pending===1?'':'s'} pending.`;", "if (freshness) freshness.textContent = `Open-Meteo 8-day weather · ${rows.length}/${ctx.totalTrails} systems loaded · same-local-hour change since yesterday · weekend + storm-window intelligence · ${liveCount} fresh official provider update${liveCount===1?'':'s'} · ${pending} provider permission${pending===1?'':'s'} pending${failedStates.length ? ` · partial: ${failedStates.join(', ')} unavailable` : ''}.`;" );
  mw = mw.replace("if (status) status.textContent = 'Live Midwest board';", "if (status) status.textContent = failedStates.length ? 'Live Midwest board · partial' : 'Live Midwest board';");
  await writeFile(mwPath,mw);

  const fpPath = path.join(out,'forecast-pages.js');
  let fp = await readFile(fpPath,'utf8');
  const oldFp = `      const groups=await Promise.all(ctx.groups.map(loadGroup));\n      const rows=groups.flat();\n      if(rows.length!==ctx.totalTrails) throw new Error(\`expected \${ctx.totalTrails} rows, got \${rows.length}\`);`;
  const newFp = `      const settled=await Promise.allSettled(ctx.groups.map(loadGroup));\n      const groups=settled.filter(result=>result.status==='fulfilled').map(result=>result.value);\n      const failedGroups=settled.map((result,index)=>result.status==='rejected'?ctx.groups[index].name:null).filter(Boolean);\n      const rows=groups.flat();\n      if(!rows.length) throw new Error('no forecast groups returned');`;
  if (!fp.includes(oldFp)) throw new Error('Forecast all-or-nothing load contract changed');
  fp = fp.replace(oldFp,newFp);
  fp = fp.replace("if(freshness) freshness.textContent=`Open-Meteo 8-day forecast · ${rows.length} systems · state-local timing · modeled forecast only, not grooming/open status.`;", "if(freshness) freshness.textContent=`Open-Meteo 8-day forecast · ${rows.length}/${ctx.totalTrails} systems loaded · state-local timing · modeled forecast only, not grooming/open status${failedGroups.length?` · partial: ${failedGroups.join(', ')} unavailable`:''}.`;" );
  fp = fp.replace("if(status) status.textContent=ctx.mode==='weekend'?'Weekend outlook':'7-day storm watch';", "if(status) status.textContent=(ctx.mode==='weekend'?'Weekend outlook':'7-day storm watch') + (failedGroups.length?' · partial':'');");
  await writeFile(fpPath,fp);
}

await patchStateHome('wisconsin');
await patchStateHome('minnesota');
await patchMidwestHome();
await patchForecastPages();
await patchStyles();
await patchGracefulDegradation();
console.log('Production audit pass: decision-first hierarchy, compact mobile UX, crawlable forecast coverage, accessibility, and graceful partial-state rendering applied.');
