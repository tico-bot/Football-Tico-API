const dotenv = require('dotenv');
const fs = require('node:fs');
dotenv.config();
// Local development reuses only the provider key from the bot's .env.
// Do not import the bot's other credentials into the API process.
if (!process.env.FOOTBALL_DATA_API_KEY && process.env.TICO_BOT_ENV_PATH) {
  try {
    const botEnv = dotenv.parse(fs.readFileSync(process.env.TICO_BOT_ENV_PATH, 'utf8'));
    if (botEnv.FOOTBALL_DATA_API_KEY) {
      process.env.FOOTBALL_DATA_API_KEY = botEnv.FOOTBALL_DATA_API_KEY;
    }
  } catch {
    console.warn('[config] Não foi possível carregar a chave externa pelo caminho local configurado.');
  }
}
// Production deployments should inject FOOTBALL_DATA_API_KEY through their environment.
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const brasileiraoRoutes = require('./routes/brasileirao');
const futebolRoutes = require('./routes/futebol');
const cache = require('./services/cache');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(helmet());

const allowedOrigins = String(process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Request-ID'],
  maxAge: 86400
}));
app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  const supplied = String(req.get('X-Request-ID') || '').trim();
  const requestId = /^[a-zA-Z0-9._-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const windows = new Map();
const RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000);
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX) || 120);
app.use('/api', (req, res, next) => {
  if (req.path === '/saude' || req.path === '/health') return next();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let record = windows.get(key);
  if (!record || record.resetAt <= now) {
    record = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    windows.set(key, record);
  }
  record.count += 1;
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX - record.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));
  if (record.count > RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((record.resetAt - now) / 1000))));
    return res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas consultas. Aguarde antes de tentar novamente.', requestId } });
  }
  // Periodically prune expired clients without requiring a background timer.
  if (windows.size > 5000) {
    for (const [ip, item] of windows) if (item.resetAt <= now) windows.delete(ip);
  }
  next();
});

app.use('/api', (req, res, next) => {
  const expected = process.env.API_KEY;
  if (!expected || req.get('X-API-Key') === expected) return next();
  return res.status(401).json({ success: false, error: {
    code: 'UNAUTHORIZED', message: 'Chave de API ausente ou inválida.', requestId: req.requestId
  }});
});

app.get('/', (_req, res) => res.json({
  name: 'Futebol API', version: '2.0.0', status: 'online',
  description: 'API de futebol brasileiro e internacional.',
  health: '/api/saude',
  docs: '/api/docs',
  endpoints: {
    brasileirao: '/api/brasileirao/series',
    competitions: '/api/futebol/competitions',
    matches: '/api/futebol/matches',
    teams: '/api/futebol/teams/:id',
    health: '/api/saude'
  }
}));

app.get('/api/saude', (_req, res) => res.json({
  success: true,
  status: 'online',
  version: '2.0.0',
  uptimeSeconds: Math.floor(process.uptime()),
  timestamp: new Date().toISOString(),
  providers: {
    brasileirao: { configured: true, source: 'campeonato-brasileiro-api' },
    international: { configured: Boolean(process.env.FOOTBALL_DATA_API_KEY), source: 'football-data.org' }
  },
  cache: cache.stats()
}));
app.get('/api/health', (_req, res) => res.redirect(308, '/api/saude'));
app.get('/api/docs', (_req, res) => res.json({
  name: 'Futebol API',
  version: '2.0.0',
  authentication: 'Opcional; defina API_KEY para exigir X-API-Key.',
  endpoints: [
    { method: 'GET', path: '/api/saude', description: 'Saúde, provedores e cache.' },
    { method: 'GET', path: '/api/brasileirao/series', description: 'Séries A, B, C e D.' },
    { method: 'GET', path: '/api/brasileirao/:serie/standings', description: 'Classificação do Brasileirão.' },
    { method: 'GET', path: '/api/brasileirao/:serie/rounds?group=A1', description: 'Rodada atual.' },
    { method: 'GET', path: '/api/futebol/competitions', description: 'Catálogo de competições nacionais e internacionais.' },
    { method: 'GET', path: '/api/futebol/competitions/:code', description: 'Detalhes da competição.' },
    { method: 'GET', path: '/api/futebol/competitions/:code/standings', description: 'Classificação de uma competição.' },
    { method: 'GET', path: '/api/futebol/competitions/:code/matches', description: 'Jogos de uma competição.' },
    { method: 'GET', path: '/api/futebol/competitions/:code/teams', description: 'Times participantes.' },
    { method: 'GET', path: '/api/futebol/competitions/:code/scorers?limit=10', description: 'Artilheiros.' },
    { method: 'GET', path: '/api/futebol/matches?dateFrom=2026-01-01&dateTo=2026-01-07', description: 'Jogos por período.' },
    { method: 'GET', path: '/api/futebol/teams/:id', description: 'Detalhes de um time.' }
  ]
}));

app.use('/api/brasileirao', brasileiraoRoutes);
app.use('/api/futebol', futebolRoutes);

app.use((_req, res) => res.status(404).json({
  success: false, error: { code: 'NOT_FOUND', message: 'Endpoint não encontrado.' }
}));

app.use((error, req, res, _next) => {
  const status = Number(error.status || 502);
  if (status >= 500) console.error('[API]', req.requestId, error.code || error.name, error.message);
  res.status(status).json({ success: false, error: {
    code: error.code || 'UPSTREAM_ERROR',
    message: status >= 500 ? (status === 503 || status === 504 ? error.message : 'Não foi possível obter os dados de futebol no momento.') : error.message,
    requestId: req.requestId
  }});
});

module.exports = app;
