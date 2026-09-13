(() => {
  'use strict';
  const ctx=window.STATE_XC_PAGE;
  const root=document.getElementById('state-xc-map');
  if(!ctx||!root||!Array.isArray(ctx.trails)||!ctx.trails.length||!window.L) return;
  const map=L.map(root,{scrollWheelZoom:false,zoomControl:true});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  const points=[];
  for(const trail of ctx.trails){
    if(!Number.isFinite(trail.lat)||!Number.isFinite(trail.lon)) continue;
    const icon=L.divIcon({className:'state-xc-marker',html:'<span></span>',iconSize:[18,18],iconAnchor:[9,9]});
    const marker=L.marker([trail.lat,trail.lon],{icon}).addTo(map);
    const styles=[trail.classic?'Classic':null,trail.skate?'Skate':null,trail.snowmaking?'Snowmaking':null,trail.lit?'Lighted':null].filter(Boolean).join(' · ');
    marker.bindPopup(`<strong>${String(trail.name).replace(/[<>]/g,'')}</strong><br><span>${String(trail.town).replace(/[<>]/g,'')}</span>${styles?`<br><small>${styles}</small>`:''}<br><a href="/${ctx.slug}/trails/${trail.id}/">Open trail intelligence</a>`);
    points.push([trail.lat,trail.lon]);
  }
  if(points.length===1) map.setView(points[0],10); else map.fitBounds(points,{padding:[24,24],maxZoom:9});
})();
