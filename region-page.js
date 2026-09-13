(() => {
  "use strict";

  const root = document.getElementById('region-board');
  const trails = window.REGION_TRAILS;
  if (!root || !Array.isArray(trails) || !trails.length || !window.XC_INTEL) return;

  const FILTERS = {
    all: () => true,
    groomed: r => r.cat === 'groomed',
    classic: r => r.classic,
    skate: r => Boolean(r.skate),
    rentals: r => Boolean(r.rentals)
  };

  async function registry() {
    try {
      const r = await fetch('/grooming-sources.json', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (error) {
      console.warn('Regional source registry unavailable:', error);
      return { sources: {} };
    }
  }

  function rowHtml(row, rank) {
    return `<article class="region-pick">
      <div class="region-rank">${rank}</div>
      <div class="region-pick-body">
        <div class="region-pick-head"><div><h3><a href="/trails/${row.id}/">${row.name}</a></h3><p>${row.town}</p></div><div class="region-score"><b>${row.snowScore}</b><span>${XC_INTEL.scoreWord(row.snowScore)}</span></div></div>
        <div class="region-decision"><span><small>Surface</small><b>${row.surface.label}</b></span><span><small>Best window</small><b>${row.bestWindow.label}</b></span><span><small>Confidence</small><b>${row.confidence.label}</b></span></div>
        <div class="region-metrics"><span>${row.depth.toFixed(1)}" base</span><span>${row.snow24.toFixed(1)}" / 24h</span><span>${Math.round(row.temp)}°F now</span><span>${row.snowTomorrow.toFixed(1)}" tomorrow</span></div>
      </div>
    </article>`;
  }

  function render(rows, filterName) {
    const filter = FILTERS[filterName] || FILTERS.all;
    const shown = rows.filter(filter).sort((a,b) => (b.snowScore - a.snowScore) || ((b.bestWindow.score || 0) - (a.bestWindow.score || 0))).slice(0,5);
    root.innerHTML = shown.length ? shown.map((row,i) => rowHtml(row,i+1)).join('') : '<div class="region-empty">No trails match this filter.</div>';
  }

  async function load() {
    try {
      const lats = trails.map(t => t.lat).join(',');
      const lons = trails.map(t => t.lon).join(',');
      const [weatherResponse, sourceRegistry] = await Promise.all([
        fetch(XC_INTEL.forecastQuery(lats, lons, true)),
        registry()
      ]);
      if (!weatherResponse.ok) throw new Error(`weather ${weatherResponse.status}`);
      let weather = await weatherResponse.json();
      if (!Array.isArray(weather)) weather = [weather];
      const rows = trails.map((trail, index) => {
        const intel = XC_INTEL.analyzeWeather(weather[index]);
        const source = sourceRegistry.sources?.[trail.id] || null;
        return { ...trail, ...intel, confidence: XC_INTEL.confidence(source, trail) };
      });

      const month = Number(new Intl.DateTimeFormat('en-US', { timeZone:'America/Detroit', month:'numeric' }).format(new Date()));
      const offSeason = month >= 5 && month <= 10;
      const state = document.getElementById('region-board-state');
      const freshness = document.getElementById('region-freshness');
      const updated = new Intl.DateTimeFormat('en-US', { timeZone:'America/Detroit', hour:'numeric', minute:'2-digit' }).format(new Date());
      if (freshness) freshness.textContent = `Updated ${updated} ET · ${trails.length} regional trailheads · Open-Meteo + audited status sources`;

      if (offSeason) {
        const watch = rows.filter(r => r.snowTomorrow >= .5).sort((a,b) => b.snowTomorrow - a.snowTomorrow).slice(0,3);
        if (state) state.textContent = watch.length ? 'Preseason snow watch' : 'Preseason mode';
        if (watch.length) root.innerHTML = watch.map((row,i) => rowHtml(row,i+1)).join('');
        else root.innerHTML = '<div class="region-empty"><strong>Winter rankings are paused.</strong><p>This regional board switches on with the snow season. Trail profiles and official status sources remain available below.</p></div>';
        document.querySelector('.region-filters')?.setAttribute('hidden','');
        return;
      }

      if (state) state.textContent = 'Live regional board';
      render(rows, 'all');
      document.querySelectorAll('[data-region-filter]').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('[data-region-filter]').forEach(b => b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
        render(rows, btn.dataset.regionFilter);
      }));
    } catch (error) {
      console.warn('Regional XC board unavailable:', error);
      const state = document.getElementById('region-board-state');
      if (state) state.textContent = 'Live board unavailable';
      root.innerHTML = '<div class="region-empty">Live regional intelligence could not load. Use the trail links below for official status handoffs.</div>';
    }
  }

  load();
})();