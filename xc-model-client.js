(() => {
  'use strict';

  const promises = new Map();
  const valid = new Set(['michigan','wisconsin','minnesota']);

  async function state(stateKey) {
    const key = String(stateKey || '').toLowerCase();
    if (!valid.has(key)) throw new Error(`invalid XC model state: ${key}`);
    if (!promises.has(key)) {
      promises.set(key, fetch(`/api/xc-model?state=${encodeURIComponent(key)}`, { headers:{ accept:'application/json' } })
        .then(async response => {
          if (!response.ok) throw new Error(`XC model ${response.status}`);
          const payload = await response.json();
          if (!payload || payload.state !== key || !Array.isArray(payload.rows)) throw new Error('XC model payload malformed');
          return payload;
        })
        .catch(error => {
          promises.delete(key);
          throw error;
        }));
    }
    return promises.get(key);
  }

  function byId(payload) {
    return new Map((payload?.rows || []).map(row => [row.id, row]));
  }

  window.XC_MODEL = { state, byId };
})();
