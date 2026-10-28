const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 300);
const MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES || 100);
const store = new Map();

function get(key) {
  const item = store.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return item.value;
}

function set(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
}

function clear() { store.clear(); }
module.exports = { get, set, clear };
