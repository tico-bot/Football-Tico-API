# Futebol API

API HTTP em Node.js/Express para dados do futebol brasileiro e internacional. O projeto mantém os recursos do Brasileirão (Séries A, B, C e D) e acrescenta catálogo de competições, jogos, clubes, classificações e artilheiros por meio do provedor opcional [football-data.org](https://www.football-data.org/).

> O catálogo de competições funciona sem chave. Consultas de dados externos exigem uma chave válida. Cobertura e disponibilidade dependem do plano do provedor; a API não inventa resultados quando um recurso não está disponível.

## Requisitos e execução

- Node.js 20+
- npm

```bash
npm install
cp .env.example .env
npm run dev
```

Servidor padrão: `http://localhost:3100`. Documentação JSON em `/api/docs`; saúde em `/api/saude`.

## Endpoints do Brasileirão

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/brasileirao/series` | Séries A, B, C e D |
| GET | `/api/brasileirao/:serie` | Dados completos |
| GET | `/api/brasileirao/:serie/standings` | Classificação |
| GET | `/api/brasileirao/:serie/table` | Tabela |
| GET | `/api/brasileirao/:serie/groups` | Grupos da Série D |
| GET | `/api/brasileirao/:serie/rounds` | Rodada atual |

Use `a`, `b`, `c` ou `d`. A Série D exige grupo em tabela/rodada, por exemplo `/api/brasileirao/d/table?group=A1`.

## Futebol nacional e internacional

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/futebol/competitions` | Catálogo de competições |
| GET | `/api/futebol/competitions/:code` | Detalhes da competição |
| GET | `/api/futebol/competitions/:code/standings` | Classificação |
| GET | `/api/futebol/competitions/:code/matches` | Jogos da competição |
| GET | `/api/futebol/competitions/:code/teams` | Clubes participantes |
| GET | `/api/futebol/competitions/:code/scorers?limit=10` | Artilheiros |
| GET | `/api/futebol/matches` | Jogos filtrados |
| GET | `/api/futebol/teams/:id` | Detalhes de um clube |

Códigos comuns: `BSA` (Brasileirão Série A no provedor externo), `PL` (Premier League), `PD` (La Liga), `BL1` (Bundesliga), `SA` (Serie A italiana), `FL1` (Ligue 1), `CL` (Champions League), `PPL` (Liga portuguesa).

Exemplos:

```http
GET /api/futebol/competitions
GET /api/futebol/competitions/PL/standings
GET /api/futebol/competitions/CL/matches?dateFrom=2026-10-01&dateTo=2026-10-31
GET /api/futebol/matches?dateFrom=2026-10-28&dateTo=2026-10-29&competitions=PL,CL
GET /api/futebol/competitions/PL/scorers?limit=10
GET /api/futebol/teams/57
```

Parâmetros de jogos: `dateFrom`, `dateTo` em `YYYY-MM-DD`; `competitions` com códigos separados por vírgula; `status`; `limit` entre 1 e 100. Para artilheiros, `limit` vai de 1 a 20.

## Provedor internacional

1. Obtenha uma chave em [football-data.org](https://www.football-data.org/client/register).
2. Defina `FOOTBALL_DATA_API_KEY` no ambiente da API.
3. Reinicie a API.

Sem a chave, o catálogo segue disponível, mas consultas ao provedor retornam `503 PROVIDER_NOT_CONFIGURED`. O acesso a cada competição depende da cobertura e das cotas da chave.

## Segurança e confiabilidade

- Helmet e remoção do cabeçalho de identificação do Express.
- Limite de requisições por IP configurável por `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW_MS`; saúde isenta.
- Identificador de requisição `X-Request-ID`, também incluído nos erros.
- CORS configurável por `CORS_ORIGINS`.
- Chave opcional da API: `API_KEY` exige `X-API-Key`.
- Timeout para chamadas externas com `UPSTREAM_TIMEOUT_MS`.
- Cache com expiração, máximo de entradas, estatísticas e deduplicação de consultas simultâneas.
- Validação de parâmetros, erros JSON consistentes e encerramento gracioso.
- Respostas HTTP com `Cache-Control: no-store`; o cache interno é gerido pelo servidor.

Configure `TRUST_PROXY=true` somente atrás de um proxy reverso confiável. Veja [.env.example](.env.example) para todas as variáveis. Não comite `.env` nem exponha segredos. Em desenvolvimento local, `TICO_BOT_ENV_PATH` pode apontar para o `.env` do bot para reutilizar a chave sem duplicá-la; em produção, injete a chave diretamente no ambiente do serviço.

## Testes

```bash
npm run check
npm test
npm run test:security
```

## Implantação

Use `npm install` no build e `npm start` para iniciar. A plataforma deve fornecer `PORT`; configure chaves e variáveis no painel do host.
