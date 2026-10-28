require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const brasileiraoRoutes = require('./routes/brasileirao');
const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.use('/api', (req, res, next) => {
  const expected = process.env.API_KEY;
  if (!expected || req.get('X-API-Key') === expected) return next();
  return res.status(401).json({ success: false, error: {
    code: 'UNAUTHORIZED', message: 'Chave de API ausente ou inválida.'
  }});
});

app.get('/', (_req, res) => res.json({
  name: 'Brasileirão API', status: 'online', health: '/api/saude',
  endpoints: ['/api/brasileirao/series','/api/brasileirao/A/standings',
    '/api/brasileirao/B/standings','/api/brasileirao/C/standings',
    '/api/brasileirao/D/standings','/api/brasileirao/D/groups']
}));
app.get('/api/saude', (_req, res) => res.json({
  success: true, status: 'online', timestamp: new Date().toISOString()
}));
app.use('/api/brasileirao', brasileiraoRoutes);
app.use((_req, res) => res.status(404).json({ success: false,
  error: { code: 'NOT_FOUND', message: 'Endpoint não encontrado.' }
}));
app.use((error, _req, res, _next) => {
  const status = Number(error.status || 502);
  if (status >= 500) console.error('[API]', error.code || error.name, error.message);
  res.status(status).json({ success: false, error: {
    code: error.code || 'UPSTREAM_ERROR',
    message: status >= 500 ? 'Não foi possível obter os dados de futebol no momento.' : error.message
  }});
});
app.listen(port, '0.0.0.0', () => console.log(`Brasileirão API ouvindo na porta ${port}`));
