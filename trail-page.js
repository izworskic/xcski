(() => {
  "use strict";

  const root = document.getElementById("trail-live");
  if (!root || !window.XC_INTEL) return;

  const lat = Number(root.dataset.lat);
  const lon = Number(root.dataset.lon);
  const trailId = location.pathname.split('/').filter(Boolean).pop();
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !trailId) return;

  async function sourceForTrail() {
    try {
      const response = await fetch('/grooming-sources.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`source registry ${response.status}`);
      const registry = await response.json();
      return registry.sources?.[trailId] || null;
    } catch (error) {
      console.warn('Trail source registry unavailable:', error);
      return null;
    }
  }

  async function load() {
    try {
      const [response, source] = await Promise.all([
        fetch(XC_INTEL.forecastQuery(lat, lon)),
        sourceForTrail()
      ]);
      if (!response.ok) throw new Error(`weather ${response.status}`);
      const d = await response.json();
      const row = XC_INTEL.analyzeWeather(d);
      const trail = { id: trailId, cat: root.dataset.cat || '' };
      const confidence = XC_INTEL.confidence(source, trail);

      const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", month: "numeric" }).format(new Date()));
      const offSeason = month >= 5 && month <= 10;
      const updated = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Detroit", hour: "numeric", minute: "2-digit"
      }).format(new Date());

      if (offSeason && row.snowTomorrow < 0.5) {
        root.innerHTML = `
          <div class="trail-live-state">
            <span class="trail-score-label">Preseason mode</span>
            <strong>Winter surface ranking is paused.</strong>
            <p>The engine still checks this trailhead, but no meaningful near-term snow signal is showing. Winter scoring and time-of-day guidance return with the snow season.</p>
            <small>Weather checked ${updated} ET · Open-Meteo · source confidence ${confidence.label}</small>
          </div>`;
        return;
      }

      root.innerHTML = `
        <div class="trail-live-head">
          <div>
            <span class="trail-score-label">Modeled natural-snow score</span>
            <div class="trail-score-value">${row.snowScore}<small>/100 · ${XC_INTEL.scoreWord(row.snowScore)}</small></div>
          </div>
          <p>${row.surface.detail}</p>
        </div>

        <div class="trail-decision-grid">
          <div><small>Surface state</small><strong>${row.surface.label}</strong><span>${row.surface.detail}</span></div>
          <div><small>Best modeled window</small><strong>${row.bestWindow.label}</strong><span>${row.bestWindow.detail}</span></div>
          <div><small>Decision confidence</small><strong>${confidence.label}</strong><span>${confidence.detail}</span></div>
        </div>

        <div class="trail-live-metrics">
          <span><b>${row.depth.toFixed(1)}"</b><small>modeled base</small></span>
          <span><b>${row.snow24.toFixed(1)}"</b><small>24h snow</small></span>
          <span><b>${row.snow72.toFixed(1)}"</b><small>72h snow</small></span>
          <span><b>${Math.round(row.temp)}°F</b><small>now</small></span>
          <span><b>${Math.round(row.maxToday)}°F</b><small>today high</small></span>
          <span><b>${row.rain24.toFixed(2)}"</b><small>24h rain</small></span>
          <span><b>${row.snowTomorrow.toFixed(1)}"</b><small>tomorrow snow</small></span>
        </div>
        <p class="trail-live-source">Updated ${updated} ET · Open-Meteo. Surface and time-window guidance are modeled. Grooming, opening, safety, and access still require the source panel on this page.</p>`;
    } catch (error) {
      console.warn("Trail XC intelligence unavailable:", error);
      root.innerHTML = `
        <div class="trail-live-state">
          <span class="trail-score-label">Live intelligence unavailable</span>
          <strong>Use the operator report below.</strong>
          <p>This page does not substitute stale values when the weather feed fails.</p>
        </div>`;
    }
  }

  load();
})();