const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const calls = [];
  const context = vm.createContext({
    state: {apiBase: 'https://fake.invalid', auth: {accessToken: '', refreshToken: ''}},
    navigator: {onLine: true}, sessionStorage: {setItem() {}, removeItem() {}},
    ACCESS_TOKEN_STORAGE_KEY: 'test-access-key', REFRESH_TOKEN_STORAGE_KEY: 'test-refresh-key',
    el: {accountModal: {}}, AbortSignal, URL,
    fetch: async (url, options) => {
      calls.push({url: String(url), options});
      return {ok: true, status: 200, json: async () => ({access: 'test-access', refresh: 'test-refresh'})};
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../api.js'), 'utf8'), context);
  return {context, calls, requests: () => calls.length};
}
test('login works when the offline module is missing', async () => {
  const h = setup(); const result = await h.context.loginUser('tester', 'test-password');
  assert.equal(result.ok, true); assert.equal(h.context.state.auth.accessToken, 'test-access');
  assert.equal(h.requests(), 1);
});
test('public guidebook reads work for guests without the offline module', async () => {
  const h = setup(); assert.equal((await h.context.apiRequest('/routes/?search=granite')).ok, true);
  assert.equal(h.requests(), 1);
});
test('guests cannot issue account requests or route edits', async () => {
  const h = setup();
  assert.equal((await h.context.apiRequest('/api/profile/')).status, 401);
  assert.equal((await h.context.apiRequest('/routes/4/', {method: 'PATCH'})).status, 401);
  assert.equal(h.requests(), 0);
});
test('route reads omit bearer tokens while account reads and route edits retain them', async () => {
  const h = setup();
  h.context.state.auth.accessToken = 'test-access';
  await h.context.apiRequest('/routes/4/');
  await h.context.apiRequest('/api/profile/');
  await h.context.apiRequest('/routes/4/', {method: 'PATCH'});
  assert.deepEqual(h.calls.map(({options}) => options.headers.Authorization), [undefined, 'Bearer test-access', 'Bearer test-access']);
});
test('a private response received after logout is ignored', async () => {
  const h = setup();
  h.context.state.auth.accessToken = 'test-access';
  let complete;
  h.context.fetch = () => new Promise(resolve => { complete = resolve; });
  const pending = h.context.apiRequest('/api/profile/');
  h.context.clearAuthTokens();
  complete({ok: true, status: 200, json: async () => ({email: 'private@example.invalid'})});
  const result = await pending;
  assert.equal(result.status, 401);
  assert.equal(result.data, undefined);
});
test('personal writes cannot bypass durable storage if its script fails', async () => {
  const h = setup();
  h.context.state.auth.accessToken = 'test-access';
  const result = await h.context.apiRequest('/api/logbook/', {method: 'POST', body: '{"route":4}'});
  assert.equal(result.ok, false); assert.match(result.error, /entry has not been sent/);
  assert.equal(h.requests(), 0);
});
test('failed core initialization does not leave a broken lexical offline binding', async () => {
  const h = setup();
  assert.throws(() => vm.runInContext(fs.readFileSync(path.join(__dirname, '../offline.js'), 'utf8'), h.context), /LoloOfflineCore/);
  assert.equal(h.context.LoloOffline, undefined);
  assert.equal((await h.context.loginUser('tester', 'test-password')).ok, true);
});
