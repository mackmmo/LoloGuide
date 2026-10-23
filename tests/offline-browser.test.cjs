// Browser integration test against a local fake API. Never connects to production.
// Requires Playwright and its Chromium browser. MapLibre is stubbed in this test;
// the offline map's geometry and source configuration have separate unit checks.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

test('Profile preferences, automatic modes, durable logs and automatic reconnect sync', {timeout: 120000}, async () => {
  const root = path.resolve(__dirname, '..'); let origin; let writes = 0;
  const routes = [{route_id: 4, name: 'Offline Granite', grade: '5.9', grade_index: 9, type: 'S',
    area: 1, subarea: 2, height: 80, fa_year: 1998, first_ascencionist: 'Climber', star_rating: 3,
    description: 'A saved description', pro: 'Bolts', danger_rating: '', centroid: 'POINT(0 0)', crag_order: 1}];
  let logs = []; const receipts = new Map();
  const preferences = {guide_data_sync: false, community_data_sync: false, map_data_sync: false};
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, origin);
    const json = data => {response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(data));};
    if (url.pathname.startsWith('/tiles/')) {response.end(Buffer.alloc(0)); return;}
    if (/^\/api\/logbook\/(?:\d+\/)?$/.test(url.pathname) && ['POST', 'PATCH'].includes(request.method)) {
      let raw = ''; for await (const chunk of request) raw += chunk;
      const data = JSON.parse(raw);
      if (receipts.has(data._offline_request_id)) return json(receipts.get(data._offline_request_id));
      writes++; const row = {...data, log_id: 99, route_name: routes[0].name, grade: routes[0].grade};
      delete row._offline_request_id; delete row._offline_base; logs = [row]; receipts.set(data._offline_request_id, row); return json(row);
    }
    if (url.pathname === '/routes/') return json(routes);
    if (url.pathname === '/sectors/') return json([{sector_id: 1, name: 'Sector'}]);
    if (url.pathname === '/areas/') return json([{area_id: 1, sector: 1, name: 'Area', centroid: 'POINT(0 0)'}]);
    if (url.pathname === '/subareas/') return json([{subarea_id: 2, area: 1, name: 'Subarea', centroid: 'POINT(0 0)'}]);
    if (url.pathname === '/api/offline-status/') return json({protocol: 1, user_id: 11});
    if (url.pathname === '/api/profile/') {
      if (request.method === 'PATCH') { let raw = ''; for await (const chunk of request) raw += chunk; Object.assign(preferences, JSON.parse(raw)); }
      return json({username: 'Offline Tester', email: 'test@example.invalid', data_permissions: preferences});
    }
    if (url.pathname === '/api/editor-status/') return json({is_staff: false});
    if (url.pathname === '/api/logbook/') return json(logs);
    if (url.pathname.startsWith('/api/')) return json([]);
    if (url.pathname === '/test-maplibre.js') {response.setHeader('Content-Type', 'text/javascript'); response.end('/* Map library omitted in this shell/outbox test. */'); return;}
    if (url.pathname === '/test-maplibre.css') {response.setHeader('Content-Type', 'text/css'); response.end(''); return;}
    let file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    if (!file.startsWith(root + path.sep)) {response.writeHead(403).end(); return;}
    if (!fs.existsSync(file)) {response.writeHead(404).end(); return;}
    let content = fs.readFileSync(file);
    if (file.endsWith('.js') || file.endsWith('.html')) {
      content = content.toString().replaceAll('https://lolo-app-2.onrender.com', origin)
        .replaceAll('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js', origin + '/test-maplibre.js')
        .replaceAll('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css', origin + '/test-maplibre.css');
    }
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    response.end(content);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {})});
    const context = await browser.newContext();
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route(url => url.origin !== origin, route => route.abort());
    const token = 'x.' + Buffer.from(JSON.stringify({user_id: 11})).toString('base64url') + '.x';
    await context.addInitScript(token => {
      if (!localStorage.getItem('test-login-set')) {
        sessionStorage.setItem('lolo-access-token', token); localStorage.setItem('test-login-set', 'yes');
      }
    }, token);
    page.on('dialog', dialog => dialog.accept());
    await page.goto(origin);
    await page.getByText('Offline Granite', {exact: true}).first().waitFor();
    await page.waitForFunction(() => Boolean(LoloOffline.bundle?.responses['/api/logbook/']));
    assert.equal(await page.locator('#offline-mode-badge').isVisible(), false);
    assert.equal(await page.locator('.offline-controls, #download-offline-guide, #sync-offline-changes').count(), 0);
    // Log a route online before any optional cache has been enabled.
    await page.getByText('Offline Granite', {exact: true}).first().click();
    await page.locator('#route-log-open').click();
    await page.locator('#route-log-form [name=date_sent]').fill('0026-09-20');
    assert.equal(await page.locator('#route-log-form [name=date_sent]').evaluate(node => node.checkValidity()), false);
    await page.locator('#route-log-form button[type=submit]').click();
    assert.equal(await page.evaluate(() => LoloOffline.bundle.outbox.length), 0);
    assert.equal(writes, 0);
    await page.locator('#route-log-form [name=status]').selectOption('project');
    await page.locator('#route-log-form [name=attempts]').fill('1');
    await page.locator('#route-log-form button[type=submit]').click();
    await page.waitForFunction(() => LoloOffline.bundle.outbox.length === 0 && state.logbook[0]?.attempts === 1);
    assert.equal(writes, 1);
    assert.equal(await page.evaluate(() => LoloOffline.bundle.settings.guide), false);
    await page.locator('#account-menu-button').click();
    await page.locator('button[data-account-view=profile]').click();
    await page.locator('[data-offline-feature=guide]').waitFor();
    assert.equal(await page.locator('[data-offline-feature]').count(), 3);
    assert.equal(await page.locator('[data-offline-feature=guide]').isChecked(), false);
    await page.locator('[data-offline-feature=guide]').check();
    await page.waitForFunction(() => Boolean(LoloOffline.bundle.featureDates.guide));
    assert.equal(await page.evaluate(() => LoloOffline.bundle.responses['/api/community-feed/'] === undefined), true);
    assert.equal(await page.evaluate(() => LoloOffline.bundle.mapCache), null);
    await page.locator('#account-modal-close').click();
    // Data seen online must disappear offline unless that feature was selected.
    await page.evaluate(() => {
      state.community = {routeId: 4, loading: false, stats: {total_sends: 99}, comments: [{comment: 'Online-only comment'}], error: ''};
      document.querySelector('#community-feed').textContent = 'Online-only activity';
    });
    await context.setOffline(true);
    await page.waitForFunction(() => state.offlineMode && state.community.stats === null);
    assert.match(await page.locator('#community-feed').textContent(), /not saved for offline/);
    assert.equal(await page.evaluate(async () => (await getCommunityFeed()).ok), false);
    assert.equal(await page.evaluate(() => LoloOffline.bundle.settings.map), false);
    await page.evaluate(() => showView('map'));
    await page.locator('#offline-map-unavailable').waitFor({state: 'visible'});
    await page.evaluate(() => showView('guide'));
    await page.getByText('Offline Granite', {exact: true}).first().waitFor();
    await context.setOffline(false); await page.waitForFunction(() => !state.offlineMode);
    await page.locator('#account-menu-button').click(); await page.locator('button[data-account-view=profile]').click();
    await page.locator('[data-offline-feature=map]').check();
    await page.locator('[data-offline-feature=community]').check();
    await page.waitForFunction(() => Boolean(LoloOffline.bundle?.featureDates.map && LoloOffline.bundle.featureDates.community), null, {timeout: 60000});
    await page.waitForFunction(() => Object.keys(LoloOffline.bundle.preferenceChanges).length === 0);
    assert.deepEqual(preferences, {guide_data_sync: true, community_data_sync: true, map_data_sync: true});
    await page.locator('#account-modal-close').click();
    // A separate device/context restores checked preferences from the server.
    const otherDevice = await browser.newContext();
    await otherDevice.route(url => url.origin !== origin, route => route.abort());
    await otherDevice.addInitScript(token => sessionStorage.setItem('lolo-access-token', token), token);
    const otherPage = await otherDevice.newPage(); await otherPage.goto(origin);
    await otherPage.locator('#account-menu-button').click(); await otherPage.locator('button[data-account-view=profile]').click();
    for (const feature of ['guide', 'community', 'map']) {
      await otherPage.locator(`[data-offline-feature=${feature}]`).waitFor();
      assert.equal(await otherPage.locator(`[data-offline-feature=${feature}]`).isChecked(), true);
    }
    await otherDevice.close();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);
    await page.waitForFunction(() => state.offlineMode);
    const headerBox = await page.locator('#app-header').boundingBox();
    const badgeBox = await page.locator('#offline-mode-badge').boundingBox();
    assert.ok(Math.abs(headerBox.x + headerBox.width / 2 - badgeBox.x - badgeBox.width / 2) < 1);
    assert.equal(await page.locator('#offline-mode-badge').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(197, 31, 40)');
    await page.reload();
    await page.locator('#offline-mode-badge').waitFor({state: 'visible'});
    await page.getByText('Offline Granite', {exact: true}).first().click();
    await page.locator('#route-log-open').click();
    await page.locator('#route-log-form [name=status]').selectOption('project');
    await page.locator('#route-log-form [name=attempts]').fill('2');
    await page.locator('#route-log-form button[type=submit]').click();
    await page.waitForFunction(() => LoloOffline.bundle.outbox.length === 1);
    assert.equal(await page.locator('#offline-mode-badge').textContent(), 'OFFLINE MODE');
    assert.equal(writes, 1);
    await page.reload();
    await page.waitForFunction(() => state.logbook[0]?.attempts === 2);
    assert.equal(await page.evaluate(() => LoloOffline.bundle.outbox.length), 1);
    // A new tab has no session token; it still opens the remembered offline copy.
    const offlineTab = await context.newPage(); await offlineTab.goto(origin);
    await offlineTab.locator('#offline-mode-badge').waitFor({state: 'visible'});
    await offlineTab.waitForFunction(() => state.logbook[0]?.attempts === 2);
    await offlineTab.close();
    routes[0].name = 'Current backend name';
    await context.setOffline(false);
    await page.waitForFunction(() => !state.offlineMode && LoloOffline.bundle.outbox.length === 0 && state.logbook[0]?.attempts === 2);
    await page.getByText('Current backend name', {exact: true}).first().waitFor();
    assert.equal(writes, 2);
    assert.equal(await page.locator('#offline-mode-badge').isVisible(), false);
    // Disabling all optional features must leave log data intact.
    await page.locator('#account-menu-button').click(); await page.locator('button[data-account-view=profile]').click();
    for (const feature of ['guide', 'community', 'map']) await page.locator(`[data-offline-feature=${feature}]`).uncheck();
    await page.waitForFunction(() => !LoloOffline.bundle.settings.map && !LoloOffline.bundle.settings.guide && !LoloOffline.bundle.settings.community && !LoloOffline.bundle.mapCache);
    await page.waitForFunction(() => Object.keys(LoloOffline.bundle.preferenceChanges).length === 0);
    assert.deepEqual(preferences, {guide_data_sync: false, community_data_sync: false, map_data_sync: false});
    assert.equal(await page.evaluate(() => LoloOffline.bundle.guide.routes.length), 0);
    assert.equal(await page.evaluate(() => LoloOffline.bundle.responses['/api/logbook/'][0].attempts), 2);
    await page.locator('#account-modal-close').click();
    await context.setOffline(true);
    await page.waitForFunction(() => state.offlineMode);
    await page.setViewportSize({width: 390, height: 844});
    const mobileHeader = await page.locator('#app-header').boundingBox();
    const mobileBadge = await page.locator('#offline-mode-badge').boundingBox();
    const hamburger = await page.locator('#account-menu-button').boundingBox();
    assert.ok(Math.abs(mobileHeader.x + mobileHeader.width / 2 - mobileBadge.x - mobileBadge.width / 2) < 1);
    assert.ok(mobileBadge.x + mobileBadge.width < hamburger.x);
    await page.locator('[data-bottom-nav=logbook]').click();
    await page.locator('[data-logbook-tab=projects]').click();
    await page.locator('[data-logbook-route="4"]').click();
    await page.locator('#route-log-open').click();
    await page.locator('#route-log-form [name=attempts]').fill('3');
    await page.locator('#route-log-form button[type=submit]').click();
    await page.waitForFunction(() => LoloOffline.bundle.outbox.length === 1 && state.logbook[0]?.attempts === 3);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
  }
});
