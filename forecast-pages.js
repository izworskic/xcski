(() => {
  'use strict';

  const ctx = window.XC_FORECAST_PAGE;
  if (!ctx || !Array.isArray(ctx.groups) || !window.XC_INTEL || !window.XC_FORECAST) return;
  const root = document.getElementById('forecast-page-board');
  const status = document.getElementById('forecast-page-status');
  const freshness = document.getElementById('forecast-page-freshness');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function fetchChunk(chunk, timezone) {
    const lats = chunk.map(t=>t.lat).join(',');
    const lons = chunk.map(t=>t.lon).join(',');
    const response = await fetch(XC_FORECAST.forecastQuery(lats,lons,true,timezone));
    if (!response.ok) throw new Error(`weather ${response.status}`);
    let payload = await response.json();
    if (!Array.isArray(payload)) payload=[payload];
    return payload;
  }

  async function loadGroup(group) {
    const chunks=[];
    for(let i=0;i<group.trails.length;i+=40) chunks.push(group.trails.slice(i,i+40));
    const payload=(await Promise.all(chunks.map(chunk=>fetchChunk(chunk,group.timezone)))).flat();
    return group.trails.map((trail,index)=>{
      const d=payload[index];
      if(!d) return null;
      const current=XC_INTEL.analyzeWeather(d);
      return {...trail,state:group.name,stateSlug:group.slug,current,weekend:XC_FORECAST.weekendOutlook(d),storm:XC_FORECAST.stormWindow(d)};
    }).filter(Boolean);
  }

  function weekendRows(rows){
    return rows.filter(r=>r.weekend?.available).sort((a,b)=>{
      const as=Math.max(a.weekend.saturday.snowScore,a.weekend.sunday.snowScore);
      const bs=Math.max(b.weekend.saturday.snowScore,b.weekend.sunday.snowScore);
      return (bs-as)||((b.weekend.best.bestWindow.score||0)-(a.weekend.best.bestWindow.score||0));
    });
  }

  function stormRows(rows){
    return rows.filter(r=>r.storm?.signal==='storm-window'||r.storm?.signal==='snow-event')
      .sort((a,b)=>(b.storm.eventSnowIn||0)-(a.storm.eventSnowIn||0));
  }

  function weekendCard(row,rank){
    const w=row.weekend;
    return `<article class="forecast-pick"><div class="forecast-rank">${rank}</div><div><p class="forecast-state">${esc(row.state)}</p><h2><a href="${esc(row.href)}">${esc(row.name)}</a></h2><p class="forecast-town">${esc(row.town)}</p><div class="forecast-grid"><div><small>Saturday</small><strong>${w.saturday.snowScore}/100</strong><span>${esc(w.saturday.surface.label)} · ${esc(w.saturday.bestWindow.label)}</span></div><div><small>Sunday</small><strong>${w.sunday.snowScore}/100</strong><span>${esc(w.sunday.surface.label)} · ${esc(w.sunday.bestWindow.label)}</span></div><div><small>Better day</small><strong>${esc(w.betterDay)}</strong><span>${esc(w.summary)}</span></div></div><div class="forecast-metrics"><span><b>${w.best.dailySnow.toFixed(1)}&quot;</b><small>snow on stronger day</small></span><span><b>${Math.round(w.best.minToday)}–${Math.round(w.best.maxToday)}°F</b><small>temp range</small></span><span><b>${w.best.dailyRain.toFixed(2)}&quot;</b><small>rain signal</small></span></div></div></article>`;
  }

  function stormCard(row,rank){
    const s=row.storm;
    const isWindow=s.signal==='storm-window';
    return `<article class="forecast-pick"><div class="forecast-rank">${rank}</div><div><p class="forecast-state">${esc(row.state)}</p><h2><a href="${esc(row.href)}">${esc(row.name)}</a></h2><p class="forecast-town">${esc(row.town)}</p><div class="forecast-storm"><small>${isWindow?'Potential ski window':'Snow event only'}</small><strong>${s.eventSnowIn.toFixed(1)}&quot; modeled</strong><span>${isWindow?esc(s.summary):esc(s.reason)}</span></div><div class="forecast-metrics"><span><b>${esc(s.confidence||'—')}</b><small>forecast confidence</small></span><span><b>${esc(s.eventStart?XC_FORECAST.localHourLabel(s.eventStart):'—')}</b><small>snow starts</small></span><span><b>${esc(s.windowStart?XC_FORECAST.localHourLabel(s.windowStart):'not yet')}</b><small>potential window</small></span></div></div></article>`;
  }

  async function load(){
    try{
      if(status) status.textContent=`Updating ${ctx.totalTrails} systems…`;
      const groups=await Promise.all(ctx.groups.map(loadGroup));
      const rows=groups.flat();
      if(rows.length!==ctx.totalTrails) throw new Error(`expected ${ctx.totalTrails} rows, got ${rows.length}`);
      const selected=ctx.mode==='weekend'?weekendRows(rows):stormRows(rows);
      if(freshness) freshness.textContent=`Open-Meteo 8-day forecast · ${rows.length} systems · state-local timing · modeled forecast only, not grooming/open status.`;
      if(status) status.textContent=ctx.mode==='weekend'?'Weekend outlook':'7-day storm watch';
      if(!selected.length){
        root.innerHTML=`<div class="forecast-empty"><strong>${ctx.mode==='weekend'?'Weekend forecast incomplete.':'No meaningful modeled storm window right now.'}</strong><p>${ctx.mode==='weekend'?'The full Saturday/Sunday pair is not available yet.':'No system currently meets the snow-event threshold. The engine does not invent a ski window.'}</p></div>`;
        return;
      }
      root.innerHTML=selected.slice(0,ctx.limit||25).map((row,i)=>ctx.mode==='weekend'?weekendCard(row,i+1):stormCard(row,i+1)).join('');
    }catch(error){
      console.warn('XC forecast decision page unavailable:',error);
      if(status) status.textContent='Forecast unavailable';
      root.innerHTML='<div class="forecast-empty"><strong>The forecast layer could not load.</strong><p>Use the state trail pages and official operator sources. Stale modeled values are not substituted.</p></div>';
    }
  }

  load();
})();
