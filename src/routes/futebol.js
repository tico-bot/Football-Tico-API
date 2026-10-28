const express = require('express');
const service = require('../services/football-data');
const router = express.Router();

function sendResult(res, result) {
  res.json({
    success: true,
    cached: result.cached,
    data: result.data,
    timestamp: new Date().toISOString(),
    source: 'football-data.org'
  });
}

router.get('/competitions', (_req, res) => {
  const result = service.getCompetitions();
  res.json({ success: true, data: result.data, timestamp: new Date().toISOString(), source: result.source });
});

router.get('/competitions/:code', async (req, res, next) => {
  try { sendResult(res, await service.getCompetition(req.params.code)); } catch (error) { next(error); }
});
router.get('/competitions/:code/standings', async (req, res, next) => {
  try { sendResult(res, await service.getStandings(req.params.code)); } catch (error) { next(error); }
});
router.get('/competitions/:code/matches', async (req, res, next) => {
  try {
    const result = await service.getMatches({ ...req.query, competitions: req.query.competitions || req.params.code });
    sendResult(res, result);
  } catch (error) { next(error); }
});
router.get('/competitions/:code/teams', async (req, res, next) => {
  try { sendResult(res, await service.getTeams(req.params.code)); } catch (error) { next(error); }
});
router.get('/competitions/:code/scorers', async (req, res, next) => {
  try { sendResult(res, await service.getScorers(req.params.code, req.query.limit || 10)); } catch (error) { next(error); }
});
router.get('/matches', async (req, res, next) => {
  try { sendResult(res, await service.getMatches(req.query)); } catch (error) { next(error); }
});
router.get('/teams/:id', async (req, res, next) => {
  try { sendResult(res, await service.getTeam(req.params.id)); } catch (error) { next(error); }
});

module.exports = router;
