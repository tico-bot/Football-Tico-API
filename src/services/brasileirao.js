const futebol = require('campeonato-brasileiro-api');
const cache = require('./cache');
const SERIES = new Set(['a', 'b', 'c', 'd']);

function normaliseSerie(value) {
  const serie = String(value || '').trim().toLowerCase().replace(/^série\\s*/, '');
  if (!SERIES.has(serie)) {
    const error = new Error('Série inválida. Use A, B, C ou D.');
    error.status = 400;
    error.code = 'INVALID_SERIE';
    throw error;
  }
  return serie;
}

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit !== null) return { data: hit, cached: true };
  const data = await loader();
  cache.set(key, data);
  return { data, cached: false };
}

async function getSeries() { return futebol.listSeries(); }
async function getCompetition(serie) {
  const code = normaliseSerie(serie);
  return cached(`competition:${code}`, () => futebol.getCompetition(code));
}
async function getStandings(serie) {
  const code = normaliseSerie(serie);
  return cached(`standings:${code}`, () => futebol.getStandings(code));
}
async function getTable(serie, group) {
  const code = normaliseSerie(serie);
  if (code === 'd' && !group) {
    const error = new Error('A Série D é dividida em grupos. Informe ?group=A1, por exemplo.');
    error.status = 400; error.code = 'GROUP_REQUIRED'; throw error;
  }
  return cached(`table:${code}:${group || 'all'}`, () =>
    futebol.getTable(code, group ? { group } : undefined));
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
  if (code === 'd' && !group) {
    const error = new Error('Informe o grupo da Série D com ?group=A1.');
    error.status = 400; error.code = 'GROUP_REQUIRED'; throw error;
  }
  return cached(`rounds:${code}:${group || 'all'}`, () =>
    futebol.getRounds(code, group ? { group } : undefined));
}
module.exports = { getSeries, getCompetition, getStandings, getTable, getGroups, getRounds };
