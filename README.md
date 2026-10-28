# Brasileirão API

API HTTP independente para consultar as Séries A, B, C e D, feita em Node.js/Express com a biblioteca aberta `campeonato-brasileiro-api` como fonte inicial.

## Executar localmente
```bash
npm install
cp .env.example .env
npm run dev
```
Abra `http://localhost:3000/api/saude`.

## Endpoints
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/saude` | Estado do servidor |
| GET | `/api/brasileirao/series` | Séries suportadas |
| GET | `/api/brasileirao/:serie` | Dados da competição |
| GET | `/api/brasileirao/:serie/standings` | Classificação |
| GET | `/api/brasileirao/:serie/table` | Tabela de uma série |
| GET | `/api/brasileirao/D/groups` | Grupos da Série D |
| GET | `/api/brasileirao/:serie/rounds` | Rodada atual |

Códigos de série: `a`, `b`, `c`, `d`. A Série D é dividida em grupos; use `/api/brasileirao/D/table?group=A1` ou `/api/brasileirao/D/rounds?group=A1`.

Exemplos: `/api/brasileirao/A/standings`, `/api/brasileirao/B/standings`, `/api/brasileirao/C/standings`, `/api/brasileirao/D/groups`.

## Cache e limites
O cache em memória reduz chamadas repetidas por 300 segundos, configurável por `CACHE_TTL_SECONDS`. Reiniciar ou suspender o processo limpa o cache. O serviço não impõe limite próprio, mas hospedagem e fontes externas mantêm seus limites.

## Chave opcional
Se definir `API_KEY` no ambiente, todas as rotas `/api` exigem o cabeçalho `X-API-Key`.

## Render
Crie um Web Service separado, conecte este repositório, use Build Command `npm install` e Start Command `npm start`. Não fixe a variável `PORT`; o Render a fornece.

## Próximos passos
1. Testar as quatro séries localmente.
2. Tratar mudanças ou indisponibilidade da fonte.
3. Adicionar banco persistente se necessário.
4. Publicar no Render após validação.
