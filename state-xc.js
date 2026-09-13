(() => {
  'use strict';

  const ctx = window.STATE_XC_PAGE;
  if (!ctx || !window.XC_INTEL || !window.XC_FORECAST) return;
  const root = document.getElementById('state-live-board');
  const trailRoot = document.getElementById('state-trail-live');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const timezone = ['wisconsin','minnesota'].includes(ctx.slug) ? 'America/Chicago' : 'America/Detroit';
  const zoneLabel = timezone === 'America/Chicago' ? 'CT' : 'ET';

  function sourceFor(trail, live = null) {
    if (live?.decisionEligible) {
      return {
        integration: 'authorized-api', liveData: true, sourceClass: 'operator-live',
        provider: live.provider, officialUrl: live.sourceUrl || trail.sourceUrl, label: live.provider
      };
    }
    const provider = String(trail.sourceProvider || 'Operator / land manager');
    let sourceClass = 'operator-direct';
    if (/DNR/i.test(provider)) sourceClass = 'land-manager-reference';
    if (/Travel Wisconsin/i.test(provider)) sourceClass = 'reference-only';
    return { sourceClass, provider, officialUrl: trail.sourceUrl, label: provider };
  }

  function filterTrail(trail, filter) {
    if (filter === 'classic') return trail.classic;
    if (filter === 'skate') return trail.skate;
    if (filter === 'snowmaking') return trail.snowmaking;
    if (filter === 'northwoods') return ['northwest-birkie','northwoods'].includes(trail.region);
    if (filter === 'ski-pass') return /Great Minnesota Ski Pass/.test(trail.pass || '');
    if (filter === 'twin-cities') return trail.region === 'twin-cities';
    return true;
  }

  async function loadLiveStatus() {
    try {
      const response = await fetch(`/api/xc-live?state=${encodeURIComponent(ctx.slug)}`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`live status ${response.status}`);
      const payload = await response.json();
      const byTrail = new Map((payload.records || []).map(record => [record.trailId, record]));
      return { payload, byTrail };
    } catch (error) {
      console.warn('XC live provider layer unavailable:', error);
      return { payload: { providers: [], records: [] }, byTrail: new Map() };
    }
  }

  function liveLabel(live) {
    if (!live) return '';
    const age = Number.isFinite(live.ageHours) ? ` · ${live.ageHours}h old` : '';
    const status = live.openState === 'open' ? 'Confirmed open' : live.openState === 'closed' ? 'Confirmed closed' : live.openState === 'partial' ? 'Partially open' : 'Official update';
    return `<div class="state-live-status state-live-${esc(live.openState)}"><small>Official live status</small><strong>${esc(status)}</strong><span>${esc(live.provider)}${esc(age)} · ${esc(live.freshness)}</span></div>`;
  }

  function deltaMetric(row) {
    if (!Number.isFinite(row.scoreDelta)) return '';
    const sign = row.scoreDelta > 0 ? '+' : '';
    const cls = row.scoreDelta > 0 ? 'state-delta-up' : row.scoreDelta < 0 ? 'state-delta-down' : 'state-delta-flat';
    return `<span class="${cls}"><b>${sign}${row.scoreDelta}</b><small>vs yesterday</small></span>`;
  }

  function ensureOutlookMount() {
    let mount = document.getElementById('state-forecast-outlook');
    if (mount || !root?.parentElement) return mount;
    mount = document.createElement('div');
    mount.id = 'state-forecast-outlook';
    mount.className = 'state-forecast-outlook';
    root.parentElement.insertBefore(mount, root);
    return mount;
  }

  function renderForecastOutlook(rows) {
    const mount = ensureOutlookMount();
    if (!mount) return;
    const weekend = rows.filter(r => r.weekend?.available)
      .sort((a,b) => Math.max(b.weekend.saturday.snowScore,b.weekend.sunday.snowScore) - Math.max(a.weekend.saturday.snowScore,a.weekend.sunday.snowScore))
      .slice(0,3);
    const stormWindows = rows.filter(r => r.storm?.signal === 'storm-window')
      .sort((a,b) => b.storm.eventSnowIn - a.storm.eventSnowIn).slice(0,3);
    const snowEvents = stormWindows.length ? stormWindows : rows.filter(r => r.storm?.signal === 'snow-event')
      .sort((a,b) => b.storm.eventSnowIn - a.storm.eventSnowIn).slice(0,3);

    const weekendHtml = weekend.length ? weekend.map((r,i) => {
      const w = r.weekend;
      return `<a href="/${ctx.slug}/trails/${r.id}/"><b>${i+1}. ${esc(r.name)}</b><span>${esc(w.betterDay === 'Tie' ? 'Weekend nearly even' : `${w.betterDay} better`)} · Sat ${w.saturday.snowScore} / Sun ${w.sunday.snowScore}</span></a>`;
    }).join('') : '<span>No complete weekend forecast is available yet.</span>';

    const stormHtml = snowEvents.length ? snowEvents.map(r => {
      const s = r.storm;
      const open = s.windowStart ? ` · opens ~${XC_FORECAST.localHourLabel(s.windowStart)}` : '';
      return `<a href="/${ctx.slug}/trails/${r.id}/"><b>${esc(r.name)}</b><span>${s.eventSnowIn.toFixed(1)}&quot; modeled${esc(open)} · ${esc(s.confidence || 'forecast')} confidence</span></a>`;
    }).join('') : '<span>No ≥1.5&quot; modeled 24-hour snow burst in the next 7 days.</span>';

    mount.innerHTML = `<div class="state-forecast-card"><small>Weekend outlook</small><strong>Saturday vs Sunday</strong><div>${weekendHtml}</div><p>Modeled snow/weather signal only; current grooming cannot be projected this far out.</p></div><div class="state-forecast-card"><small>Storm / ski-window watch</small><strong>Next 7 days</strong><div>${stormHtml}</div><p>Potential windows require forecast snow plus cold/dry hours and are not trail-opening forecasts.</p></div>`;
  }

  function renderRows(rows, filter='all') {
    if (!root) return;
    let candidates = rows.filter(r => filterTrail(r, filter));
    if (filter === 'all') candidates = candidates.filter(r => !(r.live?.decisionEligible && r.live.openState === 'closed'));
    const shown = candidates.sort((a,b) => {
      const aOpen = a.live?.decisionEligible && a.live.openState === 'open' ? 1 : 0;
      const bOpen = b.live?.decisionEligible && b.live.openState === 'open' ? 1 : 0;
      return (bOpen-aOpen) || (b.snowScore-a.snowScore) || ((b.bestWindow.score||0)-(a.bestWindow.score||0));
    }).slice(0,8);
    if (!shown.length) {
      root.innerHTML = '<div class="state-empty"><strong>No matching systems in this view.</strong><p>Try another filter or verify operator reports.</p></div>';
      return;
    }
    root.innerHTML = shown.map((r,i) => `
      <article class="state-pick">
        <div class="state-rank">${i+1}</div>
        <div class="state-pick-main">
          <div class="state-pick-head"><div><h3><a href="/${ctx.slug}/trails/${r.id}/">${esc(r.name)}</a></h3><p>${esc(r.town)} · ${esc(ctx.regionNames[r.region] || r.region)}</p></div><div class="state-score"><b>${r.snowScore}</b><span>${XC_INTEL.scoreWord(r.snowScore)}</span></div></div>
          ${liveLabel(r.live)}
          <div class="state-decision-grid">
            <div><small>Surface</small><strong>${esc(r.surface.label)}</strong><span>${esc(r.surface.detail)}</span></div>
            <div><small>Best window</small><strong>${esc(r.bestWindow.label)}</strong><span>${esc(r.bestWindow.detail)}</span></div>
            <div><small>Confidence</small><strong>${esc(r.confidence.label)}</strong><span>${esc(r.confidence.detail)}</span></div>
          </div>
          <div class="state-metrics"><span><b>${r.depth.toFixed(1)}&quot;</b><small>modeled base</small></span><span><b>${r.snow24.toFixed(1)}&quot;</b><small>24h snow</small></span><span><b>${r.snow72.toFixed(1)}&quot;</b><small>72h snow</small></span><span><b>${Math.round(r.temp)}°F</b><small>now</small></span>${deltaMetric(r)}${r.live?.baseMinIn != null ? `<span><b>${r.live.baseMinIn}${r.live.baseMaxIn != null && r.live.baseMaxIn !== r.live.baseMinIn ? `–${r.live.baseMaxIn}` : ''}&quot;</b><small>reported base</small></span>` : ''}</div>
          <div class="state-source"><small>Status source</small><strong>${esc(r.live?.provider || r.sourceProvider)}</strong><span>${r.live?.updatedAt ? `official update ${new Date(r.live.updatedAt).toLocaleString()}` : esc(r.pass || 'Check operator rules')}</span></div>
        </div>
      </article>`).join('');
  }

  async function loadBoard() {
    if (!root || !Array.isArray(ctx.trails) || !ctx.trails.length) return;
    const status = document.getElementById('state-board-status');
    const fresh = document.getElementById('state-board-freshness');
    try {
      if (status) status.textContent = `Updating ${ctx.trails.length} systems…`;
      const lats = ctx.trails.map(t=>t.lat).join(',');
      const lons = ctx.trails.map(t=>t.lon).join(',');
      const [weatherResponse, liveLayer] = await Promise.all([
        fetch(XC_FORECAST.forecastQuery(lats,lons,true,timezone)),
        loadLiveStatus()
      ]);
      if (!weatherResponse.ok) throw new Error(`weather ${weatherResponse.status}`);
      let weather = await weatherResponse.json();
      if (!Array.isArray(weather)) weather=[weather];
      const rows = ctx.trails.map((trail,index) => {
        if (!weather[index]) return null;
        const comparison = XC_INTEL.compareYesterday(weather[index]);
        const intel = comparison.current;
        const live = liveLayer.byTrail.get(trail.id) || null;
        const source = sourceFor(trail, live);
        return {...trail,...intel,scoreDelta:comparison.delta,previousSurface:comparison.previous?.surface?.label || null,previousBestWindow:comparison.previous?.bestWindow?.label || null,weekend:XC_FORECAST.weekendOutlook(weather[index]),storm:XC_FORECAST.stormWindow(weather[index]),live,confidence:XC_INTEL.confidence(source,trail)};
      }).filter(Boolean);
      renderForecastOutlook(rows);
      const month = Number(new Intl.DateTimeFormat('en-US',{timeZone:timezone,month:'numeric'}).format(new Date()));
      if (month >= 5 && month <= 10) {
        const snowWatch = rows.filter(r=>r.storm?.signal !== 'none' || r.snowTomorrow>=0.5).sort((a,b)=>(b.storm?.eventSnowIn||b.snowTomorrow)-(a.storm?.eventSnowIn||a.snowTomorrow));
        if (!snowWatch.length) {
          root.innerHTML = `<div class="state-empty"><strong>Preseason mode.</strong><p>${esc(ctx.preseason)}</p></div>`;
          if (status) status.textContent='Preseason';
          const pending = (liveLayer.payload.providers || []).filter(p=>p.status==='permission-pending').length;
          if (fresh) fresh.textContent=`Weather checked · Open-Meteo 8-day forecast · live-ingestion engine ready · ${pending} provider permission${pending===1?'':'s'} pending.`;
          return;
        }
      }
      if (status) status.textContent='Live winter board';
      const updated = new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'numeric',minute:'2-digit'}).format(new Date());
      const liveCount = (liveLayer.payload.records || []).filter(r=>r.decisionEligible).length;
      const pending = (liveLayer.payload.providers || []).filter(p=>p.status==='permission-pending').length;
      if (fresh) fresh.textContent=`Weather updated ${updated} ${zoneLabel} · Open-Meteo 8-day forecast · day-over-day compares the same local hour · ${liveCount} fresh official provider update${liveCount===1?'':'s'} · ${pending} provider permission${pending===1?'':'s'} pending`;
      renderRows(rows,'all');
      document.querySelectorAll('[data-state-filter]').forEach(btn => btn.addEventListener('click',()=>{
        document.querySelectorAll('[data-state-filter]').forEach(b=>b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
        renderRows(rows,btn.dataset.stateFilter);
      }));
    } catch (error) {
      console.warn(`${ctx.state} XC board unavailable:`, error);
      if (status) status.textContent='Live board unavailable';
      root.innerHTML='<div class="state-empty"><strong>The live intelligence layer could not load.</strong><p>Use the static trail directory and official status links below. Stale values are not substituted.</p></div>';
    }
  }

  function trailForecast(intel) {
    const w = intel.weekend;
    const s = intel.storm;
    const weekend = w?.available
      ? `<div><small>Weekend</small><strong>${esc(w.betterDay === 'Tie' ? 'Saturday ≈ Sunday' : `${w.betterDay} stronger`)}</strong><span>Sat ${w.saturday.snowScore} / Sun ${w.sunday.snowScore}. ${esc(w.summary)}</span></div>`
      : `<div><small>Weekend</small><strong>Forecast incomplete</strong><span>${esc(w?.reason || 'Weekend data unavailable.')}</span></div>`;
    const storm = s?.signal === 'storm-window'
      ? `<div><small>Storm window</small><strong>${s.eventSnowIn.toFixed(1)}&quot; modeled</strong><span>Potential window ~${esc(XC_FORECAST.localHourLabel(s.windowStart))}${s.windowEnd ? ` to ${esc(XC_FORECAST.localHourLabel(s.windowEnd))}` : ' through forecast'} · ${esc(s.confidence)} confidence.</span></div>`
      : s?.signal === 'snow-event'
        ? `<div><small>Snow watch</small><strong>${s.eventSnowIn.toFixed(1)}&quot; modeled</strong><span>${esc(s.reason)}</span></div>`
        : `<div><small>Storm watch</small><strong>No meaningful burst</strong><span>${esc(s?.reason || 'No storm signal available.')}</span></div>`;
    return `<div class="state-forecast-mini">${weekend}${storm}</div>`;
  }

  async function loadTrail() {
    if (!trailRoot || !ctx.trail) return;
    try {
      const t=ctx.trail;
      const [weatherResponse, liveLayer] = await Promise.all([
        fetch(XC_FORECAST.forecastQuery(t.lat,t.lon,false,timezone)),
        loadLiveStatus()
      ]);
      if (!weatherResponse.ok) throw new Error(`weather ${weatherResponse.status}`);
      const weather = await weatherResponse.json();
      const comparison=XC_INTEL.compareYesterday(weather);
      const intel=comparison.current;
      const weekend=XC_FORECAST.weekendOutlook(weather);
      const storm=XC_FORECAST.stormWindow(weather);
      const live = liveLayer.byTrail.get(t.id) || null;
      const confidence=XC_INTEL.confidence(sourceFor(t,live),t);
      const delta = Number.isFinite(comparison.delta) ? `${comparison.delta>0?'+':''}${comparison.delta}` : '—';
      trailRoot.innerHTML=`
        ${liveLabel(live)}
        <div class="state-trail-score"><div><small>Modeled natural-snow score</small><b>${intel.snowScore}<span>/100 · ${XC_INTEL.scoreWord(intel.snowScore)}</span></b></div><p>${esc(intel.surface.detail)}</p></div>
        <div class="state-decision-grid"><div><small>Surface</small><strong>${esc(intel.surface.label)}</strong><span>${esc(intel.surface.detail)}</span></div><div><small>Best window</small><strong>${esc(intel.bestWindow.label)}</strong><span>${esc(intel.bestWindow.detail)}</span></div><div><small>Confidence</small><strong>${esc(confidence.label)}</strong><span>${esc(confidence.detail)}</span></div></div>
        ${trailForecast({weekend,storm})}
        <div class="state-metrics"><span><b>${intel.depth.toFixed(1)}&quot;</b><small>modeled base</small></span><span><b>${intel.snow24.toFixed(1)}&quot;</b><small>24h snow</small></span><span><b>${intel.snow72.toFixed(1)}&quot;</b><small>72h snow</small></span><span><b>${Math.round(intel.temp)}°F</b><small>now</small></span><span><b>${Math.round(intel.maxToday)}°F</b><small>today high</small></span><span><b>${intel.snowTomorrow.toFixed(1)}&quot;</b><small>tomorrow snow</small></span><span><b>${delta}</b><small>vs yesterday</small></span>${live?.baseMinIn != null ? `<span><b>${live.baseMinIn}${live.baseMaxIn != null && live.baseMaxIn !== live.baseMinIn ? `–${live.baseMaxIn}` : ''}&quot;</b><small>official reported base</small></span>` : ''}</div>`;
    } catch (error) {
      console.warn('State trail intelligence unavailable',error);
      trailRoot.innerHTML='<div class="state-empty"><strong>Live model unavailable.</strong><p>Verify the official trail source before traveling.</p></div>';
    }
  }

  if (trailRoot) loadTrail(); else loadBoard();
})();
