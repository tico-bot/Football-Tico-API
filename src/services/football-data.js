const cache = require('./cache');

const BASE_URL = 'https://api.football-data.org/v4';
const COMPETITIONS = [
  { code: 'BSA', name: 'Campeonato Brasileiro Série A', country: 'Brasil', region: 'América do Sul', provider: 'football-data.org', requiresKey: true },
  { code: 'PL', name: 'Premier League', country: 'Inglaterra', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'PD', name: 'La Liga', country: 'Espanha', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'BL1', name: 'Bundesliga', country: 'Alemanha', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'SA', name: 'Serie A', country: 'Itália', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'FL1', name: 'Ligue 1', country: 'França', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'CL', name: 'UEFA Champions League', country: 'Europa', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'ELC', name: 'Championship', country: 'Inglaterra', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'DED', name: 'Eredivisie', country: 'Países Baixos', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'PPL', name: 'Primeira Liga', country: 'Portugal', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'EC', name: 'Campeonato Europeu', country: 'Europa', region: 'Europa', provider: 'football-data.org', requiresKey: true },
  { code: 'WC', name: 'Copa do Mundo', country: 'Internacional', region: 'Mundial', provider: 'football-data.org', requiresKey: true }
];

function makeError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function requireApiKey() {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    throw makeError(503, 'PROVIDER_NOT_CONFIGURED',
      'Este recurso precisa de FOOTBALL_DATA_API_KEY. Configure uma chave do football-data.org.');
  }
}

function validateDate(value, name) {
  if (value === undefined || value === '') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) throw makeError(400, 'INVALID_DATE', `O parâmetro ${name} deve usar o formato YYYY-MM-DD.`);
  const [, year, month, day] = match.map((part, index) => index === 0 ? part : Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw makeError(400, 'INVALID_DATE', `O parâmetro ${name} não representa uma data válida.`);
  }
  return String(value);
}

async function request(path, query = {}) {
  requireApiKey();
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.UPSTREAM_TIMEOUT_MS) || 8000);
  try {
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY, Accept: 'application/json' },
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429) throw makeError(503, 'PROVIDER_RATE_LIMIT', 'O provedor de futebol atingiu seu limite de consultas.');
      if (response.status === 400 || response.status === 404) {
        throw makeError(response.status, response.status === 404 ? 'PROVIDER_NOT_FOUND' : 'PROVIDER_BAD_REQUEST',
          body.message || 'O provedor não encontrou os dados solicitados.');
      }
      if (response.status === 403 || response.status === 401) {
        throw makeError(502, 'PROVIDER_AUTH_ERROR', 'A chave do provedor foi recusada ou não tem acesso a este recurso.');
      }
      throw makeError(502, 'PROVIDER_ERROR', 'O provedor externo não conseguiu responder.');
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw makeError(504, 'PROVIDER_TIMEOUT', 'O provedor de futebol demorou demais para responder.');
    if (error.status) throw error;
    throw makeError(502, 'PROVIDER_UNAVAILABLE', 'Não foi possível conectar ao provedor de futebol.');
  } finally {
    clearTimeout(timeout);
  }
}

function cached(key, loader, ttl = Number(process.env.CACHE_TTL_SECONDS) || 300) {
  return cache.remember(`football-data:${key}`, loader, ttl);
}

function getCompetitions() {
  return {
    data: COMPETITIONS.map(({ code, name, country, region, provider, requiresKey }) => ({
      code, name, country, region, provider, requiresKey,
      apiKeyConfigured: Boolean(process.env.FOOTBALL_DATA_API_KEY),
      endpoint: `/api/futebol/competitions/${code}`
    })),
    source: 'catalog'
  };
}

async function getCompetition(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(normalized)) throw makeError(400, 'INVALID_COMPETITION_CODE', 'Código de competição inválido.');
  return cached(`competition:${normalized}`, () => request(`/competitions/${normalized}`));
}

async function getStandings(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(normalized)) throw makeError(400, 'INVALID_COMPETITION_CODE', 'Código de competição inválido.');
  return cached(`standings:${normalized}`, () => request(`/competitions/${normalized}/standings`), 180);
}

async function getMatches(query) {
  const dateFrom = validateDate(query.dateFrom, 'dateFrom');
  const dateTo = validateDate(query.dateTo, 'dateTo');
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw makeError(400, 'INVALID_DATE_RANGE', 'dateFrom não pode ser posterior a dateTo.');
  }
  const limit = query.limit === undefined ? 50 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw makeError(400, 'INVALID_LIMIT', 'limit deve ser um inteiro entre 1 e 100.');
  }
  const params = {
    dateFrom, dateTo,
    competitions: query.competitions ? String(query.competitions).toUpperCase() : undefined,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    limit
  };
  if (params.competitions && !/^[A-Z0-9,]{2,80}$/.test(params.competitions)) {
    throw makeError(400, 'INVALID_COMPETITIONS', 'competitions deve conter códigos separados por vírgula.');
  }
  if (params.status && !/^[A-Z_]{3,20}$/.test(params.status)) {
    throw makeError(400, 'INVALID_STATUS', 'status inválido.');
  }
  return cached(`matches:${JSON.stringify(params)}`, () => request('/matches', params), 60);
}

async function getTeams(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(normalized)) throw makeError(400, 'INVALID_COMPETITION_CODE', 'Código de competição inválido.');
  return cached(`teams:${normalized}`, () => request(`/competitions/${normalized}/teams`), 3600);
}

async function getTeam(id) {
  const teamId = String(id || '').trim();
  if (!/^\d{1,10}$/.test(teamId)) throw makeError(400, 'INVALID_TEAM_ID', 'O ID do time deve ser numérico.');
  return cached(`team:${teamId}`, () => request(`/teams/${teamId}`), 3600);
}

async function getScorers(code, limit = 10) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(normalized)) throw makeError(400, 'INVALID_COMPETITION_CODE', 'Código de competição inválido.');
  const number = Number(limit);
  if (!Number.isInteger(number) || number < 1 || number > 20) {
    throw makeError(400, 'INVALID_LIMIT', 'limit deve ser um inteiro entre 1 e 20.');
  }
  return cached(`scorers:${normalized}:${number}`, () => request(`/competitions/${normalized}/scorers`, { limit: number }), 300);
}

module.exports = { COMPETITIONS, getCompetitions, getCompetition, getStandings, getMatches, getTeams, getTeam, getScorers };
