const handler = require('../api/xc-live.js');

function invoke(state) {
  return new Promise((resolve, reject) => {
    const req = { method: 'GET', query: { state } };
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, headers, body }); return this; }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  for (const state of ['wisconsin', 'minnesota', 'michigan']) {
    const result = await invoke(state);
    if (result.statusCode !== 200) throw new Error(`${state}: expected API 200, got ${result.statusCode}`);
    if (result.body?.schemaVersion !== 1) throw new Error(`${state}: live schema version missing`);
    if (!Array.isArray(result.body?.providers)) throw new Error(`${state}: provider status array missing`);
    if (!Array.isArray(result.body?.records)) throw new Error(`${state}: records array missing`);
    if (result.body.records.length !== 0) throw new Error(`${state}: unauthorized provider records were emitted`);
    if (result.body.providers.some(provider => provider.status !== 'permission-pending')) {
      throw new Error(`${state}: provider activated without explicit authorization`);
    }
    if (!String(result.headers['cache-control'] || '').includes('s-maxage=300')) throw new Error(`${state}: edge cache policy missing`);
  }

  const invalid = await new Promise((resolve, reject) => {
    const req = { method: 'GET', query: { state: 'ohio' } };
    const res = {
      statusCode: 200,
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body }); return this; }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
  if (invalid.statusCode !== 400 || invalid.body?.error !== 'invalid_state') throw new Error('invalid-state API guard missing');

  console.log('XC live API runtime: PASS — handler loads, unauthorized providers emit zero records, cache/schema contracts hold, and invalid states are rejected.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
