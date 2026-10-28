const futebol = require('campeonato-brasileiro-api');
const cache = require('./cache');
const SERIES = new Set(['a', 'b', 'c', 'd']);

function normaliseSerie(value) {
  const serie = String(value || '').trim().toLowerCase().replace(/^série\s*/, '');
  if (!SERIES.has(serie)) {
    const error = new Error('Série inválida. Use A, B, C ou D.');
    error.status = 400;
    error.code = 'INVALID_SERIE';
    throw error;
  }
  return serie;
}

function normaliseGroup(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const group = String(value).trim();
  if (group.length > 30 || !/^[\p{L}\p{N} _.-]+$/u.test(group)) {
    const error = new Error('Grupo inválido.');
    error.status = 400;
    error.code = 'INVALID_GROUP';
    throw error;
  }
  return group;
}


function canonicalGroup(value) {
  if (!value) return undefined;
  const group = String(value).trim();
  return /^(grupo|group)\s+/i.test(group) ? group : 'Grupo ' + group;
}

function cached(key, loader, ttl) {
  return cache.remember(`brasileirao:${key}`, loader, ttl);
}

async function getSeries() {
  return futebol.listSeries();
}
async function getCompetition(serie) {
  const code = normaliseSerie(serie);
  return cached(`competition:${code}`, () => futebol.getCompetition(code));
}
async function getStandings(serie, group) {
  const code = normaliseSerie(serie);
  const normalizedGroup = normaliseGroup(group);
  return cached('standings:' + code + ':' + (normalizedGroup || 'all'), async () => {
    // Some seasons return an empty Série D table; avoid passing an unknown group to upstream.
    const result = await futebol.getStandings(code);
    if (!normalizedGroup) return result;
    const normaliseKey = (value) => String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/^(grupo|group)\s*/i, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    return {
      ...result,
      tables: (Array.isArray(result.tables) ? result.tables : [])
        .filter((table) => normaliseKey(table.name) === normaliseKey(normalizedGroup))
    };
  }, 180);
}
async function getTable(serie, group) {
  const code = normaliseSerie(serie);
  const normalizedGroup = normaliseGroup(group);
  if (code === 'd' && !normalizedGroup) {
    const error = new Error('A Série D é dividida em grupos. Informe ?group=A1, por exemplo.');
    error.status = 400; error.code = 'GROUP_REQUIRED'; throw error;
  }
  return cached(`table:${code}:${normalizedGroup || 'all'}`, () =>
    futebol.getTable(code, normalizedGroup ? { group: canonicalGroup(normalizedGroup) } : undefined));
}
async function getGroups(serie) {
  const code = normaliseSerie(serie);
  if (code !== 'd') {
    const error = new Error('A consulta de grupos está disponível apenas para a Série D.');
    error.status = 400; error.code = 'GROUPS_ONLY_SERIE_D'; throw error;
  }
  return cached('groups:d', () => futebol.getGroups('d'));
}
async function getRounds(serie, group) {
  const code = normaliseSerie(serie);
  const normalizedGroup = normaliseGroup(group);
  if (code === 'd' && !normalizedGroup) {
    const error = new Error('Informe o grupo da Série D com ?group=A1.');
    error.status = 400; error.code = 'GROUP_REQUIRED'; throw error;
  }
  return cached(`rounds:${code}:${normalizedGroup || 'all'}`, () =>
    futebol.getRounds(code, normalizedGroup ? { group: canonicalGroup(normalizedGroup) } : undefined), 90);
}
module.exports = { getSeries, getCompetition, getStandings, getTable, getGroups, getRounds, normaliseSerie, normaliseGroup };
