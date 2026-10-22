const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('offline map creates local route/area geometry and downloaded vector sources', () => {
  const sources = new Map(), layers = new Map(), handlers = [];
  const guide = {areas: [{area_id: 1, name: 'Area', boundary: 'MULTIPOLYGON(((0 0,100 0,100 100,0 0)))'}],
    routes: [{route_id: 4, name: 'Saved climb', centroid: 'POINT(0 0)'}]};
  const map = {
    getSource: name => sources.get(name), getLayer: name => layers.get(name),
    addSource: (name, source) => sources.set(name, source), addLayer: layer => layers.set(layer.id, layer),
    on: (...args) => handlers.push(args)
  };
  const context = vm.createContext({state: {apiBase: 'https://test.invalid', offlineMode: true},
    LoloOffline: {bundle: {guide}}, document: {querySelector: () => null}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../map.js'), 'utf8'), context);
  context.testMap = map;
  vm.runInContext('map = testMap; renderFloatingAreaPins = () => {};', context);
  const style = context.offlineMapStyle(); assert.equal(style.version, 8);
  assert.equal(style.glyphs, undefined); assert.equal(style.sprite, undefined);
  context.renderOfflineMap(); context.renderOfflineMap();
  assert.equal(sources.size, 7); assert.equal(handlers.length, 1);
  assert.equal(sources.get('offline-routes').data.features[0].properties.route_id, 4);
  assert.equal(sources.get('offline-areas').data.features[0].geometry.type, 'MultiPolygon');
  assert.equal(layers.get('offline-pois')['source-layer'], 'poi');
  assert.deepEqual([...sources.keys()], ['offline-roads', 'offline-trails', 'offline-pois', 'offline-trailheads', 'offline-gates', 'offline-areas', 'offline-routes']);
  for (const layer of ['roads', 'trails']) {
    assert.equal(sources.get(`offline-${layer}`).maxzoom, 14);
    assert.match(sources.get(`offline-${layer}`).tiles[0], /test.invalid\/tiles/);
  }
});
