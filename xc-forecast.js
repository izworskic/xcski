(() => {
  'use strict';

  if (!window.XC_INTEL) return;

  const inchFromCm = cm => Number(cm || 0) / 2.54;
  const inchFromMeters = m => Number(m || 0) * 39.3701;
  const inchFromMm = mm => Number(mm || 0) / 25.4;
  const f = c => Number(c) * 9 / 5 + 32;

  function weekday(date) {
    return new Date(`${date}T12:00:00Z`).getUTCDay();
  }

  function localHourLabel(time) {
    if (!time) return null;
    const [date, clock = '12:00'] = String(time).split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute = 0] = clock.split(':').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day, hour, minute));
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC'
    }).format(d);
  }

  function dayLabel(date) {
    const [year, month, day] = String(date).split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  }

  function analyzeDay(d, date) {
    if (!date || !(d?.daily?.time || []).includes(date)) return null;
    const row = XC_INTEL.analyzeWeatherAt(d, `${date}T12:00`);
    const di = d.daily.time.indexOf(date);
    return {
      ...row,
      date,
      label: dayLabel(date),
      dailySnow: inchFromCm(d.daily.snowfall_sum?.[di] || 0),
      dailyRain: inchFromMm(d.daily.rain_sum?.[di] || 0)
    };
  }

  function weekendOutlook(d) {
    const days = d?.daily?.time || [];
    const currentDay = String(d?.current?.time || '').slice(0, 10);
    const saturdayIndex = days.findIndex(date => date >= currentDay && weekday(date) === 6);
    if (saturdayIndex < 0) return { available: false, reason: 'Saturday is outside the current forecast range.' };
    const sundayDate = days.slice(saturdayIndex + 1).find(date => weekday(date) === 0);
    if (!sundayDate) return { available: false, reason: 'Sunday is outside the current forecast range.' };
    const saturday = analyzeDay(d, days[saturdayIndex]);
    const sunday = analyzeDay(d, sundayDate);
    if (!saturday || !sunday) return { available: false, reason: 'Weekend weather data is incomplete.' };

    const difference = saturday.snowScore - sunday.snowScore;
    const better = Math.abs(difference) <= 2 ? 'Tie' : difference > 0 ? 'Saturday' : 'Sunday';
    const best = difference >= 0 ? saturday : sunday;
    const weaker = difference >= 0 ? sunday : saturday;
    const reasons = [];
    if (best.dailySnow >= 0.5) reasons.push(`${best.dailySnow.toFixed(1)}" modeled snow`);
    if (best.dailyRain >= 0.05) reasons.push('rain risk');
    if (best.maxToday > 36) reasons.push('afternoon softening risk');
    if (best.maxToday <= 32) reasons.push('subfreezing daytime temperatures');
    if (!reasons.length) reasons.push(best.surface.label.toLowerCase());

    return {
      available: true,
      saturday,
      sunday,
      betterDay: better,
      scoreDifference: difference,
      best,
      weaker,
      summary: better === 'Tie'
        ? `Saturday and Sunday carry similar modeled XC signals (${saturday.snowScore} vs ${sunday.snowScore}).`
        : `${better} has the stronger modeled XC signal (${best.snowScore} vs ${weaker.snowScore}) because of ${reasons.join(' and ')}.`
    };
  }

  function sum(values, start, count) {
    return (values || []).slice(start, start + count).reduce((total, value) => total + Number(value || 0), 0);
  }

  function maxRollingSnow(d, startIndex, hours = 24, horizon = 168) {
    const snow = d?.hourly?.snowfall || [];
    const end = Math.min(snow.length, startIndex + horizon);
    let best = { start: startIndex, end: Math.min(end - 1, startIndex + hours - 1), totalIn: 0 };
    for (let i = startIndex; i < end; i++) {
      const totalIn = inchFromCm(sum(snow, i, Math.min(hours, end - i)));
      if (totalIn > best.totalIn) best = { start: i, end: Math.min(end - 1, i + hours - 1), totalIn };
    }
    return best;
  }

  function forecastConfidence(leadHours) {
    if (leadHours <= 48) return 'Higher';
    if (leadHours <= 96) return 'Moderate';
    return 'Lower';
  }

  function stormWindow(d) {
    if (!d?.hourly?.time?.length || !d?.current?.time) return { available: false, signal: 'none', reason: 'Hourly forecast unavailable.' };
    const times = d.hourly.time;
    let currentIndex = times.findIndex(time => time === d.current.time);
    if (currentIndex < 0) {
      const target = String(d.current.time).slice(0, 13);
      currentIndex = Math.max(0, times.findIndex(time => String(time).startsWith(target)));
    }
    const rolling = maxRollingSnow(d, currentIndex, 24, 168);
    if (rolling.totalIn < 1.5) {
      return {
        available: true,
        signal: 'none',
        eventSnowIn: rolling.totalIn,
        reason: `No 24-hour modeled snowfall burst reaches 1.5" in the next 7 days.`
      };
    }

    const snow = d.hourly.snowfall || [];
    let eventStart = rolling.start;
    while (eventStart < rolling.end && Number(snow[eventStart] || 0) <= 0.01) eventStart++;
    let eventEnd = rolling.end;
    while (eventEnd > eventStart && Number(snow[eventEnd] || 0) <= 0.01) eventEnd--;
    const eventSnowIn = inchFromCm(sum(snow, eventStart, eventEnd - eventStart + 1));

    let cumulative = 0;
    let windowStart = null;
    const searchEnd = Math.min(times.length, eventEnd + 37);
    for (let i = eventStart; i < searchEnd; i++) {
      cumulative += inchFromCm(Number(snow[i] || 0));
      const temp = f(d.hourly.temperature_2m?.[i]);
      const rain6 = inchFromMm(sum(d.hourly.rain, i, 6));
      const depth = inchFromMeters(d.hourly.snow_depth?.[i] || 0);
      if (cumulative >= 1.0 && depth >= 2.0 && temp <= 32 && rain6 < 0.03) {
        windowStart = i;
        break;
      }
    }

    if (windowStart == null) {
      return {
        available: true,
        signal: 'snow-event',
        eventSnowIn,
        eventStart: times[eventStart],
        eventEnd: times[eventEnd],
        confidence: forecastConfidence(Math.max(0, eventStart - currentIndex)),
        reason: `${eventSnowIn.toFixed(1)}" is modeled, but the forecast does not yet produce a cold/dry modeled ski window with at least 2" of modeled depth.`
      };
    }

    let windowEnd = null;
    const scanEnd = Math.min(times.length, windowStart + 73);
    for (let i = windowStart + 1; i < scanEnd; i++) {
      const warm3 = [0,1,2].every(offset => i + offset < times.length && f(d.hourly.temperature_2m?.[i + offset]) > 36);
      const rain3 = inchFromMm(sum(d.hourly.rain, i, 3));
      if (warm3 || rain3 >= 0.10) {
        windowEnd = i;
        break;
      }
    }

    const leadHours = Math.max(0, windowStart - currentIndex);
    return {
      available: true,
      signal: 'storm-window',
      eventSnowIn,
      eventStart: times[eventStart],
      eventEnd: times[eventEnd],
      windowStart: times[windowStart],
      windowEnd: windowEnd == null ? null : times[windowEnd],
      leadHours,
      confidence: forecastConfidence(leadHours),
      summary: windowEnd == null
        ? `${eventSnowIn.toFixed(1)}" modeled; a potential cold/dry ski window opens around ${localHourLabel(times[windowStart])} and persists through the available forecast.`
        : `${eventSnowIn.toFixed(1)}" modeled; a potential ski window opens around ${localHourLabel(times[windowStart])} and faces thaw/rain risk around ${localHourLabel(times[windowEnd])}.`
    };
  }

  function forecastQuery(latitude, longitude, multi = false, timezone = 'America/Detroit') {
    const lat = multi ? latitude : encodeURIComponent(latitude);
    const lon = multi ? longitude : encodeURIComponent(longitude);
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
      '&longitude=' + lon +
      '&current=temperature_2m' +
      '&hourly=temperature_2m,snow_depth,snowfall,rain,wind_speed_10m,cloud_cover' +
      '&daily=temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum' +
      '&past_days=3&forecast_days=8&wind_speed_unit=mph&timezone=' + encodeURIComponent(timezone);
  }

  window.XC_FORECAST = {
    analyzeDay,
    weekendOutlook,
    stormWindow,
    forecastQuery,
    localHourLabel,
    dayLabel
  };
})();
