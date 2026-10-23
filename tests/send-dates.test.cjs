const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../offline-core.js');
const now = new Date('2026-10-23T02:00:00Z'); // October 22 in Denver.
test('bad years, date formats, calendar days and future dates are rejected', () => {
  for (const value of ['0026-09-20', '26-09-20', '2026-02-30', '2025-02-29', '1900-02-29', '2026-13-01', '2026-00-10', '09/20/2026', '2026-9-20', '1899-12-31', '2026-10-23']) {
    assert.throws(() => core.validateSendDate(value, now), undefined, value);
  }
});
test('valid historic dates, leap day and today in Denver are accepted', () => {
  for (const value of ['1900-01-01', '2000-02-29', '2026-09-20', '2026-10-22', null, '']) {
    assert.doesNotThrow(() => core.validateSendDate(value, now));
  }
});
test('invalid dates cannot enter the durable offline outbox', () => {
  for (const resource of ['logbook', 'competition-sends']) {
    const bundle = {guide: {routes: []}, profile: {username: 'Test'}, responses: {}, outbox: []};
    assert.throws(() => core.queue(bundle, `/api/${resource}/`, 'POST', {route: 4, date_sent: '0026-09-20'}, 'one', now.toISOString()));
    assert.equal(bundle.outbox.length, 0);
  }
});
