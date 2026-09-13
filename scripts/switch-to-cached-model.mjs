import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.join(process.cwd(), 'dist');

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker missing`);
  const endStart = source.indexOf(endMarker, start);
  if (endStart < 0) throw new Error(`${label}: end marker missing`);
  const end = endStart + endMarker.length;
  return source.slice(0,start) + replacement + source.slice(end);
}

async function patchStateRuntime() {
  const file = path.join(out,'state-xc.js');
  let js = await readFile(file,'utf8');
  js = js.replace("if (!ctx || !window.XC_INTEL || !window.XC_FORECAST) return;", "if (!ctx || !window.XC_INTEL || !window.XC_FORECAST || !window.XC_MODEL) return;");
  js = replaceRange(
    js,
    "      const lats = ctx.trails.map(t=>t.lat).join(',');",
    "      renderForecastOutlook(rows);",
    `      const [modelPayload, liveLayer] = await Promise.all([\n        XC_MODEL.state(ctx.slug),\n        loadLiveStatus()\n      ]);\n      const modelById = XC_MODEL.byId(modelPayload);\n      const rows = ctx.trails.map(trail => {\n        const model = modelById.get(trail.id);\n        if (!model) return null;\n        const live = liveLayer.byTrail.get(trail.id) || null;\n        const source = sourceFor(trail, live);\n        return { ...trail, ...model.current, scoreDelta:model.delta, previousSurface:model.previousSurface, previousBestWindow:model.previousBestWindow, weekend:model.weekend, storm:model.storm, live, confidence:XC_INTEL.confidence(source,trail) };\n      }).filter(Boolean);\n      renderForecastOutlook(rows);`,
    'state board cache switch'
  );
  js = replaceRange(
    js,
    "      const t=ctx.trail;",
    "      const live = liveLayer.byTrail.get(t.id) || null;",
    `      const t=ctx.trail;\n      const [modelPayload, liveLayer] = await Promise.all([\n        XC_MODEL.state(ctx.slug),\n        loadLiveStatus()\n      ]);\n      const model = XC_MODEL.byId(modelPayload).get(t.id);\n      if (!model) throw new Error('cached model trail missing');\n      const intel=model.current;\n      const weekend=model.weekend;\n      const storm=model.storm;\n      const comparison={ delta:model.delta };\n      const live = liveLayer.byTrail.get(t.id) || null;`,
    'state trail cache switch'
  );
  js = js.replaceAll('Open-Meteo 8-day forecast','server-cached Open-Meteo 8-day model');
  await writeFile(file,js);
}

async function patchMichiganBoard() {
  const file = path.join(out,'decision-board.js');
  let js = await readFile(file,'utf8');
  js = js.replace('!window.XC_INTEL || !window.XC_FORECAST) return;', '!window.XC_INTEL || !window.XC_FORECAST || !window.XC_MODEL) return;');
  js = replaceRange(
    js,
    '      const lats = TRAILS.map(t => t.lat).join(",");',
    '      if (!rows.length) throw new Error("no trail weather returned");',
    `      const [modelPayload, registry] = await Promise.all([\n        XC_MODEL.state('michigan'),\n        loadSourceRegistry()\n      ]);\n      const modelById = XC_MODEL.byId(modelPayload);\n      const rows = TRAILS.map(trail => {\n        const model = modelById.get(trail.id);\n        if (!model) return null;\n        const source = registry.sources?.[trail.id] || null;\n        return {\n          ...trail,\n          ...model.current,\n          scoreDelta:model.delta,\n          previousSurface:model.previousSurface,\n          previousBestWindow:model.previousBestWindow,\n          weekend:model.weekend,\n          storm:model.storm,\n          profile:trailProfile(trail),\n          source,\n          confidence:XC_INTEL.confidence(source,trail)\n        };\n      }).filter(Boolean);\n      if (!rows.length) throw new Error("no cached trail model returned");`,
    'Michigan board cache switch'
  );
  js = js.replaceAll('Open-Meteo 8-day forecast','server-cached Open-Meteo 8-day model');
  await writeFile(file,js);
}

async function patchMidwestRuntime() {
  const file = path.join(out,'midwest-xc.js');
  let js = await readFile(file,'utf8');
  js = js.replace("if (!ctx || !Array.isArray(ctx.states) || !window.XC_INTEL || !window.XC_FORECAST) return;", "if (!ctx || !Array.isArray(ctx.states) || !window.XC_INTEL || !window.XC_FORECAST || !window.XC_MODEL) return;");
  js = replaceRange(
    js,
    '  async function fetchWeatherChunk',
    '  function eligible(row) {',
    `  async function loadState(state) {\n    const [modelPayload, liveLayer] = await Promise.all([\n      XC_MODEL.state(state.slug),\n      fetchLive(state)\n    ]);\n    const modelById = XC_MODEL.byId(modelPayload);\n    const rows = state.trails.map(trail => {\n      const model = modelById.get(trail.id);\n      if (!model) return null;\n      const live = liveLayer.byTrail.get(trail.id) || null;\n      return {\n        ...trail,\n        state:state.name,\n        stateSlug:state.slug,\n        timezone:state.timezone,\n        ...model.current,\n        scoreDelta:model.delta,\n        surfaceChanged:model.surfaceChanged,\n        bestWindowChanged:model.bestWindowChanged,\n        previousSurface:model.previousSurface,\n        previousBestWindow:model.previousBestWindow,\n        weekend:model.weekend,\n        storm:model.storm,\n        live\n      };\n    }).filter(Boolean);\n    if (!rows.length) throw new Error(\`no cached rows for \${state.name}\`);\n    return { state, rows, liveLayer };\n  }\n\n  function eligible(row) {`,
    'Midwest cache switch'
  );
  js = js.replaceAll('Open-Meteo 8-day weather','server-cached Open-Meteo 8-day model');
  await writeFile(file,js);
}

async function patchForecastPagesRuntime() {
  const file = path.join(out,'forecast-pages.js');
  let js = await readFile(file,'utf8');
  js = js.replace("if (!ctx || !Array.isArray(ctx.groups) || !window.XC_INTEL || !window.XC_FORECAST) return;", "if (!ctx || !Array.isArray(ctx.groups) || !window.XC_INTEL || !window.XC_FORECAST || !window.XC_MODEL) return;");
  js = replaceRange(
    js,
    '  async function fetchChunk',
    '  function weekendRows(rows){',
    `  async function loadGroup(group) {\n    const payload = await XC_MODEL.state(group.slug);\n    const modelById = XC_MODEL.byId(payload);\n    const rows = group.trails.map(trail => {\n      const model = modelById.get(trail.id);\n      if (!model) return null;\n      return { ...trail, state:group.name, stateSlug:group.slug, current:model.current, weekend:model.weekend, storm:model.storm };\n    }).filter(Boolean);\n    if (!rows.length) throw new Error(\`no cached forecast rows for \${group.name}\`);\n    return rows;\n  }\n\n  function weekendRows(rows){`,
    'forecast pages cache switch'
  );
  js = js.replaceAll('Open-Meteo 8-day forecast','server-cached Open-Meteo 8-day model');
  await writeFile(file,js);
}

async function patchMichiganTrailRuntime() {
  const file = path.join(out,'trail-page.js');
  let js = await readFile(file,'utf8');
  js = js.replace('if (!root || !window.XC_INTEL) return;', 'if (!root || !window.XC_INTEL || !window.XC_MODEL) return;');
  js = replaceRange(
    js,
    "      const [response, source] = await Promise.all([",
    "      const row = XC_INTEL.analyzeWeather(d);",
    `      const [modelPayload, source] = await Promise.all([\n        XC_MODEL.state('michigan'),\n        sourceForTrail()\n      ]);\n      const model = XC_MODEL.byId(modelPayload).get(trailId);\n      if (!model) throw new Error('cached model trail missing');\n      const row = model.current;`,
    'Michigan trail cache switch'
  );
  js = js.replaceAll('Open-Meteo ·','server-cached Open-Meteo ·');
  await writeFile(file,js);
}

async function patchMichiganRegionRuntime() {
  const file = path.join(out,'region-page.js');
  let js = await readFile(file,'utf8');
  js = js.replace("if (!root || !Array.isArray(trails) || !trails.length || !window.XC_INTEL) return;", "if (!root || !Array.isArray(trails) || !trails.length || !window.XC_INTEL || !window.XC_MODEL) return;");
  js = replaceRange(
    js,
    "      const lats = trails.map(t => t.lat).join(',');",
    "      });",
    `      const [modelPayload, sourceRegistry] = await Promise.all([\n        XC_MODEL.state('michigan'),\n        registry()\n      ]);\n      const modelById = XC_MODEL.byId(modelPayload);\n      const rows = trails.map(trail => {\n        const model = modelById.get(trail.id);\n        if (!model) return null;\n        const source = sourceRegistry.sources?.[trail.id] || null;\n        return { ...trail, ...model.current, confidence:XC_INTEL.confidence(source,trail) };\n      }).filter(Boolean);`,
    'Michigan region cache switch'
  );
  js = js.replaceAll('Open-Meteo + audited status sources','server-cached Open-Meteo + audited status sources');
  await writeFile(file,js);
}

await patchStateRuntime();
await patchMichiganBoard();
await patchMidwestRuntime();
await patchForecastPagesRuntime();
await patchMichiganTrailRuntime();
await patchMichiganRegionRuntime();
console.log('Switched all XC browser weather consumers to CDN-cached state model snapshots.');
