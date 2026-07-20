import { Router } from 'express';
import { prisma } from '../../db.js';
import { authRequired } from '../../middleware/auth.js';

const router = Router();
router.use(authRequired);

const SCORE_DIMENSIONS = ['overall', 'confidence', 'clarity', 'conciseness', 'professionalism'];
const RATE_DIMENSIONS = ['fillerPer100Words', 'apologyPer100Words', 'hedgePer100Words', 'responseLatencySeconds'];

const avg = (vals: number[]): number | null =>
  vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;

/**
 * Per-dimension: current average (last 5 data points) vs the previous 5 —
 * the dashboard's tiles and trend arrows. Scores trend up = good; rate
 * dimensions (fillers, apologies, hedges, latency) trend down = good.
 */
router.get('/summary', async (req, res) => {
  const metrics = await prisma.progressMetric.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 400,
  });

  const summarize = (dimension: string) => {
    const vals = metrics.filter((m) => m.dimension === dimension).map((m) => m.value);
    return {
      dimension,
      current: avg(vals.slice(0, 5)),
      previous: avg(vals.slice(5, 10)),
      dataPoints: vals.length,
    };
  };

  const [calls, practiceSessions] = await Promise.all([
    prisma.meeting.count({ where: { userId: req.user!.id } }),
    prisma.practiceSession.count({ where: { userId: req.user!.id, status: 'completed' } }),
  ]);

  res.json({
    scores: SCORE_DIMENSIONS.map(summarize),
    rates: RATE_DIMENSIONS.map(summarize).filter((r) => r.dataPoints > 0),
    totals: { calls, practiceSessions },
  });
});

router.get('/history', async (req, res) => {
  const dimension = typeof req.query.dimension === 'string' ? req.query.dimension : 'overall';
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 60));
  const rows = await prisma.progressMetric.findMany({
    where: { userId: req.user!.id, dimension },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  res.json({
    dimension,
    points: rows.map((r) => ({ value: r.value, source: r.source, refId: r.refId, at: r.createdAt })),
  });
});

export default router;
