const providers = require('../live-ingestion/providers.json');
const mappings = require('../live-ingestion/mappings.json');

const normalize = value => String(value || '').toLowerCase().replace(/&amp;/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
const stripHtml = html => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n\s+/g, '\n')
  .trim();

function flag(name) {
  return String(process.env[name] || '').toLowerCase() === 'true';
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function iso(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function freshness(updatedAt) {
  if (!updatedAt) return { class: 'unknown', ageHours: null, decisionEligible: false };
  const ageHours = Math.max(0, (Date.now() - Date.parse(updatedAt)) / 36e5);
  const limits = providers.freshness;
  if (ageHours <= limits.freshHours) return { class: 'fresh', ageHours, decisionEligible: true };
  if (ageHours <= limits.usableHours) return { class: 'aging', ageHours, decisionEligible: true };
  if (ageHours <= limits.staleHours) return { class: 'stale', ageHours, decisionEligible: false };
  return { class: 'expired', ageHours, decisionEligible: false };
}

function record(providerId, state, trailId, raw = {}) {
  const updatedAt = iso(raw.updatedAt || raw.lastUpdated || raw.updated);
  const f = freshness(updatedAt);
  return {
    providerId,
    provider: providers.providers[providerId]?.label || providerId,
    state,
    trailId,
    openState: ['open','closed','partial','unknown'].includes(raw.openState) ? raw.openState : 'unknown',
    updatedAt,
    freshness: f.class,
    ageHours: f.ageHours == null ? null : Math.round(f.ageHours * 10) / 10,
    decisionEligible: f.decisionEligible,
    baseMinIn: number(raw.baseMinIn),
    baseMaxIn: number(raw.baseMaxIn),
    newSnow24In: number(raw.newSnow24In),
    classic: raw.classic === true ? true : raw.classic === false ? false : null,
    skate: raw.skate === true ? true : raw.skate === false ? false : null,
    groomingState: raw.groomingState || null,
    surfaceCode: raw.surfaceCode || null,
    lastGroomedAt: iso(raw.lastGroomedAt),
    groomedPercent: number(raw.groomedPercent),
    sourceUrl: raw.sourceUrl || providers.providers[providerId]?.sourceUrl || null,
    provenance: 'provider',
    affectsSnowScore: false
  };
}

function aliasIndex(providerId, state) {
  const map = mappings.providers?.[providerId]?.[state] || {};
  const idx = new Map();
  for (const [trailId, aliases] of Object.entries(map)) {
    for (const alias of aliases) idx.set(normalize(alias), trailId);
  }
  return idx;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Michigan-Wisconsin-Minnesota-XC-Conditions/1.0 (+https://xcski.chrisizworski.com/)',
        'accept': 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseTravelWisconsin(html, state) {
  const text = stripHtml(html);
  const idx = aliasIndex('travel-wisconsin', state);
  const records = [];
  const names = [...idx.keys()].sort((a,b) => b.length - a.length);
  const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const trailId = idx.get(normalize(lines[i]));
    if (!trailId) continue;
    const window = lines.slice(Math.max(0, i - 2), i + 8).join(' | ');
    const status = /\bclosed\b/i.test(window) ? 'closed' : /\b(open|good|excellent|fair|poor)\b/i.test(window) ? 'open' : 'unknown';
    const depth = window.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*Inches/i);
    const updated = window.match(/Updated:\s*([^|]+)/i);
    records.push(record('travel-wisconsin', state, trailId, {
      openState: status,
      updatedAt: updated?.[1]?.trim(),
      baseMinIn: depth?.[1],
      baseMaxIn: depth?.[2],
      classic: /Classic Skiing/i.test(window),
      skate: /Skate Skiing/i.test(window),
      groomingState: /Not Groomed/i.test(window) ? 'not-groomed' : /Groomed For:/i.test(window) ? 'reported-groomed' : null
    }));
  }
  return dedupe(records);
}

function parseThreeRivers(html, state) {
  const text = stripHtml(html);
  const idx = aliasIndex('three-rivers', state);
  const records = [];
  const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const trailId = idx.get(normalize(lines[i]));
    if (!trailId) continue;
    const window = lines.slice(i, i + 9).join(' | ');
    const closed = /Closed:\s*All trails|Closed for the season|\bAll Trails Closed\b/i.test(window);
    const open = /\bOpen\b/i.test(window) && !closed;
    const updated = window.match(/Updated:\s*([^|]+)/i);
    records.push(record('three-rivers', state, trailId, {
      openState: closed ? 'closed' : open ? 'open' : 'unknown',
      updatedAt: updated?.[1]?.trim(),
      groomingState: /Groomed/i.test(window) ? 'groomed' : /Tracked/i.test(window) ? 'tracked' : /Packed/i.test(window) ? 'packed' : null
    }));
  }
  return dedupe(records);
}

function parseCookCounty(html, state) {
  const text = stripHtml(html);
  const idx = aliasIndex('cook-county', state);
  const records = [];
  for (const [alias, trailId] of idx.entries()) {
    const pos = normalize(text).indexOf(alias);
    if (pos < 0) continue;
    const rawPos = Math.max(0, Math.min(text.length - 1, pos));
    const window = text.slice(rawPos, rawPos + 5000);
    const date = window.match(/Date:\s*([^\n|]+)/i);
    const snow24 = window.match(/New Snow Last 24 Hours:\s*([0-9.]+)/i);
    const base = window.match(/Trail Base:\s*([0-9.]+)\s*-\s*([0-9.]+)/i);
    const surface = window.match(/Surface Conditions:\s*([^\n|]+)/i);
    const groom = window.match(/Last Grooming Day:\s*([^\n|]+)/i);
    records.push(record('cook-county', state, trailId, {
      openState: /closed for the season/i.test(window) ? 'closed' : 'unknown',
      updatedAt: date?.[1]?.trim(),
      newSnow24In: snow24?.[1],
      baseMinIn: base?.[1],
      baseMaxIn: base?.[2],
      surfaceCode: surface?.[1]?.trim()?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      lastGroomedAt: groom?.[1]?.trim(),
      classic: /classic/i.test(window),
      skate: /skate/i.test(window)
    }));
  }
  return dedupe(records);
}

async function parseAuthorizedJson(providerId, state, config) {
  const endpoint = process.env[config.endpointEnv];
  if (!endpoint) throw new Error(`${config.endpointEnv} not configured`);
  const headers = { accept: 'application/json' };
  if (config.tokenEnv && process.env[config.tokenEnv]) headers.authorization = `Bearer ${process.env[config.tokenEnv]}`;
  const response = await fetch(endpoint, { headers });
  if (!response.ok) throw new Error(`authorized feed ${response.status}`);
  const payload = await response.json();
  const sourceRecords = Array.isArray(payload) ? payload : Array.isArray(payload.records) ? payload.records : [];
  const idx = aliasIndex(providerId, state);
  return sourceRecords.map(item => {
    const trailId = item.trailId || item.id || idx.get(normalize(item.name || item.trailName));
    if (!trailId) return null;
    return record(providerId, state, trailId, item);
  }).filter(Boolean);
}

function dedupe(records) {
  const map = new Map();
  for (const item of records) {
    const previous = map.get(item.trailId);
    if (!previous || (item.updatedAt && (!previous.updatedAt || item.updatedAt > previous.updatedAt))) map.set(item.trailId, item);
  }
  return [...map.values()];
}

async function runProvider(providerId, state, config) {
  const authorized = flag(config.envFlag);
  if (!authorized || config.enabled !== true) {
    return { id: providerId, label: config.label, state, status: 'permission-pending', rights: config.rights, records: [] };
  }
  try {
    let records = [];
    if (config.adapter === 'authorized-json') records = await parseAuthorizedJson(providerId, state, config);
    else {
      const html = await fetchText(config.sourceUrl);
      if (config.adapter === 'travel-wisconsin-html') records = parseTravelWisconsin(html, state);
      else if (config.adapter === 'three-rivers-html') records = parseThreeRivers(html, state);
      else if (config.adapter === 'cook-county-html') records = parseCookCounty(html, state);
    }
    return { id: providerId, label: config.label, state, status: 'ok', rights: 'authorized-by-environment', records };
  } catch (error) {
    return { id: providerId, label: config.label, state, status: 'error', rights: config.rights, error: error.message, records: [] };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const state = String(req.query.state || '').toLowerCase();
  if (!['michigan','wisconsin','minnesota'].includes(state)) return res.status(400).json({ error: 'invalid_state' });
  const stateProviders = Object.entries(providers.providers).filter(([, config]) => (config.states || []).includes(state));
  const results = await Promise.all(stateProviders.map(([id, config]) => runProvider(id, state, config)));
  const records = results.flatMap(result => result.records || []);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  res.setHeader('X-XC-Live-Schema', '1');
  return res.status(200).json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    state,
    policy: providers.policy,
    freshness: providers.freshness,
    providers: results.map(({ records: providerRecords, ...rest }) => ({ ...rest, recordCount: providerRecords.length })),
    records
  });
};
