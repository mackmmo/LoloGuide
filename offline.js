/* Automatic connectivity, per-device feature preferences, durable personal logs. */
const LoloOffline = (() => {
  const core = LoloOfflineCore;
  let database, memory = null, activeKey = null, syncing = false, preparing = false;
  let retryTimer, refreshTimer, refreshAgain = false, transition = Promise.resolve();
  const base = () => state.apiBase.replace(/\/$/, '');
  const connected = () => navigator.onLine !== false;
  const keyFor = owner => `${base()}|${owner}`;
  const sessionKey = () => `lolo-offline-last:${base()}`;
  function tokenOwner() {
    try { return String(JSON.parse(atob(state.auth.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).user_id); }
    catch { return null; }
  }
  function emptyBundle(owner) {
    return {owner, profile: {username: state.profile?.username || '', email: ''}, settings: {guide: false, community: false, map: false},
      guide: {sectors: [], areas: [], subareas: [], routes: []}, responses: {}, outbox: [], savedAt: null, featureDates: {}, mapCache: null};
  }
  function normalize(bundle) {
    bundle.settings ||= {guide: Boolean(bundle.guide?.routes?.length), community: Boolean(bundle.responses['/api/community-feed/']), map: Boolean(bundle.mapCache)};
    bundle.featureDates ||= {}; bundle.routeHints ||= {}; return bundle;
  }
  async function db() {
    if (database) return database;
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('lolo-offline-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('bundles');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    return database;
  }
  async function read(key) {
    const connection = await db();
    return new Promise((resolve, reject) => {
      const request = connection.transaction('bundles').objectStore('bundles').get(key);
      request.onsuccess = () => resolve(request.result ? normalize(request.result) : null); request.onerror = () => reject(request.error);
    });
  }
  async function change(key, transform) {
    const connection = await db();
    return new Promise((resolve, reject) => {
      const tx = connection.transaction('bundles', 'readwrite'), store = tx.objectStore('bundles');
      const request = store.get(key); let result, updated;
      request.onsuccess = () => {
        try {
          updated = normalize(request.result || emptyBundle(key.slice(key.lastIndexOf('|') + 1)));
          result = transform(updated); store.put(updated, key);
        } catch (error) { reject(error); tx.abort(); }
      };
      tx.oncomplete = () => { if (activeKey === key) memory = updated; resolve(result); };
      tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Local save aborted.'));
    });
  }
  function notify(text = '') {
    for (const node of document.querySelectorAll('[data-offline-status]')) node.textContent = text;
    const badge = document.querySelector('#offline-mode-badge');
    if (badge) { badge.hidden = !state.offlineMode; badge.textContent = 'OFFLINE MODE'; }
  }
  async function attach() {
    const owner = tokenOwner();
    if (owner && keyFor(owner) !== activeKey) { activeKey = keyFor(owner); memory = await read(activeKey); }
    else if (activeKey) memory = await read(activeKey);
    return memory;
  }
  async function ensure() {
    await attach();
    if (!activeKey) throw new Error('Log in online once before saving on this device.');
    if (!memory) await change(activeKey, () => {});
    return memory;
  }
  function scheduleSync(delay = 0) {
    clearTimeout(retryTimer);
    if (connected() && tokenOwner() && memory?.outbox.length) retryTimer = setTimeout(() => sync(), delay);
  }
  async function getList(path) {
    let url = new URL(base() + path); const rows = [], visited = new Set();
    while (url) {
      if (!connected()) throw new Error('Download paused until you reconnect.');
      if (url.origin !== new URL(base()).origin || visited.has(url.href)) throw new Error('Invalid download pagination.');
      visited.add(url.href);
      const result = await apiRequest(url.href, {offlineBypass: true});
      if (!result.ok) throw new Error(result.error);
      if (Array.isArray(result.data)) { rows.push(...result.data); break; }
      if (!Array.isArray(result.data?.results)) throw new Error(`Unexpected data from ${url.pathname}`);
      rows.push(...result.data.results); url = result.data.next ? new URL(result.data.next, url) : null;
    }
    return rows;
  }
  function isCommunity(path) { return /^\/api\/(comments|community-feed|hall-of-fame|leaderboards|routes\/\d+\/community-stats)\//.test(path); }
  function cached(path, bundle) {
    const url = new URL(path, base()), resource = core.resourcePath(url.pathname);
    if (resource) {
      if (resource.name === 'comments' && !bundle.settings.community) return undefined;
      let rows = core.collection(bundle, resource.name);
      if (url.searchParams.get('route')) rows = rows.filter(row => String(row.route) === url.searchParams.get('route'));
      return resource.target ? rows.find(row => String(row[resource.id]) === resource.target) : rows;
    }
    if (url.pathname === '/api/profile/') return bundle.profile;
    if (url.pathname === '/api/editor-status/') return {is_staff: false};
    if (url.pathname === '/routes/' && bundle.settings.guide) return core.filterRoutes(bundle.guide, url.searchParams);
    const detail = /^\/routes\/(\d+)\/$/.exec(url.pathname);
    if (detail && bundle.settings.guide) return bundle.guide.routes.find(row => String(row.route_id) === detail[1]);
    for (const name of ['sectors', 'areas', 'subareas']) if (url.pathname === `/${name}/` && bundle.settings.guide) return bundle.guide[name];
    if (bundle.settings.community) {
      const stats = /^\/api\/routes\/(\d+)\/community-stats\/$/.exec(url.pathname);
      if (stats) {
        const entries = (bundle.responses['/api/community-feed/'] || []).filter(row => String(row.route_id) === stats[1]);
        return {route: Number(stats[1]), total_sends: entries.length,
          ...Object.fromEntries(['onsight', 'flash', 'redpoint'].map(style => [style, entries.filter(row => row.send_style === style).length]))};
      }
      if (isCommunity(url.pathname)) return bundle.responses[url.pathname + url.search];
    }
    return undefined;
  }
  async function remember(path, result) {
    const bundle = await ensure(), key = activeKey;
    const url = new URL(path, base()), localPath = url.pathname + url.search, resource = core.resourcePath(url.pathname);
    await change(key, current => {
      if (localPath === '/api/profile/') current.profile = result.data;
      if (resource && resource.name !== 'comments' && !resource.target && !url.search) current.responses[localPath] = Array.isArray(result.data) ? result.data : result.data?.results || [];
      else if (current.settings.community && isCommunity(url.pathname)) current.responses[localPath] = result.data;
      if (current.settings.community && resource?.name === 'comments' && Array.isArray(result.data)) {
        const route = url.searchParams.get('route');
        current.responses['/api/comments/'] = route
          ? [...(current.responses['/api/comments/'] || []).filter(row => String(row.route) !== route), ...result.data]
          : result.data;
      }
      if (current.settings.guide && current.featureDates.guide) {
        if (url.pathname === '/routes/' && Array.isArray(result.data)) {
          const rows = new Map(current.guide.routes.map(row => [String(row.route_id), row]));
          for (const row of result.data) rows.set(String(row.route_id), row);
          current.guide.routes = url.search ? [...rows.values()] : result.data;
        }
        for (const name of ['sectors', 'areas', 'subareas']) if (url.pathname === `/${name}/` && Array.isArray(result.data)) current.guide[name] = result.data;
      }
      if (resource && resource.name !== 'comments' && Array.isArray(result.data)) {
        for (const row of result.data) if (row.route) current.routeHints[row.route] = {name: row.route_name || '', grade: row.grade || ''};
      }
    });
    if (tokenOwner() === bundle.owner) localStorage.setItem(sessionKey(), key);
  }
  async function request(path, options, network) {
    const url = new URL(path, base()), localPath = url.pathname + url.search;
    if (url.origin !== new URL(base()).origin) return network();
    const method = (options.method || 'GET').toUpperCase(), resource = core.resourcePath(url.pathname);
    const personalWrite = method !== 'GET' && resource && resource.name !== 'comments';
    let bundle;
    try { bundle = await attach(); }
    catch (error) { if (personalWrite || !connected()) return {ok: false, error: `Cannot save on this device: ${error.message}`}; }
    if (personalWrite || (!connected() && resource && method !== 'GET')) {
      try {
        await ensure();
        if (resource.name === 'comments' && !memory.settings.community) throw new Error('Community is not saved for offline use.');
        const body = options.body ? JSON.parse(options.body) : {};
        const data = await change(activeKey, current => {
          const route = state.datasets.routes.find(row => String(row.route_id) === String(body.route));
          if (route) current.routeHints[route.route_id] = {name: route.name, grade: route.grade};
          return core.queue(current, localPath, method, body, crypto.randomUUID());
        });
        scheduleSync(); return {ok: true, data, offline: !connected(), queued: true};
      } catch (error) { return {ok: false, error: error.message}; }
    }
    if (!connected()) {
      if (!bundle) return {ok: false, error: 'No saved data for this account. Connect once to prepare this device.'};
      const data = method === 'GET' ? cached(localPath, bundle) : undefined;
      return data === undefined ? {ok: false, error: 'This feature is not saved on this device. Enable it in Profile while connected.'} : {ok: true, data, offline: true};
    }
    const result = await network();
    if (result.ok && method !== 'GET' && /^\/routes\/\d+\/$/.test(url.pathname) && memory?.settings.guide && result.data?.route_id) {
      try { await change(activeKey, current => { current.guide.routes = current.guide.routes.map(row => String(row.route_id) === String(result.data.route_id) ? result.data : row); }); }
      catch { /* Backend success is preserved if its optional cache cannot update. */ }
    }
    if (result.ok && method === 'GET' && tokenOwner()) {
      try {
        await remember(localPath, result);
        if (resource && !resource.target && resource.name !== 'comments') result.data = core.collection(memory, resource.name);
        if (!syncing) scheduleSync();
      } catch { /* Optional cache failure must not change a successful backend read. */ }
    }
    return result;
  }
  async function sync() {
    if (syncing || !connected() || !navigator.locks) return;
    await navigator.locks.request('lolo-offline-sync', {ifAvailable: true}, async lock => {
      if (!lock) return;
      syncing = true;
      try {
        await attach(); const owner = tokenOwner(), key = activeKey;
        if (!owner || !memory || memory.owner !== owner || !memory.outbox.length) return;
        const status = await apiRequest('/api/offline-status/', {offlineBypass: true});
        if (!status.ok || status.data?.protocol !== 1 || String(status.data.user_id) !== owner) throw new Error('Uploads are waiting for an authenticated connection to the offline-enabled backend.');
        while (connected()) {
          if (tokenOwner() !== owner || activeKey !== key) break;
          let op;
          await change(key, current => { op = current.outbox[0]; if (op) op.attempted = true; });
          if (!op) break;
          const result = await apiRequest(op.path, {offlineBypass: true, method: op.method,
            body: JSON.stringify({...op.body, _offline_request_id: op.key, ...(op.before ? {_offline_base: op.before} : {})})});
          if (!result.ok) throw new Error(result.error);
          await change(key, current => core.acknowledge(current, op, result.data));
        }
        if (typeof guideStarted !== 'undefined' && guideStarted && !state.editor.saving) {
          await loadLogbook(); await loadTodos();
          if (!document.querySelector('#route-log-modal') && !document.querySelector('#save-route-changes')) renderDetail();
        }
      } catch (error) { console.warn('Saved changes remain on this device:', error.message); }
      finally { syncing = false; scheduleSync(30000); }
    });
  }
  async function refreshFeatures() {
    if (preparing) { refreshAgain = true; return; }
    if (!connected() || !tokenOwner()) return;
    preparing = true; let mapCache;
    try {
      const bundle = await ensure(), key = activeKey, owner = bundle.owner, selected = {...bundle.settings};
      if (!selected.guide && !selected.map && !selected.community) { notify('Preferences saved for this device.'); return; }
      notify('Saving your selected features for offline use…');
      let guide;
      if (selected.guide || selected.map) { guide = {}; for (const name of ['sectors', 'areas', 'subareas', 'routes']) guide[name] = await getList(`/${name}/`); }
      const responses = {};
      if (selected.community) {
        responses['/api/comments/'] = await getList('/api/comments/');
        const year = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Denver', year: 'numeric'}).format(new Date());
        for (const path of ['/api/community-feed/', '/api/hall-of-fame/', `/api/leaderboards/?board=juntmasters&year=${year}`, `/api/leaderboards/?board=alltime&year=${year}`]) {
          const result = await apiRequest(path, {offlineBypass: true}); if (!result.ok) throw new Error(result.error); responses[path] = result.data;
        }
      }
      if (selected.map) {
        if (!navigator.serviceWorker || !window.isSecureContext) throw new Error('Offline maps require HTTPS or localhost.');
        await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Offline map is not ready. Reconnect to retry.')), 60000))]);
        const tiles = core.tileCoordinates([...guide.areas, ...guide.subareas, ...guide.routes].map(row => parsePoint(row.centroid)).filter(Boolean)), layers = ['roads', 'trails', 'pois', 'trailheads', 'gates'];
        if (!tiles.length || tiles.length * layers.length > 20000) throw new Error('Map coverage is unavailable or exceeds the download limit.');
        mapCache = `lolo-map-${crypto.randomUUID()}`; const cache = await caches.open(mapCache);
        const urls = tiles.flatMap(tile => layers.map(layer => `${base()}/tiles/${layer}/${tile}.mvt`));
        let cursor = 0, completed = 0;
        const workers = await Promise.allSettled(Array.from({length: 4}, async () => {
          while (cursor < urls.length) {
            if (!connected()) throw new Error('Map download paused until you reconnect.');
            const url = urls[cursor++], response = await fetch(url, {signal: AbortSignal.timeout(30000)});
            if (!response.ok || response.type === 'opaque') throw new Error('Map download interrupted. Reconnect to retry.');
            await cache.put(url, response); completed++;
            if (completed % 30 === 0) notify(`Saving map: ${completed}/${urls.length} tiles…`);
          }
        }));
        const failed = workers.find(worker => worker.status === 'rejected'); if (failed) throw failed.reason;
      }
      if (tokenOwner() !== owner || key !== activeKey) throw new Error('Account changed during download.');
      let previousMap;
      await change(key, current => {
        const now = new Date().toISOString();
        if (guide && current.settings.guide && selected.guide) current.guide = guide;
        if (current.settings.guide && selected.guide) current.featureDates.guide = now;
        if (current.settings.community && selected.community) { Object.assign(current.responses, responses); current.featureDates.community = now; }
        if (current.settings.map && selected.map) {
          previousMap = current.mapCache; current.mapCache = mapCache; current.featureDates.map = now;
          const fields = ['sector_id', 'area_id', 'subarea_id', 'route_id', 'area', 'subarea', 'sector', 'name', 'centroid', 'boundary'];
          current.mapGuide = Object.fromEntries(Object.entries(guide).map(([name, rows]) => [name, rows.map(row => Object.fromEntries(fields.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]])))]));
        }
        current.savedAt = now;
      });
      if (previousMap) await caches.delete(previousMap);
      if (mapCache && memory?.mapCache !== mapCache) await caches.delete(mapCache);
      await navigator.storage?.persist?.(); notify('Selected features are saved on this device.');
    } catch (error) { if (mapCache && memory?.mapCache !== mapCache) await caches.delete(mapCache); notify(error.message); }
    finally { preparing = false; if (refreshAgain) { refreshAgain = false; refreshTimer = setTimeout(() => refreshFeatures(), 200); } }
  }
  async function setPreference(feature, enabled) {
    await ensure(); const key = activeKey; let oldMap;
    await change(key, current => {
      current.settings[feature] = enabled;
      if (!enabled) {
        delete current.featureDates[feature];
        if (feature === 'community') for (const path of Object.keys(current.responses)) if (isCommunity(path)) delete current.responses[path];
        if (feature === 'map') { oldMap = current.mapCache; current.mapCache = null; current.mapGuide = null; }
        if (!current.settings.guide) current.guide = emptyBundle(current.owner).guide;
      }
    });
    if (oldMap) await caches.delete(oldMap);
    notify(enabled ? connected() ? 'Saving selected features…' : 'Will save when you reconnect.' : 'Preference saved.');
    clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refreshFeatures(), 200);
  }
  async function mountPreferences(container) {
    await ensure();
    const section = document.createElement('section'); section.className = 'offline-preferences';
    section.innerHTML = `<h3>Offline storage</h3><p class="muted">Choose what this device saves. The app switches automatically when your connection changes.</p>
      <label><input type="checkbox" data-offline-feature="guide"><span>Guide<small>Save all route descriptions, grades, areas and search filters for offline browsing.</small></span></label>
      <label><input type="checkbox" data-offline-feature="community"><span>Community<small>Save comments, activity and current standings. Offline views show the last saved information.</small></span></label>
      <label><input type="checkbox" data-offline-feature="map"><span>Map<small>Save climbing locations and nearby roads and trails. Uses more device storage. Satellite imagery and 3D require a connection.</small></span></label>
      <p data-offline-status class="muted" role="status" aria-live="polite"></p>`;
    for (const input of section.querySelectorAll('[data-offline-feature]')) {
      const feature = input.dataset.offlineFeature; input.checked = memory.settings[feature];
      input.addEventListener('change', async () => {
        const enabled = input.checked; input.disabled = true;
        try { await setPreference(feature, enabled); } catch (error) { input.checked = !enabled; notify(error.message); } finally { input.disabled = false; }
      });
    }
    container.append(section);
    const dates = Object.entries(memory.featureDates).filter(([feature]) => memory.settings[feature]);
    notify(dates.length ? `Saved on this device: ${dates.map(([feature, date]) => `${feature} (${new Date(date).toLocaleDateString()})`).join(', ')}.` : 'Enable a feature to save it on this device.');
  }
  async function updateConnectivity(refresh = true) {
    const offline = !connected(), changed = state.offlineMode !== offline;
    state.offlineMode = offline; await attach();
    if (offline) { state.editor.canEdit = false; state.editor.enabled = false; }
    notify();
    if (changed && typeof map !== 'undefined' && map) {
      mapStyleReady = false; mapDimension = '2d';
      map.setStyle(offline ? offlineMapStyle() : MAP_STYLES[mapBasemap]); map.jumpTo({pitch: 0, bearing: 0});
    }
    if (refresh && changed && typeof guideStarted !== 'undefined' && guideStarted) {
      const hasDraft = Boolean(document.querySelector('#route-log-modal') || document.querySelector('#save-route-changes') || state.editor.saving);
      if (!hasDraft) await loadAllData();
      await loadLogbook(); await loadTodos(); if (!hasDraft) renderDetail();
      if (!offline) {
        const status = await getEditorStatus(); state.editor.canEdit = status.ok && status.data?.is_staff === true;
        state.editor.enabled = state.editor.canEdit && localStorage.getItem('editingMode') === 'true';
      }
    }
    if (!offline) { scheduleSync(); clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refreshFeatures(), 500); }
  }
  async function init() {
    try {
      if ('serviceWorker' in navigator && window.isSecureContext) await navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'});
      const remembered = localStorage.getItem(sessionKey());
      if (!connected() && remembered && !tokenOwner()) { activeKey = remembered; memory = await read(remembered); if (memory) state.profile = memory.profile; }
      await updateConnectivity(false);
      window.addEventListener('offline', () => { transition = transition.then(() => updateConnectivity()).catch(error => console.warn(error)); });
      window.addEventListener('online', () => { transition = transition.then(() => updateConnectivity()).catch(error => console.warn(error)); });
    } catch (error) { state.offlineMode = !connected(); notify(`Offline storage unavailable: ${error.message}`); }
  }
  function leave() {
    clearTimeout(retryTimer); clearTimeout(refreshTimer); localStorage.removeItem(sessionKey());
    activeKey = null; memory = null; state.offlineMode = !connected(); state.editor.canEdit = false; notify();
  }
  return {init, request, sync, leave, mountPreferences, refreshFeatures, get bundle() {return memory;}, cached};
})();
