(() => {
  "use strict";

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const f = c => Number(c) * 9 / 5 + 32;
  const inchFromMeters = m => Number(m || 0) * 39.3701;
  const inchFromCm = cm => Number(cm || 0) / 2.54;
  const inchFromMm = mm => Number(mm || 0) / 25.4;

  function nearestHourIndex(times, currentTime) {
    if (!Array.isArray(times) || !times.length) return 0;
    const target = Date.parse(currentTime);
    let best = 0;
    let gap = Infinity;
    times.forEach((time, index) => {
      const d = Math.abs(Date.parse(time) - target);
      if (d < gap) { gap = d; best = index; }
    });
    return best;
  }

  function todayIndices(times, currentTime) {
    const day = String(currentTime || "").slice(0, 10);
    return (times || []).map((time, index) => String(time).startsWith(day) ? index : -1).filter(index => index >= 0);
  }

  function windowStats(d, indices, startHour, endHour) {
    const selected = indices.filter(index => {
      const hour = Number(String(d.hourly.time[index]).slice(11, 13));
      return hour >= startHour && hour <= endHour;
    });
    if (!selected.length) return null;
    const temps = selected.map(i => f(d.hourly.temperature_2m?.[i] ?? d.current.temperature_2m));
    const rain = selected.reduce((sum, i) => sum + Number(d.hourly.rain?.[i] || 0), 0);
    const snow = selected.reduce((sum, i) => sum + Number(d.hourly.snowfall?.[i] || 0), 0);
    const wind = selected.map(i => Number(d.hourly.wind_speed_10m?.[i] || 0));
    const cloud = selected.map(i => Number(d.hourly.cloud_cover?.[i] || 0));
    return {
      tempAvg: temps.reduce((a, b) => a + b, 0) / temps.length,
      tempMin: Math.min(...temps),
      tempMax: Math.max(...temps),
      rain: inchFromMm(rain),
      snow: inchFromCm(snow),
      windMax: Math.max(...wind),
      cloudAvg: cloud.reduce((a, b) => a + b, 0) / cloud.length
    };
  }

  function scoreSnow(row) {
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
    if (row.freezeThaw) score -= 8;
    if (row.maxToday > 39) score -= 8;
    if (row.rainToday >= 0.10) score -= 10;
    return Math.round(clamp(score, 0, 100));
  }

  function scoreWord(score) {
    if (score >= 82) return "Strong";
    if (score >= 68) return "Promising";
    if (score >= 52) return "Mixed";
    if (score >= 35) return "Thin";
    return "Weak";
  }

  function surfaceState(row) {
    if (row.rain24 >= 0.10 || row.rainToday >= 0.15) return { label: "Wet-surface risk", detail: "Rain is the dominant surface risk; verify the operator report before driving." };
    if (row.freezeThaw && row.morning?.tempAvg <= 31) return { label: "Firm / refrozen early", detail: "An overnight freeze followed by daytime warming can make the morning fast and firm before later softening." };
    if (row.snow24 >= 2) return { label: "Fresh snow", detail: "At least 2 inches of modeled snow fell in the last 24 hours; grooming may lag the snowfall." };
    if (row.snow24 >= 0.5) return { label: "Freshened surface", detail: "Recent modeled snowfall should freshen the natural surface, subject to grooming and wind." };
    if (row.maxToday > 36) return { label: "Softening later", detail: "Above-freezing warmth raises the chance of softer tracks and a better early window." };
    if (row.depth >= 6 && row.maxToday <= 32) return { label: "Cold base holding", detail: "Cold temperatures should help preserve the modeled natural base through the day." };
    if (row.depth < 2) return { label: "Thin natural cover", detail: "Modeled natural snow is limited; snowmaking or packed trail base may differ." };
    return { label: "Stable winter signal", detail: "No major modeled rain or thaw signal stands out; grooming remains the deciding source." };
  }

  function windowScore(stats, row, name) {
    if (!stats) return -Infinity;
    let score = 70;
    const t = stats.tempAvg;
    if (t >= 15 && t <= 30) score += 12;
    else if (t > 30 && t <= 32) score += 9;
    else if (t > 32 && t <= 35) score += 2;
    else if (t < 5) score -= 8;
    else if (t > 35) score -= 12;
    if (stats.rain >= 0.02) score -= 25;
    if (stats.snow >= 0.25) score += 4;
    if (stats.windMax >= 22) score -= 10;
    else if (stats.windMax >= 16) score -= 5;
    if (row.freezeThaw && name === "morning" && stats.tempAvg <= 30) score -= 7;
    if (row.freezeThaw && name === "midday" && stats.tempAvg >= 28 && stats.tempAvg <= 34) score += 5;
    if (name === "afternoon" && stats.tempMax > 36) score -= 8;
    return Math.round(clamp(score, 0, 100));
  }

  function bestWindow(row) {
    const windows = [
      { key: "morning", label: "Morning", stats: row.morning },
      { key: "midday", label: "Midday", stats: row.midday },
      { key: "afternoon", label: "Afternoon", stats: row.afternoon }
    ].map(item => ({ ...item, score: windowScore(item.stats, row, item.key) }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score);
    if (!windows.length) return { label: "Check locally", score: null, detail: "Hourly surface window unavailable." };
    const best = windows[0];
    let detail = `${Math.round(best.stats.tempAvg)}°F average`;
    if (best.stats.rain >= 0.02) detail += " · rain risk";
    else if (best.stats.snow >= 0.25) detail += " · snow falling";
    if (best.stats.windMax >= 16) detail += ` · wind ${Math.round(best.stats.windMax)} mph`;
    return { label: best.label, score: best.score, detail };
  }

  function confidence(source, trail) {
    if (source?.integration === "authorized-api" && source?.liveData === true) {
      return { label: "High", score: 92, detail: "Current authorized grooming/status data plus weather intelligence." };
    }
    if (source?.kind === "live-grooming-platform") {
      return { label: "Moderate", score: 68, detail: "A live grooming source exists, but current provider values are not yet ingested." };
    }
    if (source?.sourceClass === "operator-direct") {
      return { label: "Moderate", score: 60, detail: "Direct operator source plus weather model; current grooming is not machine-ingested." };
    }
    if (source?.sourceClass === "land-manager-reference") {
      return { label: "Limited", score: 45, detail: "Land-manager reference plus weather model; current grooming freshness is unknown." };
    }
    if (trail?.cat === "backcountry") {
      return { label: "Limited", score: 42, detail: "Weather model plus land/access verification; machine grooming may not apply." };
    }
    return { label: "Limited", score: 38, detail: "Weather intelligence is available, but no current machine-readable grooming source is registered." };
  }

  function analyzeWeather(d) {
    if (!d?.hourly || !d?.daily || !d?.current) throw new Error("weather payload incomplete");
    const hi = nearestHourIndex(d.hourly.time, d.current.time);
    const start72 = Math.max(0, hi - 71);
    const start24 = Math.max(0, hi - 23);
    const depth = inchFromMeters(d.hourly.snow_depth?.[hi] || 0);
    const snow72 = (d.hourly.snowfall || []).slice(start72, hi + 1).reduce((sum, v) => sum + Number(v || 0), 0) / 2.54;
    const snow24 = (d.hourly.snowfall || []).slice(start24, hi + 1).reduce((sum, v) => sum + Number(v || 0), 0) / 2.54;
    const rain24 = inchFromMm((d.hourly.rain || []).slice(start24, hi + 1).reduce((sum, v) => sum + Number(v || 0), 0));
    const today = String(d.current.time || "").slice(0, 10);
    let di = (d.daily.time || []).indexOf(today);
    if (di < 0) di = Math.max(0, (d.daily.time || []).length - 3);
    const indices = todayIndices(d.hourly.time, d.current.time);
    const row = {
      depth,
      snow72,
      snow24,
      rain24,
      temp: f(d.current.temperature_2m),
      maxToday: f(d.daily.temperature_2m_max?.[di] ?? d.current.temperature_2m),
      minToday: f(d.daily.temperature_2m_min?.[di] ?? d.current.temperature_2m),
      rainToday: inchFromMm(d.daily.rain_sum?.[di] || 0),
      snowTomorrow: inchFromCm(d.daily.snowfall_sum?.[di + 1] || 0),
      morning: windowStats(d, indices, 7, 10),
      midday: windowStats(d, indices, 11, 13),
      afternoon: windowStats(d, indices, 14, 17)
    };
    row.freezeThaw = row.minToday < 31 && row.maxToday > 35;
    row.snowScore = scoreSnow(row);
    row.surface = surfaceState(row);
    row.bestWindow = bestWindow(row);
    return row;
  }

  function forecastQuery(latitude, longitude, multi = false) {
    const lat = multi ? latitude : encodeURIComponent(latitude);
    const lon = multi ? longitude : encodeURIComponent(longitude);
    return "https://api.open-meteo.com/v1/forecast?latitude=" + lat +
      "&longitude=" + lon +
      "&current=temperature_2m" +
      "&hourly=temperature_2m,snow_depth,snowfall,rain,wind_speed_10m,cloud_cover" +
      "&daily=temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum" +
      "&past_days=3&forecast_days=3&wind_speed_unit=mph&timezone=America%2FDetroit";
  }

  window.XC_INTEL = {
    analyzeWeather,
    confidence,
    forecastQuery,
    scoreSnow,
    scoreWord,
    surfaceState,
    bestWindow
  };
})();