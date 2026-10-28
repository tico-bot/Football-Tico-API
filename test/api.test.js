const test = require('node:test');
const assert = require('node:assert/strict');
const cache = require('../src/services/cache');
const footballData = require('../src/services/football-data');
const brasileirao = require('../src/services/brasileirao');
const app = require('../src/app');

test('cache deduplicates concurrent loads', async () => {
  cache.clear();
  let calls = 0;
  const loader = async () => { calls += 1; await new Promise((r) => setTimeout(r, 15)); return { value: 42 }; };
  const [a, b] = await Promise.all([cache.remember('test:single-flight', loader), cache.remember('test:single-flight', loader)]);
  assert.equal(calls, 1);
  assert.deepEqual(a.data, { value: 42 });
  assert.deepEqual(b.data, { value: 42 });
  assert.equal(cache.stats().entries, 1);
  cache.clear();
});

test('cache expires entries', async () => {
  cache.clear();
  cache.set('test:expires', 'old', 1);
  assert.equal(cache.get('test:expires'), 'old');
  await new Promise((r) => setTimeout(r, 1050));
  assert.equal(cache.get('test:expires'), null);
  cache.clear();
});

test('Brazilian series and group inputs are validated', () => {
  assert.equal(brasileirao.normaliseSerie(' Série A '), 'a');
  assert.equal(brasileirao.normaliseSerie('d'), 'd');
  assert.throws(() => brasileirao.normaliseSerie('e'), { code: 'INVALID_SERIE', status: 400 });
  assert.equal(brasileirao.normaliseGroup('A1'), 'A1');
  assert.throws(() => brasileirao.normaliseGroup('<script>'), { code: 'INVALID_GROUP', status: 400 });
});

test('international catalog includes Brazilian and international competitions', () => {
  const result = footballData.getCompetitions();
  assert.ok(result.data.some((item) => item.code === 'PL'));
  assert.ok(result.data.some((item) => item.code === 'BSA'));
  assert.ok(result.data.some((item) => item.code === 'CL'));
  assert.ok(result.data.some((item) => item.country === 'Portugal'));
});

test('international service validates requests before contacting provider', async () => {
  await assert.rejects(footballData.getMatches({ dateFrom: '2026-13-55' }), { code: 'INVALID_DATE', status: 400 });
  await assert.rejects(footballData.getMatches({ dateFrom: '2026-02-02', dateTo: '2026-01-01' }), { code: 'INVALID_DATE_RANGE', status: 400 });
  await assert.rejects(footballData.getMatches({ limit: 101 }), { code: 'INVALID_LIMIT', status: 400 });
  await assert.rejects(footballData.getTeam('abc'), { code: 'INVALID_TEAM_ID', status: 400 });
});

test('HTTP API serves health, docs, catalog and request IDs', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/api/saude`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).success, true);
  const catalog = await fetch(`${base}/api/futebol/competitions`);
  assert.equal(catalog.status, 200);
  assert.ok((await catalog.json()).data.length >= 10);
  const docs = await fetch(`${base}/api/docs`);
  assert.ok((await docs.json()).endpoints.some((e) => e.path === '/api/futebol/teams/:id'));
  const missing = await fetch(`${base}/missing-route`);
  assert.equal(missing.status, 404);
  assert.ok(missing.headers.get('x-request-id'));
});
