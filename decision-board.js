(() => {
  "use strict";

  const BOARD_ID = "ski-board";
  const FILTERS = {
    all: () => true,
    groomed: t => t.cat === "groomed",
    skate: t => Boolean(t.skate),
    rentals: t => Boolean(t.rentals)
  };

  const f = c => c * 9 / 5 + 32;
  const inchFromMeters = m => Number(m || 0) * 39.3701;
  const inchFromCm = cm => Number(cm || 0) / 2.54;
  const inchFromMm = mm => Number(mm || 0) / 25.4;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function board() {
    return document.getElementById(BOARD_ID);
  }

  function setState(text) {
    const el = document.getElementById("ski-board-state");
    if (el) el.textContent = text;
  }

  function classify(score) {
    if (score >= 82) return "Strong";
    if (score >= 68) return "Promising";
    if (score >= 52) return "Mixed";
    if (score >= 35) return "Thin";
    return "Weak";
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

  function conditionNote(row) {
    if (row.rainToday >= 0.10) return "Rain is the biggest surface risk today.";
    if (row.minToday < 31 && row.maxToday > 35) return "Freeze/thaw cycle possible; verify the surface before driving.";
    if (row.maxToday > 38) return "Warmth can soften or damage tracks later today.";
    if (row.snow72 >= 4) return "Strong fresh-snow signal; grooming may lag the snowfall.";
    if (row.snow72 >= 2) return "Recent snow improves the natural-snow signal.";
    if (row.depth >= 8 && row.maxToday <= 32) return "Cold weather should help preserve the modeled natural base.";
    if (row.depth < 2) return "Natural snow looks thin here; snowmaking or packed base may differ.";
    return "Natural-snow signal is usable, but grooming still needs local verification.";
  }

  function officialLink(id) {
    const link = document.querySelector(`#t-${CSS.escape(id)} a.ext`);
    return link ? link.href : "";
  }

  function formatRow(row, rank) {
    const href = officialLink(row.id);
    const scoreLabel = classify(row.score);
    const tomorrow = Number.isFinite(row.snowTomorrow)
      ? `<span><b>${row.snowTomorrow.toFixed(1)}"</b><small>tomorrow snow</small></span>`
      : "";
    return `
      <article class="ski-pick">
        <div class="ski-pick-rank" aria-label="Rank ${rank}">${rank}</div>
        <div class="ski-pick-main">
          <div class="ski-pick-title">
            <div>
              <h3>${row.name}</h3>
              <p>${row.town} · ${row.cat === "groomed" ? "groomed system" : row.cat === "volunteer" ? "volunteer-groomed / managed" : "backcountry / skier-tracked"}</p>
            </div>
            <div class="ski-score" aria-label="Modeled snow signal ${row.score} out of 100">
              <b>${row.score}</b><span>${scoreLabel}</span>
            </div>
          </div>
          <div class="ski-pick-metrics">
            <span><b>${row.depth.toFixed(1)}"</b><small>modeled base</small></span>
            <span><b>${row.snow72.toFixed(1)}"</b><small>72h snow</small></span>
            <span><b>${Math.round(row.temp)}°</b><small>now</small></span>
            <span><b>${Math.round(row.maxToday)}°</b><small>today high</small></span>
            ${tomorrow}
          </div>
          <p class="ski-pick-note">${conditionNote(row)}</p>
          <div class="ski-pick-actions">
            <button type="button" data-jump-trail="${row.id}">See trail details</button>
            ${href ? `<a href="${href}" target="_blank" rel="noopener">Verify official status</a>` : ""}
          </div>
        </div>
      </article>`;
  }

  function render(rows, filterName = "all") {
    const list = document.getElementById("ski-board-list");
    if (!list) return;
    const filter = FILTERS[filterName] || FILTERS.all;
    const shown = rows.filter(filter).sort((a, b) => b.score - a.score).slice(0, 5);
    list.innerHTML = shown.map((row, i) => formatRow(row, i + 1)).join("");
    const label = document.getElementById("ski-board-filter-label");
    if (label) {
      const names = { all: "all 48 trails", groomed: "groomed centers", skate: "skate-capable systems", rentals: "trails with rentals" };
      label.textContent = `Showing the strongest modeled natural-snow signals among ${names[filterName] || names.all}.`;
    }
  }

  function renderOffSeason(rows) {
    const list = document.getElementById("ski-board-list");
    if (!list) return;
    const filters = document.querySelector(".ski-board-filters");
    if (filters) filters.hidden = true;
    const forecast = rows
      .filter(r => (r.snowTomorrow || 0) >= 0.5)
      .sort((a, b) => (b.snowTomorrow || 0) - (a.snowTomorrow || 0))
      .slice(0, 3);

    if (forecast.length) {
      list.innerHTML = forecast.map((row, i) => formatRow(row, i + 1)).join("");
      setState("Preseason snow watch");
      const label = document.getElementById("ski-board-filter-label");
      if (label) label.textContent = "Off-season mode: showing locations with a meaningful modeled near-term snow signal.";
      return;
    }

    list.innerHTML = `
      <div class="ski-preseason">
        <strong>Winter rankings are paused.</strong>
        <p>The Michigan Nordic Board activates when winter returns. Until then, use the 48-trail map to plan trips and bookmark operator status pages. No meaningful near-term snow signal is showing at the trailheads right now.</p>
        <a href="#map">Explore all 48 trails</a>
      </div>`;
    setState("Preseason mode");
    const label = document.getElementById("ski-board-filter-label");
    if (label) label.textContent = "Live rankings return with the winter snow season.";
  }

  function wireInteractions(rows) {
    document.querySelectorAll("[data-board-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-board-filter]").forEach(b => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        render(rows, btn.dataset.boardFilter);
      });
    });

    document.addEventListener("click", event => {
      const btn = event.target.closest("[data-jump-trail]");
      if (!btn) return;
      const target = document.getElementById(`t-${btn.dataset.jumpTrail}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("ski-highlight");
        setTimeout(() => target.classList.remove("ski-highlight"), 1800);
      }
    });
  }

  function nearestHourIndex(hourlyTimes, currentTime) {
    if (!Array.isArray(hourlyTimes) || !hourlyTimes.length) return 0;
    const target = Date.parse(currentTime);
    let best = 0;
    let gap = Infinity;
    hourlyTimes.forEach((time, index) => {
      const d = Math.abs(Date.parse(time) - target);
      if (d < gap) { gap = d; best = index; }
    });
    return best;
  }

  async function load() {
    const root = board();
    if (!root || typeof TRAILS === "undefined" || !Array.isArray(TRAILS)) return;

    const now = new Date();
    const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", month: "numeric" }).format(now));
    const offSeason = month >= 5 && month <= 10;

    try {
      setState("Updating 48 trailheads…");
      const lats = TRAILS.map(t => t.lat).join(",");
      const lons = TRAILS.map(t => t.lon).join(",");
      const url = "https://api.open-meteo.com/v1/forecast?latitude=" + encodeURIComponent(lats) +
        "&longitude=" + encodeURIComponent(lons) +
        "&current=temperature_2m&hourly=snow_depth,snowfall" +
        "&daily=temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum" +
        "&past_days=3&forecast_days=3&timezone=America%2FDetroit";

      const response = await fetch(url);
      if (!response.ok) throw new Error(`weather ${response.status}`);
      let data = await response.json();
      if (!Array.isArray(data)) data = [data];

      const rows = TRAILS.map((trail, index) => {
        const d = data[index];
        if (!d || !d.hourly || !d.daily || !d.current) return null;
        const hi = nearestHourIndex(d.hourly.time, d.current.time);
        const start = Math.max(0, hi - 71);
        const depth = inchFromMeters(d.hourly.snow_depth?.[hi] || 0);
        const snow72 = (d.hourly.snowfall || []).slice(start, hi + 1).reduce((sum, v) => sum + Number(v || 0), 0) / 2.54;
        const today = String(d.current.time || "").slice(0, 10);
        let di = (d.daily.time || []).indexOf(today);
        if (di < 0) di = Math.max(0, (d.daily.time || []).length - 3);
        const row = {
          ...trail,
          depth,
          snow72,
          temp: f(d.current.temperature_2m),
          maxToday: f(d.daily.temperature_2m_max?.[di] ?? d.current.temperature_2m),
          minToday: f(d.daily.temperature_2m_min?.[di] ?? d.current.temperature_2m),
          rainToday: inchFromMm(d.daily.rain_sum?.[di] || 0),
          snowTomorrow: inchFromCm(d.daily.snowfall_sum?.[di + 1] || 0)
        };
        row.score = scoreSignal(row);
        return row;
      }).filter(Boolean);

      if (!rows.length) throw new Error("no trail weather returned");

      const updated = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Detroit", hour: "numeric", minute: "2-digit"
      }).format(now);

      const freshness = document.getElementById("ski-board-freshness");
      if (freshness) freshness.textContent = `Weather updated ${updated} ET · Open-Meteo · grooming/open status remains operator-verified`;

      wireInteractions(rows);
      if (offSeason) renderOffSeason(rows);
      else {
        const filters = document.querySelector(".ski-board-filters");
        if (filters) filters.hidden = false;
        setState("Live winter board");
        render(rows, "all");
      }
    } catch (error) {
      console.warn("Michigan Nordic Board unavailable:", error);
      setState("Live board temporarily unavailable");
      const list = document.getElementById("ski-board-list");
      if (list) {
        list.innerHTML = `
          <div class="ski-preseason">
            <strong>The live ranking could not load.</strong>
            <p>The trail directory and official status links are still available below. This board never substitutes stale values when the weather feed fails.</p>
            <a href="#map">Use the trail map</a>
          </div>`;
      }
    }
  }

  load();
})();