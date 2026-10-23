/* Pure offline data operations; shared by the app and Node regression tests. */
(function (root) {
  const resources = {
    logbook: {id: 'log_id', defaults: {attempts: 0, send_style: null, date_sent: null, beta: null}},
    todos: {id: 'todo_id', defaults: {}},
    'competition-sends': {id: 'id', defaults: {}},
    comments: {id: 'comment_id', defaults: {}}
  };
  const MIN_SEND_DATE = '1900-01-01';
  function validateSendDate(value, now = new Date()) {
    if (value === null || value === undefined || value === '') return;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter the send date as YYYY-MM-DD with a four-digit year.');
    const parsed = new Date(`${value}T12:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Enter a real calendar date.');
    if (value < MIN_SEND_DATE) throw new Error('Use a four-digit year from 1900 onward, for example 2026, not 0026.');
    const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
    if (value > today) throw new Error('A send cannot be dated in the future.');
  }
  function resourcePath(path) {
    const match = /^\/api\/(logbook|todos|competition-sends|comments)\/(?:([^/?]+)\/)?$/.exec(path.split('?')[0]);
    return match && {name: match[1], target: match[2], ...resources[match[1]]};
  }
  function collection(bundle, name) {
    let rows = structuredClone(bundle.responses[`/api/${name}/`] || []);
    const field = resources[name].id;
    for (const op of bundle.outbox) {
      if (op.resource !== name) continue;
      if (op.method === 'POST') rows.push(op.local);
      else if (op.method === 'DELETE') rows = rows.filter(row => String(row[field]) !== String(op.target));
      else rows = rows.map(row => String(row[field]) === String(op.target) ? {...row, ...op.body} : row);
    }
    return rows;
  }
  function queue(bundle, path, method, body, uuid, now = new Date().toISOString()) {
    const resource = resourcePath(path);
    if (!resource || !['POST', 'PATCH', 'DELETE'].includes(method)) throw new Error('This change requires a connection.');
    if ((method === 'POST') === Boolean(resource.target)) throw new Error('Invalid offline operation.');
    validateSendDate(body.date_sent, new Date(now));
    if (body.status !== undefined && !['sent', 'project'].includes(body.status)) throw new Error('Invalid log status.');
    if (body.attempts !== undefined && (!Number.isInteger(body.attempts) || body.attempts < 0)) throw new Error('Attempts must be a nonnegative whole number.');
    if (body.send_style && !['onsight', 'flash', 'redpoint', 'pinkpoint', 'repeat'].includes(body.send_style)) throw new Error('Invalid send style.');
    if (resource.name === 'comments' && method !== 'DELETE' && !body.comment?.trim()) throw new Error('Comment cannot be empty.');
    const rows = collection(bundle, resource.name);
    const target = resource.target;
    const current = rows.find(row => String(row[resource.id]) === String(target));
    if (method !== 'POST' && !current) throw new Error('Download this entry before editing it offline.');
    if (method === 'POST' && resource.name !== 'comments') {
      const duplicate = rows.some(row => String(row.route) === String(body.route) &&
        (resource.name !== 'competition-sends' || Number(row.year) === Number(String(body.date_sent).slice(0, 4))));
      if (duplicate) throw new Error('An entry for this route already exists. Edit the existing entry.');
    }
    const previous = bundle.outbox.filter(op => op.resource === resource.name && String(op.target) === String(target)).at(-1);
    if (previous && !previous.attempted) {
      if (method === 'DELETE' && previous.method === 'POST') {
        bundle.outbox = bundle.outbox.filter(op => op !== previous);
        return null;
      }
      if (method === 'PATCH') {
        previous.body = {...previous.body, ...body};
        if (previous.method === 'POST') previous.local = {...previous.local, ...body};
        return {...current, ...body};
      }
      previous.method = 'DELETE'; previous.body = {};
      return null;
    }
    const route = bundle.guide.routes.find(row => String(row.route_id) === String(body.route)) || bundle.routeHints?.[body.route];
    const local = {...resource.defaults, ...body, [resource.id]: `local-${uuid}`,
      route_name: route?.name || '', grade: route?.grade || '', username: bundle.profile.username,
      created_at: now, updated_at: now, recorded_at: now,
      ...(resource.name === 'competition-sends' ? {year: Number(String(body.date_sent).slice(0, 4))} : {})};
    bundle.outbox.push({key: uuid, resource: resource.name, target: target || local[resource.id],
      path, method, body, before: current || null, local, attempted: false, dependsOn: previous?.key || null});
    return method === 'DELETE' ? null : method === 'PATCH' ? {...current, ...body} : local;
  }
  function acknowledge(bundle, op, data) {
    const config = resources[op.resource], path = `/api/${op.resource}/`;
    const originalTarget = op.target;
    let rows = bundle.responses[path] || [];
    rows = rows.filter(row => String(row[config.id]) !== String(op.target) &&
      (op.method === 'DELETE' || String(row[config.id]) !== String(data[config.id])));
    if (op.method !== 'DELETE') rows.push(data);
    bundle.responses[path] = rows;
    for (const dependent of bundle.outbox) {
      if (dependent.key === op.key || dependent.resource !== op.resource || String(dependent.target) !== String(originalTarget)) continue;
      if (op.method === 'POST') {
        dependent.target = data[config.id]; dependent.path = `/api/${op.resource}/${data[config.id]}/`;
      }
      if (dependent.dependsOn === op.key) { dependent.before = data; dependent.dependsOn = null; }
    }
    bundle.outbox = bundle.outbox.filter(row => row.key !== op.key);
  }
  function filterRoutes(guide, params) {
    const areaById = new Map(guide.areas.map(area => [String(area.area_id), area]));
    const subareaById = new Map(guide.subareas.map(area => [String(area.subarea_id), area]));
    const terms = (params.get('search') || '').toLowerCase().split(/\s+/).filter(Boolean);
    const rows = guide.routes.filter(route => {
      const area = areaById.get(String(route.area));
      const subarea = subareaById.get(String(route.subarea));
      return (!params.get('sector') || String(area?.sector) === params.get('sector')) &&
        (!params.get('area') || String(route.area) === params.get('area')) &&
        (!params.get('subarea') || String(route.subarea) === params.get('subarea')) &&
        (!params.get('type') || String(route.type).toLowerCase() === params.get('type').toLowerCase()) &&
        terms.every(term => [route.name, route.grade, route.type, area?.name, subarea?.name].join(' ').toLowerCase().includes(term));
    });
    const ordering = params.get('ordering') || 'crag_order';
    const field = ordering.replace(/^-/, ''); const direction = ordering.startsWith('-') ? -1 : 1;
    return rows.sort((a, b) => {
      const numeric = ['grade_index', 'star_rating', 'height', 'crag_order'].includes(field);
      return direction * (numeric ? Number(a[field] || 0) - Number(b[field] || 0) : String(a[field] || '').localeCompare(String(b[field] || '')));
    });
  }
  function tileCoordinates(points) {
    const tiles = new Set();
    for (const [lat, lon] of points) {
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) continue;
      for (let z = 0; z <= 14; z++) {
        const n = 2 ** z; const rad = lat * Math.PI / 180;
        const x = Math.floor((lon + 180) / 360 * n);
        const y = Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * n);
        // About 5 km of context around every saved climbing location at high zoom.
        const radius = z < 10 ? 0 : Math.max(1, Math.ceil(5000 / (40075016 * Math.cos(rad) / n)));
        for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
          if (y + dy >= 0 && y + dy < n) tiles.add(`${z}/${(x + dx + n) % n}/${y + dy}`);
        }
      }
    }
    return [...tiles];
  }
  const api = {resources, resourcePath, collection, queue, acknowledge, filterRoutes, tileCoordinates, MIN_SEND_DATE, validateSendDate};
  if (typeof module !== 'undefined') module.exports = api;
  else root.LoloOfflineCore = api;
})(globalThis);
