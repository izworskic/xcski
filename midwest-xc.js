(() => {
  'use strict';

  const ctx = window.MIDWEST_XC;
  if (!ctx || !Array.isArray(ctx.states) || !window.XC_INTEL || !window.XC_FORECAST) return;
  const radar = document.getElementById('midwest-radar');
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

  function average(values) {
    const clean = values.filter(Number.isFinite);
    return clean.length ? clean.reduce((a,b)=>a+b,0) / clean.length : null;
  }

  function pulseFor(result) {
    const rows = result.rows.filter(eligible);
    const freshSnow = rows.filter(r => r.snow24 >= 0.5).length;
    const stormWindows = rows.filter(r => r.storm?.signal === 'storm-window').length;
    const snowEvents = rows.filter(r => r.storm?.signal === 'snow-event').length;
    const official = result.rows.filter(r => r.live?.decisionEligible).length;
    const weekends = rows.filter(r => r.weekend?.available);
    const sat = average(weekends.map(r => r.weekend.saturday.snowScore));
    const sun = average(weekends.map(r => r.weekend.sunday.snowScore));
    const weekendDirection = sat == null || sun == null ? 'Weekend forecast incomplete' : Math.abs(sat-sun) <= 1 ? 'Weekend: Saturday ≈ Sunday' : sat > sun ? 'Weekend: Saturday trends stronger' : 'Weekend: Sunday trends stronger';
    const changes = rows.filter(r => Number.isFinite(r.scoreDelta));
    const improving = changes.filter(r => r.scoreDelta >= 4).length;
    const declining = changes.filter(r => r.scoreDelta <= -4).length;
    return { freshSnow, stormWindows, snowEvents, official, weekendDirection, improving, declining };
  }

  function renderStateCards(results, offseason) {
    for (const result of results) {
      const pulse = pulseFor(result);
      const el = document.querySelector(`[data-state-pulse="${result.state.slug}"]`);
      if (!el) continue;
      if (offseason && !pulse.freshSnow && !pulse.stormWindows && !pulse.snowEvents) {
        el.innerHTML = '<strong>Preseason</strong><span>Use the destination shortcuts now; live winter signals wake up when meaningful snow returns.</span>';
        continue;
      }
      const snow = pulse.freshSnow ? `${pulse.freshSnow} system${pulse.freshSnow===1?'':'s'} with ≥0.5&quot; modeled 24h snow` : 'No broad fresh-snow signal';
      const storm = pulse.stormWindows ? `${pulse.stormWindows} potential ski window${pulse.stormWindows===1?'':'s'}` : pulse.snowEvents ? `${pulse.snowEvents} modeled snow event${pulse.snowEvents===1?'':'s'} still developing` : 'No meaningful storm window';
      el.innerHTML = `<strong>Current statewide pulse</strong><span>${snow} · ${storm}</span><span>${esc(pulse.weekendDirection)}${pulse.official ? ` · ${pulse.official} fresh official update${pulse.official===1?'':'s'}` : ''}</span>`;
    }
  }

  function radarRow(result, offseason) {
    const pulse = pulseFor(result);
    const change = pulse.improving > pulse.declining ? `${pulse.improving} systems improving materially` : pulse.declining > pulse.improving ? `${pulse.declining} systems declining materially` : 'No broad day-over-day swing';
    const storm = pulse.stormWindows ? `${pulse.stormWindows} potential ski window${pulse.stormWindows===1?'':'s'}` : pulse.snowEvents ? `${pulse.snowEvents} snow event${pulse.snowEvents===1?'':'s'} without a qualified window yet` : 'No qualifying storm window';
    const main = offseason && !pulse.freshSnow && !pulse.stormWindows && !pulse.snowEvents ? 'Preseason routing mode' : change;
    return `<article class="midwest-radar-row state-${result.state.slug}"><div><span>${esc(result.state.name)}</span><strong>${esc(main)}</strong><small>${esc(pulse.weekendDirection)}</small></div><div class="midwest-radar-metrics"><span><b>${pulse.freshSnow}</b><small>fresh-snow systems</small></span><span><b>${pulse.stormWindows}</b><small>storm windows</small></span><span><b>${pulse.official}</b><small>fresh official updates</small></span></div><div><strong>${esc(storm)}</strong><a href="${result.state.href}">Open ${esc(result.state.name)} conditions →</a></div></article>`;
  }

  function renderRadar(results, offseason, failedStates) {
    if (!radar) return;
    radar.innerHTML = results.map(result => radarRow(result, offseason)).join('');
    if (failedStates.length) {
      radar.insertAdjacentHTML('beforeend', `<div class="midwest-partial"><strong>Partial statewide data</strong><span>${esc(failedStates.join(', '))} unavailable right now. The available state summaries remain usable.</span></div>`);
    }
  }

  async function load() {
    try {
      if (status) status.textContent = `Updating ${ctx.totalTrails} systems…`;
      const settled = await Promise.allSettled(ctx.states.map(loadState));
      const results = settled.filter(result => result.status === 'fulfilled').map(result => result.value);
      const failedStates = settled.map((result,index) => result.status === 'rejected' ? ctx.states[index].name : null).filter(Boolean);
      const rows = results.flatMap(result => result.rows);
      if (!rows.length) throw new Error('no state weather returned');

      const month = Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'numeric'}).format(new Date()));
      const offseason = month >= 5 && month <= 10;
      renderStateCards(results, offseason);
      renderRadar(results, offseason, failedStates);

      const liveCount = rows.filter(r => r.live?.decisionEligible).length;
      const pending = results.reduce((sum,r) => sum + (r.liveLayer.payload.providers || []).filter(p=>p.status==='permission-pending').length, 0);
      if (freshness) freshness.textContent = `State-level radar from ${rows.length}/${ctx.totalTrails} systems · same-local-hour change · weekend direction · storm-window signals · ${liveCount} fresh official provider update${liveCount===1?'':'s'} · ${pending} provider permission${pending===1?'':'s'} pending${failedStates.length ? ` · partial: ${failedStates.join(', ')} unavailable` : ''}.`;
      if (status) status.textContent = failedStates.length ? 'State radar · partial' : offseason ? 'Preseason routing mode' : 'State radar live';
    } catch (error) {
      console.warn('Midwest XC gateway radar unavailable:', error);
      if (status) status.textContent = 'State radar unavailable';
      if (radar) radar.innerHTML = '<div class="midwest-empty"><strong>The cross-state radar could not load.</strong><p>The Michigan, Wisconsin and Minnesota state gateways above remain the primary way into the network. No stale modeled values are substituted here.</p></div>';
    }
  }

  load();
})();
