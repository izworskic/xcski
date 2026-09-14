(() => {
  'use strict';

  const path = location.pathname.replace(/\/+$/, '') || '/';

  function stateFromPath() {
    if (path === '/wisconsin' || path.startsWith('/wisconsin/')) return 'wisconsin';
    if (path === '/minnesota' || path.startsWith('/minnesota/')) return 'minnesota';
    if (path === '/midwest' || path.startsWith('/midwest/')) return 'midwest';
    return 'michigan';
  }

  function surfaceFromPath() {
    if (/\/storm-watch(?:\/|$)/.test(path)) return 'storm_watch';
    if (/\/weekend(?:\/|$)/.test(path)) return 'weekend';
    if (/\/trails\/[a-z0-9-]+(?:\/|$)/.test(path)) return 'trail';
    if (/\/regions\/[a-z0-9-]+(?:\/|$)/.test(path)) return 'region';
    if (/\/(snowmaking|northwoods|state-parks|night-skiing|ski-pass|twin-cities)(?:\/|$)/.test(path)) return 'intent';
    return stateFromPath() === 'midwest' ? 'midwest_home' : 'state_home';
  }

  const context = {
    xc_state: stateFromPath(),
    xc_surface: surfaceFromPath()
  };

  function clean(value, max = 80) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function emit(name, params = {}) {
    if (typeof window.gtag !== 'function') return;
    const payload = { ...context };
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      payload[key] = typeof value === 'string' ? clean(value) : value;
    }
    window.gtag('event', name, payload);
  }

  function trailIdFromHref(href) {
    try {
      const p = new URL(href, location.origin).pathname;
      return p.match(/\/trails\/([^/]+)/)?.[1] || null;
    } catch {
      return null;
    }
  }

  function trailIdFromContext(el) {
    const current = trailIdFromHref(location.href);
    if (current) return current;
    const card = el?.closest?.('.ski-pick,.state-pick,.midwest-pick,.forecast-pick,.region-pick');
    const trailLink = card?.querySelector?.('a[href*="/trails/"]');
    return trailLink ? trailIdFromHref(trailLink.href) : null;
  }

  function destinationState(href) {
    try {
      const p = new URL(href, location.origin).pathname;
      if (p.startsWith('/wisconsin/')) return 'wisconsin';
      if (p.startsWith('/minnesota/')) return 'minnesota';
      if (p.startsWith('/midwest/')) return 'midwest';
      if (p === '/' || p.startsWith('/trails/') || p.startsWith('/regions/') || p.startsWith('/weekend/') || p.startsWith('/storm-watch/')) return 'michigan';
    } catch {}
    return null;
  }

  function rankFromElement(el) {
    const card = el.closest('.ski-pick,.state-pick,.midwest-pick,.forecast-pick,.region-pick');
    if (!card) return null;
    const rankEl = card.querySelector('.ski-pick-rank,.state-rank,.midwest-rank,.forecast-rank,.region-rank');
    const rank = Number.parseInt(rankEl?.textContent || '', 10);
    return Number.isFinite(rank) ? rank : null;
  }

  function placement(el) {
    if (el.closest('.leaflet-popup')) return 'map_popup';
    if (el.closest('.ski-pick,.state-pick,.midwest-pick,.forecast-pick,.region-pick')) return 'ranked_card';
    if (el.closest('.xc-quicknav,.forecast-quicknav')) return 'quick_nav';
    if (el.closest('.state-trail-grid,.forecast-coverage-grid,.state-related,.ski-region-links,.state-regions,.midwest-state-summary')) return 'directory';
    if (context.xc_surface === 'trail') return 'trail_page';
    return 'page';
  }

  function activeMode() {
    const pressed = document.querySelector('[data-board-filter][aria-pressed="true"],[data-state-filter][aria-pressed="true"],[data-midwest-mode][aria-pressed="true"],[data-region-filter][aria-pressed="true"]');
    return pressed?.dataset.boardFilter || pressed?.dataset.stateFilter || pressed?.dataset.midwestMode || pressed?.dataset.regionFilter || null;
  }

  function officialSourceLink(anchor) {
    if (!anchor || anchor.origin === location.origin) return false;
    const text = clean(anchor.textContent, 120).toLowerCase();
    return anchor.classList.contains('ext') ||
      anchor.classList.contains('ski-source-link') ||
      anchor.classList.contains('state-source-link') ||
      Boolean(anchor.closest('.ski-source,.state-source,.trail-source,.source-panel')) ||
      /(verify|official|operator|status|check .*source|check .*report|open .*source)/i.test(text);
  }

  function quickTarget(anchor) {
    const text = clean(anchor.textContent, 40).toLowerCase();
    if (text.includes('weekend')) return 'weekend';
    if (text.includes('storm')) return 'storm_watch';
    if (text === 'today') return 'today';
    if (text.includes('region')) return 'regions';
    if (text.includes('michigan')) return 'michigan';
    if (text.includes('wisconsin')) return 'wisconsin';
    if (text.includes('minnesota')) return 'minnesota';
    if (text.includes('midwest')) return 'midwest';
    return text || 'other';
  }

  document.addEventListener('click', event => {
    const filter = event.target.closest('[data-board-filter],[data-state-filter],[data-midwest-mode],[data-region-filter]');
    if (filter) {
      const value = filter.dataset.boardFilter || filter.dataset.stateFilter || filter.dataset.midwestMode || filter.dataset.regionFilter;
      emit('xc_filter_use', { filter_name: value });
      return;
    }

    const marker = event.target.closest('.leaflet-marker-icon');
    if (marker) {
      emit('xc_map_interact', { map_action: 'marker_open' });
      return;
    }

    const anchor = event.target.closest('a[href]');
    if (!anchor) return;

    if (anchor.closest('.xc-quicknav,.forecast-quicknav')) {
      emit('xc_decision_nav', { decision_target: quickTarget(anchor) });
      return;
    }

    if (officialSourceLink(anchor)) {
      let providerHost = null;
      try { providerHost = new URL(anchor.href).hostname.replace(/^www\./, ''); } catch {}
      emit('xc_official_source', {
        trail_id: trailIdFromContext(anchor),
        provider_host: providerHost,
        placement: placement(anchor),
        rank: rankFromElement(anchor),
        active_mode: activeMode()
      });
      return;
    }

    const trailId = trailIdFromHref(anchor.href);
    if (trailId) {
      emit('xc_trail_open', {
        trail_id: trailId,
        placement: placement(anchor),
        rank: rankFromElement(anchor),
        active_mode: activeMode()
      });
      return;
    }

    const destState = destinationState(anchor.href);
    if (destState && destState !== context.xc_state) {
      emit('xc_state_open', { destination_state: destState, placement: placement(anchor) });
    }
  }, { passive: true });

  emit('xc_decision_surface_view');
})();
