const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  let requests = 0;
  const context = vm.createContext({
    state: {apiBase: 'https://fake.invalid', auth: {accessToken: '', refreshToken: ''}},
    navigator: {onLine: true}, sessionStorage: {setItem() {}, removeItem() {}},
    ACCESS_TOKEN_STORAGE_KEY: 'test-access-key', REFRESH_TOKEN_STORAGE_KEY: 'test-refresh-key',
    el: {accountModal: {}}, AbortSignal,
    fetch: async () => {requests++; return {ok: true, status: 200, json: async () => ({access: 'test-access', refresh: 'test-refresh'})};}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../api.js'), 'utf8'), context);
  return {context, requests: () => requests};
}
test('login works when the offline module is missing', async () => {
  const h = setup(); const result = await h.context.loginUser('tester', 'test-password');
  assert.equal(result.ok, true); assert.equal(h.context.state.auth.accessToken, 'test-access');
  assert.equal(h.requests(), 1);
});
test('online reads work without the offline module', async () => {
  const h = setup(); assert.equal((await h.context.apiRequest('/api/profile/')).ok, true);
  assert.equal(h.requests(), 1);
});
test('personal writes cannot bypass durable storage if its script fails', async () => {
  const h = setup(); const result = await h.context.apiRequest('/api/logbook/', {method: 'POST', body: '{"route":4}'});
  assert.equal(result.ok, false); assert.match(result.error, /entry has not been sent/);
  assert.equal(h.requests(), 0);
});
test('failed core initialization does not leave a broken lexical offline binding', async () => {
  const h = setup();
  assert.throws(() => vm.runInContext(fs.readFileSync(path.join(__dirname, '../offline.js'), 'utf8'), h.context), /LoloOfflineCore/);
  assert.equal(h.context.LoloOffline, undefined);
  assert.equal((await h.context.loginUser('tester', 'test-password')).ok, true);
});
