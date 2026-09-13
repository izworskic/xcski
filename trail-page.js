(() => {
  "use strict";

  const root = document.getElementById("trail-live");
  if (!root) return;

  const lat = Number(root.dataset.lat);
  const lon = Number(root.dataset.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const f = c => c * 9 / 5 + 32;
  const inchFromMeters = m => Number(m || 0) * 39.3701;
  const inchFromCm = cm => Number(cm || 0) / 2.54;
  const inchFromMm = mm => Number(mm || 0) / 25.4;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function nearestHourIndex(times, currentTime) {
    const target = Date.parse(currentTime);
    let best = 0;
    let gap = Infinity;
    (times || []).forEach((time, index) => {
      const d = Math.abs(Date.parse(time) - target);
      if (d < gap) { gap = d; best = index; }
    });
    return best;
  }

  function scoreSignal(row) {
    let score = 0;
    score += clamp(row.depth / 10, 0, 1) * 50;
    score += clamp(row.snow72 / 5, 0, 1) * 20;

    if (row.temp >= 10 && row.temp <= 30) score += 20;
    else if (row.temp > 30 && row.temp <= 32) score += 16;
    else if (row.temp >= 0 && row.temp < 10) score += 14;
    else if (row.temp > 32 && row.temp <= 35) score += 10;
    else if (row.temp < 0) score += 8;
    else score += 3;

    score += row.rainToday < 0.02 ? 10 : row.rainToday < 0.10 ? 5 : 0;
    if (row.minToday < 31 && row.maxToday > 35) score -= 8;
    if (row.maxToday > 39) score -= 8;
    if (row.rainToday >= 0.10) score -= 10;

    return Math.round(clamp(score, 0, 100));
  }

  function note(row) {
    if (row.rainToday >= 0.10) return "Rain is the largest surface risk in the modeled weather today.";
    if (row.minToday < 31 && row.maxToday > 35) return "A freeze/thaw cycle is possible. Verify the actual surface and grooming report.";
    if (row.maxToday > 38) return "Warmth may soften or damage tracks later in the day.";
    if (row.snow72 >= 4) return "A strong fresh-snow signal is present; grooming may lag the snowfall.";
    if (row.snow72 >= 2) return "Recent snowfall improves the natural-snow signal.";
    if (row.depth >= 8 && row.maxToday <= 32) return "Cold weather should help preserve the modeled natural base.";
    if (row.depth < 2) return "Modeled natural snow is thin. Snowmaking or packed base may differ.";
    return "The natural-snow signal is usable, but operator status should decide the trip.";
  }

  function scoreWord(score) {
    if (score >= 82) return "Strong";
    if (score >= 68) return "Promising";
    if (score >= 52) return "Mixed";
    if (score >= 35) return "Thin";
    return "Weak";
  }

  async function load() {
    try {
      const url = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(lat) +
        "&longitude=" + encodeURIComponent(lon) +
        "&current=temperature_2m&hourly=snow_depth,snowfall" +
        "&daily=temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum" +
        "&past_days=3&forecast_days=3&timezone=America%2FDetroit";

      const response = await fetch(url);
      if (!response.ok) throw new Error(`weather ${response.status}`);
      const d = await response.json();
      if (!d?.hourly || !d?.daily || !d?.current) throw new Error("weather payload incomplete");

      const hi = nearestHourIndex(d.hourly.time, d.current.time);
      const start = Math.max(0, hi - 71);
      const depth = inchFromMeters(d.hourly.snow_depth?.[hi] || 0);
      const snow72 = (d.hourly.snowfall || []).slice(start, hi + 1).reduce((sum, v) => sum + Number(v || 0), 0) / 2.54;
      const today = String(d.current.time || "").slice(0, 10);
      let di = (d.daily.time || []).indexOf(today);
      if (di < 0) di = Math.max(0, (d.daily.time || []).length - 3);

      const row = {
        depth,
        snow72,
        temp: f(d.current.temperature_2m),
        maxToday: f(d.daily.temperature_2m_max?.[di] ?? d.current.temperature_2m),
        minToday: f(d.daily.temperature_2m_min?.[di] ?? d.current.temperature_2m),
        rainToday: inchFromMm(d.daily.rain_sum?.[di] || 0),
        snowTomorrow: inchFromCm(d.daily.snowfall_sum?.[di + 1] || 0)
      };
      row.score = scoreSignal(row);

      const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", month: "numeric" }).format(new Date()));
      const offSeason = month >= 5 && month <= 10;
      const updated = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Detroit", hour: "numeric", minute: "2-digit"
      }).format(new Date());

      if (offSeason && row.snowTomorrow < 0.5) {
        root.innerHTML = `
          <div class="trail-live-state">
            <span class="trail-score-label">Preseason mode</span>
            <strong>Winter snow ranking is paused.</strong>
            <p>No meaningful near-term snow signal is showing here. Live winter scoring returns with the snow season.</p>
            <small>Weather checked ${updated} ET · Open-Meteo</small>
          </div>`;
        return;
      }

      root.innerHTML = `
        <div class="trail-live-head">
          <div>
            <span class="trail-score-label">Modeled natural-snow signal</span>
            <div class="trail-score-value">${row.score}<small>/100 · ${scoreWord(row.score)}</small></div>
          </div>
          <p>${note(row)}</p>
        </div>
        <div class="trail-live-metrics">
          <span><b>${row.depth.toFixed(1)}"</b><small>modeled base</small></span>
          <span><b>${row.snow72.toFixed(1)}"</b><small>72h snow</small></span>
          <span><b>${Math.round(row.temp)}°F</b><small>now</small></span>
          <span><b>${Math.round(row.maxToday)}°F</b><small>today high</small></span>
          <span><b>${row.snowTomorrow.toFixed(1)}"</b><small>tomorrow snow</small></span>
        </div>
        <p class="trail-live-source">Updated ${updated} ET · Open-Meteo. This does not confirm grooming, opening, safety, or access.</p>`;
    } catch (error) {
      console.warn("Trail snow read unavailable:", error);
      root.innerHTML = `
        <div class="trail-live-state">
          <span class="trail-score-label">Live snow unavailable</span>
          <strong>Use the operator report below.</strong>
          <p>This page does not substitute stale values when the weather feed fails.</p>
        </div>`;
    }
  }

  load();
})();