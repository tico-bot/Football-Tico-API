const DEFAULT_TTL_SECONDS = positiveNumber(process.env.CACHE_TTL_SECONDS, 300);
const MAX_ENTRIES = positiveNumber(process.env.CACHE_MAX_ENTRIES, 250);
const store = new Map();
const pending = new Map();
let hits = 0;
let misses = 0;

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function get(key) {
  const item = store.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  // Refresh insertion order so eviction behaves as least-recently-used.
  store.delete(key);
  store.set(key, item);
  hits += 1;
  return item.value;
}

function set(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const ttl = positiveNumber(ttlSeconds, DEFAULT_TTL_SECONDS);
  store.delete(key);
  while (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
  store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  return value;
}

async function remember(key, loader, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const hit = get(key);
  if (hit !== null) return { data: hit, cached: true };
  if (pending.has(key)) return { data: await pending.get(key), cached: true };
  misses += 1;
  const promise = Promise.resolve().then(loader).then((value) => {
    set(key, value, ttlSeconds);
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, promise);
  return { data: await promise, cached: false };
}

function clear() {
  store.clear();
  pending.clear();
  hits = 0;
  misses = 0;
}

function stats() {
  const now = Date.now();
  for (const [key, item] of store) {
    if (item.expiresAt <= now) store.delete(key);
  }
  return { entries: store.size, pending: pending.size, maxEntries: MAX_ENTRIES, hits, misses };
}

module.exports = { get, set, remember, clear, stats };
