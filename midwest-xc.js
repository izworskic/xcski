(() => {
  'use strict';

  const ctx = window.MIDWEST_XC;
  if (!ctx || !Array.isArray(ctx.states) || !window.XC_INTEL || !window.XC_FORECAST) return;
  const board = document.getElementById('midwest-board');
  const stateSummary = document.getElementById('midwest-state-summary');
  const freshness = document.getElementById('midwest-freshness');
  const status = document.getElementById('midwest-status');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function fetchLive(state) {
    try {
      const response = await fetch(`/api/xc-live?state=${encodeURIComponent(state.slug)}`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`live ${response.status}`);
      const payload = await response.json();
      return {
        payload,
        byTrail: new Map((payload.records || []).map(record => [record.trailId, record]))
      };
    } catch (error) {
      console.warn(`Midwest live layer unavailable for ${state.slug}:`, error);
      return { payload: { providers: [], records: [] }, byTrail: new Map() };
    }
  }

  async function fetchWeatherChunk(chunk, timezone) {
    const lats = chunk.map(t => t.lat).join(',');
    const lons = chunk.map(t => t.lon).join(',');
    const response = await fetch(XC_FORECAST.forecastQuery(lats, lons, true, timezone));
    if (!response.ok) throw new Error(`weather ${response.status}`);
    let payload = await response.json();
    if (!Array.isArray(payload)) payload = [payload];
    return payload;
  }

  async function loadState(state) {
    const chunks = [];
    for (let i = 0; i < state.trails.length; i += 40) chunks.push(state.trails.slice(i, i + 40));
    const [weatherChunks, liveLayer] = await Promise.all([
      Promise.all(chunks.map(chunk => fetchWeatherChunk(chunk, state.timezone))),
      fetchLive(state)
    ]);
    const weather = weatherChunks.flat();
    const rows = state.trails.map((trail, index) => {
      const d = weather[index];
      if (!d) return null;
      const comparison = XC_INTEL.compareYesterday(d);
      const live = liveLayer.byTrail.get(trail.id) || null;
      return {
        ...trail,
        state: state.name,
        stateSlug: state.slug,
        timezone: state.timezone,
        ...comparison.current,
        scoreDelta: comparison.delta,
        surfaceChanged: comparison.surfaceChanged,
        bestWindowChanged: comparison.bestWindowChanged,
        previousSurface: comparison.previous?.surface?.label || null,
        previousBestWindow: comparison.previous?.bestWindow?.label || null,
        weekend: XC_FORECAST.weekendOutlook(d),
        storm: XC_FORECAST.stormWindow(d),
        live
      };
    }).filter(Boolean);
    return { state, rows, liveLayer };
  }

  function eligible(row) {
    return !(row.live?.decisionEligible && row.live.openState === 'closed');
  }

  function avgTop(rows, count = 5) {
    const scores = rows.filter(eligible).map(r => r.snowScore).sort((a,b) => b-a).slice(0,count);
    return scores.length ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length) : 0;
  }

  function stateCards(results, offseason) {
    if (!stateSummary) return;
    const cards = results.map(result => {
      const candidates = result.rows.filter(eligible).sort((a,b) => b.snowScore-a.snowScore);
      const top = candidates[0];
      const improver = result.rows.filter(r => Number.isFinite(r.scoreDelta)).sort((a,b) => b.scoreDelta-a.scoreDelta)[0];
      const weekend = result.rows.filter(r => r.weekend?.available).sort((a,b) => Math.max(b.weekend.saturday.snowScore,b.weekend.sunday.snowScore)-Math.max(a.weekend.saturday.snowScore,a.weekend.sunday.snowScore))[0];
      const storm = result.rows.filter(r => r.storm?.signal === 'storm-window').sort((a,b) => b.storm.eventSnowIn-a.storm.eventSnowIn)[0];
      const freshLive = result.rows.filter(r => r.live?.decisionEligible).length;
      const strength = avgTop(result.rows);
      return `
        <a class="midwest-state-card state-${result.state.slug}" href="${result.state.href}">
          <span>${esc(result.state.name)}</span>
          <strong>${offseason ? 'Preseason' : `${strength}/100`}</strong>
          <small>${result.state.trails.length} systems${offseason ? '' : top ? ` · strongest model: ${esc(top.name)}` : ''}</small>
          <small>${weekend ? `weekend leader ${esc(weekend.name)} · ${esc(weekend.weekend.betterDay)}` : 'weekend forecast pending'}${storm ? ` · storm watch ${storm.storm.eventSnowIn.toFixed(1)}&quot;` : ''}</small>
          <small>${freshLive} fresh official update${freshLive===1?'':'s'}${!offseason && improver && Number.isFinite(improver.scoreDelta) ? ` · best mover ${improver.scoreDelta>0?'+':''}${improver.scoreDelta}` : ''}</small>
        </a>`;
    }).join('');
    stateSummary.innerHTML = cards;
  }

  function weekendDetail(row) {
    const w = row.weekend;
    if (!w?.available) return '';
    return `<div class="midwest-forecast-detail"><small>Weekend model</small><strong>${esc(w.betterDay === 'Tie' ? 'Saturday ≈ Sunday' : `${w.betterDay} stronger`)}</strong><span>Saturday ${w.saturday.snowScore}/100 · Sunday ${w.sunday.snowScore}/100 · best window ${esc(w.best.bestWindow.label)}</span></div>`;
  }

  function stormDetail(row) {
    const s = row.storm;
    if (!s || s.signal === 'none') return '';
    if (s.signal === 'storm-window') return `<div class="midwest-forecast-detail"><small>Potential ski window</small><strong>${s.eventSnowIn.toFixed(1)}&quot; modeled</strong><span>opens ~${esc(XC_FORECAST.localHourLabel(s.windowStart))}${s.windowEnd ? ` · thaw/rain risk ~${esc(XC_FORECAST.localHourLabel(s.windowEnd))}` : ' · persists through forecast'} · ${esc(s.confidence)} confidence</span></div>`;
    return `<div class="midwest-forecast-detail"><small>Snow event</small><strong>${s.eventSnowIn.toFixed(1)}&quot; modeled</strong><span>${esc(s.reason)}</span></div>`;
  }

  function rowCard(row, rank, mode='best') {
    const delta = Number.isFinite(row.scoreDelta) ? `${row.scoreDelta > 0 ? '+' : ''}${row.scoreDelta}` : '—';
    const deltaClass = row.scoreDelta > 0 ? 'up' : row.scoreDelta < 0 ? 'down' : 'flat';
    const live = row.live?.decisionEligible
      ? `<div class="midwest-live"><small>Official status</small><strong>${esc(row.live.openState)}</strong><span>${esc(row.live.provider)} · ${esc(row.live.freshness)}</span></div>`
      : '';
    const shift = row.bestWindowChanged && row.previousBestWindow
      ? `<span><b>${esc(row.previousBestWindow)} → ${esc(row.bestWindow.label)}</b><small>window shift</small></span>`
      : '';
    const forecast = mode === 'weekend' ? weekendDetail(row) : mode === 'storm' ? stormDetail(row) : '';
    return `
      <article class="midwest-pick">
        <div class="midwest-rank">${rank}</div>
        <div class="midwest-pick-main">
          <div class="midwest-pick-head">
            <div><p>${esc(row.state)}</p><h3><a href="${esc(row.href)}">${esc(row.name)}</a></h3><span>${esc(row.town)}</span></div>
            <div class="midwest-score"><b>${row.snowScore}</b><small>${XC_INTEL.scoreWord(row.snowScore)}</small></div>
          </div>
          ${live}${forecast}
          <div class="midwest-decision">
            <div><small>Surface</small><strong>${esc(row.surface.label)}</strong><span>${esc(row.surface.detail)}</span></div>
            <div><small>Best window</small><strong>${esc(row.bestWindow.label)}</strong><span>${esc(row.bestWindow.detail)}</span></div>
          </div>
          <div class="midwest-metrics">
            <span><b>${row.depth.toFixed(1)}&quot;</b><small>modeled base</small></span>
            <span><b>${row.snow24.toFixed(1)}&quot;</b><small>24h snow</small></span>
            <span class="delta-${deltaClass}"><b>${delta}</b><small>vs yesterday</small></span>
            <span><b>${Math.round(row.temp)}°F</b><small>now</small></span>
            ${shift}
          </div>
        </div>
      </article>`;
  }

  function selectRows(rows, mode) {
    const open = rows.filter(eligible);
    if (mode === 'improvers') return open.filter(r => Number.isFinite(r.scoreDelta) && r.scoreDelta > 0).sort((a,b) => (b.scoreDelta-a.scoreDelta) || (b.snowScore-a.snowScore));
    if (mode === 'fresh') return open.filter(r => r.snow24 > 0).sort((a,b) => (b.snow24-a.snow24) || (b.snowScore-a.snowScore));
    if (mode === 'lighted') return open.filter(r => r.lit).sort((a,b) => b.snowScore-a.snowScore);
    if (mode === 'skate') return open.filter(r => r.skate).sort((a,b) => b.snowScore-a.snowScore);
    if (mode === 'weekend') return rows.filter(r => r.weekend?.available).sort((a,b) => Math.max(b.weekend.saturday.snowScore,b.weekend.sunday.snowScore)-Math.max(a.weekend.saturday.snowScore,a.weekend.sunday.snowScore));
    if (mode === 'storm') return rows.filter(r => r.storm?.signal === 'storm-window' || r.storm?.signal === 'snow-event').sort((a,b) => (b.storm?.eventSnowIn||0)-(a.storm?.eventSnowIn||0));
    return open.sort((a,b) => {
      const aOpen = a.live?.decisionEligible && a.live.openState === 'open' ? 1 : 0;
      const bOpen = b.live?.decisionEligible && b.live.openState === 'open' ? 1 : 0;
      return (bOpen-aOpen) || (b.snowScore-a.snowScore) || ((b.bestWindow.score||0)-(a.bestWindow.score||0));
    });
  }

  function renderBoard(rows, mode='best') {
    if (!board) return;
    const selected = selectRows([...rows], mode).slice(0,10);
    const labels = {
      best:'Best modeled signals across the Midwest',
      improvers:'Biggest modeled improvements since the same local hour yesterday',
      fresh:'Most modeled snow in the last 24 hours',
      lighted:'Best lighted systems',
      skate:'Best skate-capable systems',
      weekend:'Best modeled XC signals for Saturday and Sunday',
      storm:'Storm watch: where a modeled ski window may open'
    };
    const heading = document.getElementById('midwest-board-label');
    if (heading) heading.textContent = labels[mode] || labels.best;
    board.innerHTML = selected.length
      ? selected.map((row,i) => rowCard(row,i+1,mode)).join('')
      : `<div class="midwest-empty"><strong>${mode === 'storm' ? 'No meaningful modeled storm window right now.' : 'No meaningful matches in this view.'}</strong><p>The engine does not manufacture snow, movement, or a future ski window when the forecast does not support it.</p></div>`;
  }

  async function load() {
    try {
      if (status) status.textContent = `Updating ${ctx.totalTrails} systems…`;
      const results = await Promise.all(ctx.states.map(loadState));
      const rows = results.flatMap(result => result.rows);
      if (rows.length !== ctx.totalTrails) throw new Error(`expected ${ctx.totalTrails} rows, got ${rows.length}`);

      const month = Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'numeric'}).format(new Date()));
      const offseason = month >= 5 && month <= 10;
      const snowWatch = rows.filter(r => r.storm?.signal !== 'none' || r.snowTomorrow >= 0.5 || r.snow24 >= 0.5);
      stateCards(results, offseason && !snowWatch.length);

      const liveCount = rows.filter(r => r.live?.decisionEligible).length;
      const pending = results.reduce((sum,r) => sum + (r.liveLayer.payload.providers || []).filter(p=>p.status==='permission-pending').length, 0);
      if (freshness) freshness.textContent = `Open-Meteo 8-day weather · same-local-hour change since yesterday · weekend + storm-window intelligence · ${liveCount} fresh official provider update${liveCount===1?'':'s'} · ${pending} provider permission${pending===1?'':'s'} pending.`;

      if (offseason && !snowWatch.length) {
        if (status) status.textContent = 'Preseason mode';
        renderBoard(rows,'weekend');
      } else {
        if (status) status.textContent = 'Live Midwest board';
        renderBoard(rows,ctx.defaultMode || 'best');
      }
      document.querySelectorAll('[data-midwest-mode]').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('[data-midwest-mode]').forEach(b => b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
        renderBoard(rows,btn.dataset.midwestMode);
      }));
    } catch (error) {
      console.warn('Midwest XC Today unavailable:', error);
      if (status) status.textContent = 'Live board unavailable';
      if (board) board.innerHTML = '<div class="midwest-empty"><strong>The live Midwest comparison could not load.</strong><p>Use the Michigan, Wisconsin and Minnesota state boards below. Stale modeled values are not substituted.</p></div>';
    }
  }

  load();
})();
