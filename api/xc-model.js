const registry = require('./_xc-registry.cjs');
const { XC_INTEL, XC_FORECAST } = require('./_xc-shared-engine.cjs');

const VALID_STATES = new Set(['michigan','wisconsin','minnesota']);
const CHUNK_SIZE = 40;

const round = (value, digits = 2) => {
  if (!Number.isFinite(Number(value))) return null;
  const p = 10 ** digits;
  return Math.round(Number(value) * p) / p;
};

function compactCurrent(row) {
  return {
    referenceTime: row.referenceTime || null,
    depth: round(row.depth),
    snow72: round(row.snow72),
    snow24: round(row.snow24),
    rain24: round(row.rain24),
    temp: round(row.temp, 1),
    maxToday: round(row.maxToday, 1),
    minToday: round(row.minToday, 1),
    rainToday: round(row.rainToday),
    snowTomorrow: round(row.snowTomorrow),
    freezeThaw: Boolean(row.freezeThaw),
    snowScore: Number(row.snowScore),
    surface: row.surface,
    bestWindow: row.bestWindow ? { label:row.bestWindow.label, score:row.bestWindow.score, detail:row.bestWindow.detail } : null
  };
}

function compactDay(day) {
  if (!day) return null;
  return {
    date: day.date,
    label: day.label,
    snowScore: Number(day.snowScore),
    surface: day.surface,
    bestWindow: day.bestWindow ? { label:day.bestWindow.label, score:day.bestWindow.score, detail:day.bestWindow.detail } : null,
    dailySnow: round(day.dailySnow),
    dailyRain: round(day.dailyRain),
    minToday: round(day.minToday, 1),
    maxToday: round(day.maxToday, 1)
  };
}

function compactWeekend(weekend) {
  if (!weekend?.available) return weekend || { available:false, reason:'Weekend forecast unavailable.' };
  const saturday = compactDay(weekend.saturday);
  const sunday = compactDay(weekend.sunday);
  const best = compactDay(weekend.best);
  return {
    available: true,
    betterDay: weekend.betterDay,
    scoreDifference: Number(weekend.scoreDifference),
    summary: weekend.summary,
    saturday,
    sunday,
    best
  };
}

function compactStorm(storm) {
  if (!storm) return { available:false, signal:'none', reason:'Storm forecast unavailable.' };
  return {
    available: Boolean(storm.available),
    signal: storm.signal || 'none',
    eventSnowIn: round(storm.eventSnowIn),
    eventStart: storm.eventStart || null,
    eventEnd: storm.eventEnd || null,
    windowStart: storm.windowStart || null,
    windowEnd: storm.windowEnd || null,
    leadHours: Number.isFinite(storm.leadHours) ? storm.leadHours : null,
    confidence: storm.confidence || null,
    summary: storm.summary || null,
    reason: storm.reason || null
  };
}

async function fetchChunk(trails, timezone) {
  const lats = trails.map(t => t.lat).join(',');
  const lons = trails.map(t => t.lon).join(',');
  const url = XC_FORECAST.forecastQuery(lats, lons, true, timezone);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'Chris-Izworski-XC-Conditions/2.0 (+https://xcski.chrisizworski.com/)'
      }
    });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    let payload = await response.json();
    if (!Array.isArray(payload)) payload = [payload];
    if (payload.length !== trails.length) throw new Error(`Open-Meteo returned ${payload.length}/${trails.length} locations`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function buildStateSnapshot(stateKey) {
  const state = registry.states[stateKey];
  if (!state) throw new Error(`Unknown state ${stateKey}`);
  const chunks = [];
  for (let i = 0; i < state.trails.length; i += CHUNK_SIZE) chunks.push(state.trails.slice(i, i + CHUNK_SIZE));
  const weather = (await Promise.all(chunks.map(chunk => fetchChunk(chunk, state.timezone)))).flat();
  if (weather.length !== state.trails.length) throw new Error(`Weather coverage ${weather.length}/${state.trails.length}`);

  const rows = state.trails.map((trail, index) => {
    const d = weather[index];
    const comparison = XC_INTEL.compareYesterday(d);
    return {
      id: trail.id,
      current: compactCurrent(comparison.current),
      delta: Number.isFinite(comparison.delta) ? comparison.delta : null,
      surfaceChanged: Boolean(comparison.surfaceChanged),
      bestWindowChanged: Boolean(comparison.bestWindowChanged),
      previousSurface: comparison.previous?.surface?.label || null,
      previousBestWindow: comparison.previous?.bestWindow?.label || null,
      weekend: compactWeekend(XC_FORECAST.weekendOutlook(d)),
      storm: compactStorm(XC_FORECAST.stormWindow(d))
    };
  });

  return {
    version: 1,
    state: stateKey,
    stateName: state.name,
    timezone: state.timezone,
    generatedAt: new Date().toISOString(),
    trailCount: rows.length,
    model: 'Open-Meteo + shared XC intelligence engine',
    cache: { freshSeconds:600, staleWhileRevalidateSeconds:1800, staleIfErrorSeconds:86400 },
    rows
  };
}

function setCacheHeaders(res, stateKey) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=600, stale-while-revalidate=1800, stale-if-error=86400');
  res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=600, stale-while-revalidate=1800, stale-if-error=86400');
  res.setHeader('CDN-Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
  res.setHeader('Vercel-Cache-Tag', `xc-model,xc-model-${stateKey}`);
  res.setHeader('X-XC-Model-Cache', 'state-snapshot-v1');
}

async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error:'method-not-allowed' });
  }
  const raw = Array.isArray(req.query?.state) ? req.query.state[0] : req.query?.state;
  const stateKey = String(raw || '').toLowerCase();
  if (!VALID_STATES.has(stateKey)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error:'invalid-state', allowed:[...VALID_STATES] });
  }

  try {
    const snapshot = await buildStateSnapshot(stateKey);
    setCacheHeaders(res, stateKey);
    return res.status(200).json(snapshot);
  } catch (error) {
    console.error(`XC model cache failed for ${stateKey}:`, error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error:'model-upstream-unavailable', state:stateKey });
  }
}

handler._test = { buildStateSnapshot, compactCurrent, compactWeekend, compactStorm };
module.exports = handler;
