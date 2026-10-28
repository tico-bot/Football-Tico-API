const express = require('express');
const service = require('../services/brasileirao');
const router = express.Router();

function sendResult(res, result) {
  res.json({ success: true, cached: result.cached, data: result.data, timestamp: new Date().toISOString() });
}
router.get('/series', async (_req, res, next) => {
  try { res.json({ success: true, data: await service.getSeries() }); }
  catch (error) { next(error); }
});
router.get('/:serie', async (req, res, next) => {
  try { sendResult(res, await service.getCompetition(req.params.serie)); }
  catch (error) { next(error); }
});
router.get('/:serie/standings', async (req, res, next) => {
  try { sendResult(res, await service.getStandings(req.params.serie, req.query.group)); }
  catch (error) { next(error); }
});
router.get('/:serie/table', async (req, res, next) => {
  try { sendResult(res, await service.getTable(req.params.serie, req.query.group)); }
  catch (error) { next(error); }
});
router.get('/:serie/groups', async (req, res, next) => {
  try { sendResult(res, await service.getGroups(req.params.serie)); }
  catch (error) { next(error); }
});
router.get('/:serie/rounds', async (req, res, next) => {
  try { sendResult(res, await service.getRounds(req.params.serie, req.query.group)); }
  catch (error) { next(error); }
});
module.exports = router;
