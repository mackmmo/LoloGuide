const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../offline-core.js');
function bundle() {
  return {profile: {username: 'Tester'}, guide: {
    areas: [{area_id: 1, name: 'Granite', sector: 2}], subareas: [{subarea_id: 3, name: 'Wall'}],
    routes: [{route_id: 4, name: 'Alpha', grade: '5.9', type: 'S', area: 1, subarea: 3, height: 80},
      {route_id: 5, name: 'Beta', grade: '5.10a', type: 'T', area: 1, subarea: 3, height: 100}]
  }, responses: {'/api/logbook/': [], '/api/todos/': [], '/api/competition-sends/': [], '/api/comments/': []}, outbox: []};
}
test('unchanged snapshots remain separate from queued log creates', () => {
  const b = bundle(); const row = core.queue(b, '/api/logbook/', 'POST', {route: 4, status: 'project', attempts: 2}, 'one');
  assert.equal(row.log_id, 'local-one'); assert.equal(row.route_name, 'Alpha');
  assert.equal(b.responses['/api/logbook/'].length, 0); assert.equal(core.collection(b, 'logbook').length, 1);
});
test('editing then deleting an unsynced create coalesces without server writes', () => {
  const b = bundle(); core.queue(b, '/api/logbook/', 'POST', {route: 4, status: 'project'}, 'one');
  core.queue(b, '/api/logbook/local-one/', 'PATCH', {attempts: 3}, 'two');
  assert.equal(b.outbox.length, 1); assert.equal(b.outbox[0].body.attempts, 3);
  core.queue(b, '/api/logbook/local-one/', 'DELETE', {}, 'three'); assert.equal(b.outbox.length, 0);
});
test('existing edits preserve original values for conflict detection', () => {
  const b = bundle(); b.responses['/api/logbook/'] = [{log_id: 9, route: 4, status: 'project', attempts: 1}];
  core.queue(b, '/api/logbook/9/', 'PATCH', {attempts: 2}, 'one');
  core.queue(b, '/api/logbook/9/', 'PATCH', {attempts: 3}, 'two');
  assert.equal(b.outbox.length, 1); assert.equal(b.outbox[0].before.attempts, 1); assert.equal(b.outbox[0].body.attempts, 3);
  assert.equal(core.collection(b, 'logbook')[0].attempts, 3);
});
test('deleting an existing pending edit keeps its initial baseline', () => {
  const b = bundle(); b.responses['/api/todos/'] = [{todo_id: 9, route: 4}];
  core.queue(b, '/api/todos/9/', 'DELETE', {}, 'one');
  assert.equal(core.collection(b, 'todos').length, 0); assert.equal(b.outbox[0].before.route, 4);
});
test('duplicate local logs and repeat sends are blocked', () => {
  const b = bundle(); core.queue(b, '/api/logbook/', 'POST', {route: 4, status: 'project'}, 'one');
  assert.throws(() => core.queue(b, '/api/logbook/', 'POST', {route: 4, status: 'project'}, 'two'), /already exists/);
  core.queue(b, '/api/competition-sends/', 'POST', {route: 4, date_sent: '2025-01-01', send_style: 'redpoint'}, 'three');
  assert.throws(() => core.queue(b, '/api/competition-sends/', 'POST', {route: 4, date_sent: '2025-02-01'}, 'four'), /already exists/);
});
test('attempted uploads cannot be changed, preserving idempotency', () => {
  const b = bundle(); core.queue(b, '/api/todos/', 'POST', {route: 4}, 'one'); b.outbox[0].attempted = true;
  const original = structuredClone(b.outbox[0]);
  core.queue(b, '/api/todos/local-one/', 'DELETE', {}, 'two');
  assert.deepEqual(b.outbox[0], original);
  assert.equal(b.outbox[1].dependsOn, 'one');
  core.acknowledge(b, original, {todo_id: 99, route: 4});
  assert.equal(b.outbox[0].path, '/api/todos/99/');
  assert.equal(b.outbox[0].before.todo_id, 99);
  assert.equal(core.collection(b, 'todos').length, 0);
  core.acknowledge(b, b.outbox[0], null);
  assert.equal(b.outbox.length, 0);
});
test('an ambiguous upload does not prevent saving unrelated logs', () => {
  const b = bundle(); core.queue(b, '/api/logbook/', 'POST', {route: 4, status: 'project'}, 'one'); b.outbox[0].attempted = true;
  core.queue(b, '/api/logbook/', 'POST', {route: 5, status: 'project'}, 'two');
  assert.equal(b.outbox.length, 2);
});
test('route database edits and account changes cannot be queued', () => {
  for (const path of ['/routes/4/', '/api/profile/', '/api/profile/password/']) {
    assert.throws(() => core.queue(bundle(), path, 'PATCH', {name: 'bad'}, 'one'), /requires a connection/);
  }
});
test('invalid log values are rejected locally', () => {
  for (const body of [{attempts: -1}, {attempts: 1.5}, {status: 'unknown'}, {date_sent: '9999-01-01'}, {send_style: 'unknown'}]) {
    assert.throws(() => core.queue(bundle(), '/api/logbook/', 'POST', {route: 4, ...body}, 'one'));
  }
});
test('offline filters combine text, hierarchy, type and sort without altering snapshot', () => {
  const b = bundle(); const before = JSON.stringify(b.guide);
  assert.deepEqual(core.filterRoutes(b.guide, new URLSearchParams('sector=2&area=1&subarea=3&type=s&search=granite+alpha')).map(r => r.route_id), [4]);
  assert.deepEqual(core.filterRoutes(b.guide, new URLSearchParams('ordering=-height')).map(r => r.route_id), [5, 4]);
  assert.equal(JSON.stringify(b.guide), before);
});
test('map package coordinates are bounded, deduplicated, and include all zoom levels', () => {
  const tiles = core.tileCoordinates([[46.7, -114.57], [46.7, -114.57], [NaN, 5], [90, 0]]);
  assert.equal(tiles.length, new Set(tiles).size);
  assert.equal(new Set(tiles.map(tile => tile.split('/')[0])).size, 15);
  for (const tile of tiles) { const [z, x, y] = tile.split('/').map(Number); assert.ok(x >= 0 && x < 2 ** z && y >= 0 && y < 2 ** z); }
});
