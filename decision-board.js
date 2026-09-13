(() => {
  "use strict";

  const BOARD_ID = "ski-board";
  const FILTERS = {
    all: () => true,
    groomed: r => r.cat === "groomed",
    classic: r => r.profile.classic,
    skate: r => Boolean(r.skate),
    rentals: r => Boolean(r.rentals),
    lighted: r => Boolean(r.lit),
    backcountry: r => r.cat === "backcountry"
  };

  const board = () => document.getElementById(BOARD_ID);
  const setState = text => { const el = document.getElementById("ski-board-state"); if (el) el.textContent = text; };

  function officialLink(id) {
    const link = document.querySelector(`#t-${CSS.escape(id)} a.ext`);
    return link ? link.href : "";
  }

  function trailProfile(trail) {
    const card = document.getElementById(`t-${trail.id}`);
    const text = card?.textContent?.toLowerCase() || "";
    return {
      classic: text.includes("classic") || trail.cat !== "backcountry",
      free: text.includes("free") || text.includes("donation"),
      lighted: Boolean(trail.lit),
      skate: Boolean(trail.skate),
      rentals: Boolean(trail.rentals)
    };
  }

  async function loadSourceRegistry() {
    try {
      const response = await fetch("/grooming-sources.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`source registry ${response.status}`);
      const registry = await response.json();
      if (!registry?.sources) throw new Error("source registry malformed");
      return registry;
    } catch (error) {
      console.warn("XC source registry unavailable:", error);
      return { version: 0, counts: {}, sources: {} };
    }
  }

  function sourcePresentation(row) {
    const source = row.source || {};
    const live = source.kind === "live-grooming-platform";
    const href = source.url || source.officialUrl || officialLink(row.id);
    return {
      href,
      className: live ? "live" : source.sourceClass === "operator-direct" ? "operator" : source.sourceClass === "land-manager-reference" ? "manager" : "reference",
      label: live ? "Live grooming source linked" : (source.label || "Status source"),
      provider: source.provider || "Operator / land manager",
      note: live && !source.currentIngested
        ? "Current provider values are not ingested until authorized API access is active."
        : source.sourceClass === "operator-direct"
          ? "Direct operator source; current grooming still requires verification."
          : source.sourceClass === "land-manager-reference"
            ? "Land-manager reference; grooming freshness may vary."
            : "Use this source to verify access and current trail status."
    };
  }

  function deltaMetric(row) {
    if (!Number.isFinite(row.scoreDelta)) return "";
    const sign = row.scoreDelta > 0 ? "+" : "";
    return `<span><b>${sign}${row.scoreDelta}</b><small>vs yesterday</small></span>`;
  }

  function formatRow(row, rank) {
    const source = sourcePresentation(row);
    const official = officialLink(row.id);
    const separateSource = source.href && source.href !== official;
    return `
      <article class="ski-pick">
        <div class="ski-pick-rank" aria-label="Rank ${rank}">${rank}</div>
        <div class="ski-pick-main">
          <div class="ski-pick-title">
            <div>
              <h3>${row.name}</h3>
              <p>${row.town} · ${row.cat === "groomed" ? "groomed system" : row.cat === "volunteer" ? "volunteer-groomed / managed" : "backcountry / skier-tracked"}</p>
            </div>
            <div class="ski-score" aria-label="Modeled natural-snow score ${row.snowScore} out of 100">
              <b>${row.snowScore}</b><span>${XC_INTEL.scoreWord(row.snowScore)}</span>
            </div>
          </div>

          <div class="ski-decision-strip">
            <div><small>Surface</small><strong>${row.surface.label}</strong><span>${row.surface.detail}</span></div>
            <div><small>Best window</small><strong>${row.bestWindow.label}</strong><span>${row.bestWindow.detail}</span></div>
            <div><small>Confidence</small><strong>${row.confidence.label}</strong><span>${row.confidence.detail}</span></div>
          </div>

          <div class="ski-pick-metrics">
            <span><b>${row.depth.toFixed(1)}"</b><small>modeled base</small></span>
            <span><b>${row.snow24.toFixed(1)}"</b><small>24h snow</small></span>
            <span><b>${row.snow72.toFixed(1)}"</b><small>72h snow</small></span>
            <span><b>${Math.round(row.temp)}°</b><small>now</small></span>
            <span><b>${Math.round(row.maxToday)}°</b><small>today high</small></span>
            <span><b>${row.snowTomorrow.toFixed(1)}"</b><small>tomorrow snow</small></span>
            ${deltaMetric(row)}
          </div>

          <div class="ski-source ski-source-${source.className}">
            <span>${source.label}</span>
            <strong>${source.provider}</strong>
            <small>${source.note}</small>
          </div>
          <div class="ski-pick-actions">
            <a href="/trails/${row.id}/">Full trail intelligence</a>
            <button type="button" data-jump-trail="${row.id}">Find in directory</button>
            ${separateSource ? `<a class="ski-source-link" href="${source.href}" target="_blank" rel="noopener">Open ${source.provider}</a>` : ""}
            ${official ? `<a href="${official}" target="_blank" rel="noopener">Verify official status</a>` : ""}
          </div>
        </div>
      </article>`;
  }

  function render(rows, filterName = "all") {
    const list = document.getElementById("ski-board-list");
    if (!list) return;
    const filter = FILTERS[filterName] || FILTERS.all;
    const shown = rows.filter(filter).sort((a, b) => (b.snowScore - a.snowScore) || ((b.bestWindow.score || 0) - (a.bestWindow.score || 0))).slice(0, 5);
    list.innerHTML = shown.length ? shown.map((row, i) => formatRow(row, i + 1)).join("") : '<div class="ski-preseason"><strong>No matching trails.</strong><p>Try another use filter.</p></div>';
    const names = {
      all: `all ${TRAILS.length} trails`, groomed: "groomed centers", classic: "classic-capable systems",
      skate: "skate-capable systems", rentals: "trails with rentals", lighted: "lighted systems", backcountry: "backcountry / skier-tracked systems"
    };
    const label = document.getElementById("ski-board-filter-label");
    if (label) label.textContent = `Ranking ${names[filterName] || names.all} by modeled snow signal, with surface timing, source confidence, and same-hour change since yesterday shown separately.`;
  }

  function renderOffSeason(rows, registry) {
    const list = document.getElementById("ski-board-list");
    if (!list) return;
    const filters = document.querySelector(".ski-board-filters");
    if (filters) filters.hidden = true;
    const forecast = rows.filter(r => r.snowTomorrow >= 0.5).sort((a, b) => b.snowTomorrow - a.snowTomorrow).slice(0, 3);
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
        <p>The engine has audited status-source coverage for ${Object.keys(registry.sources || {}).length} trails. Winter snow, surface, time-of-day, and day-over-day rankings switch on when the season returns.</p>
        <a href="#map">Explore all ${TRAILS.length} trails</a>
      </div>`;
    setState("Preseason mode");
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

  async function load() {
    const root = board();
    if (!root || typeof TRAILS === "undefined" || !Array.isArray(TRAILS) || !window.XC_INTEL) return;
    const now = new Date();
    const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", month: "numeric" }).format(now));
    const offSeason = month >= 5 && month <= 10;

    try {
      setState(`Updating ${TRAILS.length} trailheads…`);
      const lats = TRAILS.map(t => t.lat).join(",");
      const lons = TRAILS.map(t => t.lon).join(",");
      const [weatherResponse, registry] = await Promise.all([
        fetch(XC_INTEL.forecastQuery(lats, lons, true, "America/Detroit")),
        loadSourceRegistry()
      ]);
      if (!weatherResponse.ok) throw new Error(`weather ${weatherResponse.status}`);
      let weather = await weatherResponse.json();
      if (!Array.isArray(weather)) weather = [weather];

      const rows = TRAILS.map((trail, index) => {
        const d = weather[index];
        if (!d) return null;
        const comparison = XC_INTEL.compareYesterday(d);
        const intelligence = comparison.current;
        const source = registry.sources?.[trail.id] || null;
        return {
          ...trail,
          ...intelligence,
          scoreDelta: comparison.delta,
          previousSurface: comparison.previous?.surface?.label || null,
          previousBestWindow: comparison.previous?.bestWindow?.label || null,
          profile: trailProfile(trail),
          source,
          confidence: XC_INTEL.confidence(source, trail)
        };
      }).filter(Boolean);
      if (!rows.length) throw new Error("no trail weather returned");

      const updated = new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit" }).format(now);
      const liveSources = rows.filter(r => r.source?.kind === "live-grooming-platform").length;
      const freshness = document.getElementById("ski-board-freshness");
      if (freshness) freshness.textContent = `Weather updated ${updated} ET · Open-Meteo · day-over-day compares the same local hour · ${rows.length}/${TRAILS.length} trail status sources audited · ${liveSources} live-platform handoff${liveSources === 1 ? "" : "s"}`;

      wireInteractions(rows);
      if (offSeason) renderOffSeason(rows, registry);
      else {
        const filters = document.querySelector(".ski-board-filters");
        if (filters) filters.hidden = false;
        setState("Live statewide winter board");
        render(rows, "all");
      }
    } catch (error) {
      console.warn("Michigan Nordic Board unavailable:", error);
      setState("Live board temporarily unavailable");
      const list = document.getElementById("ski-board-list");
      if (list) list.innerHTML = '<div class="ski-preseason"><strong>The live intelligence layer could not load.</strong><p>The trail directory and official status links remain available below. The engine does not substitute stale values.</p><a href="#map">Use the trail map</a></div>';
    }
  }

  load();
})();