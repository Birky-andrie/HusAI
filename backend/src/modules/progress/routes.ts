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

/**
 * "How did I get this number?" for a single dimension.
 *
 * The tiles show an average of the last 5 data points, which is opaque on its
 * own — a 62 could be five mediocre calls or one disaster among four good ones,
 * and those need different responses from the user. So this returns the actual
 * contributing points with enough context to click through to the call or
 * practice session each one came from.
 *
 * `contributing` is what the current average is computed from; `previous` is
 * the five before it, which is what the delta arrow compares against. Both are
 * newest-first so they read the same way the UI lists them.
 */
router.get('/breakdown', async (req, res) => {
  const dimension = typeof req.query.dimension === 'string' ? req.query.dimension : 'overall';

  const rows = await prisma.progressMetric.findMany({
    where: { userId: req.user!.id, dimension },
    orderBy: { createdAt: 'desc' },
    take: 10, // the 5 that make the current average, plus the 5 it is compared to
  });

  // Titles for the sources, so a row can say "Call on 3 Aug" rather than an
  // opaque cuid. Fetched in two queries rather than per-row.
  const meetingIds = rows.filter((r) => r.source === 'call').map((r) => r.refId);
  const sessionIds = rows.filter((r) => r.source === 'practice').map((r) => r.refId);
  const [meetings, sessions] = await Promise.all([
    meetingIds.length
      ? prisma.meeting.findMany({
          where: { id: { in: meetingIds }, userId: req.user!.id },
          select: { id: true, startedAt: true, durationSeconds: true },
        })
      : [],
    sessionIds.length
      ? prisma.practiceSession.findMany({
          where: { id: { in: sessionIds }, userId: req.user!.id },
          select: { id: true, title: true },
        })
      : [],
  ]);
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const shape = (r: (typeof rows)[number]) => {
    const meeting = meetingById.get(r.refId);
    const session = sessionById.get(r.refId);
    return {
      value: r.value,
      at: r.createdAt,
      source: r.source,
      refId: r.refId,
      label: session?.title ?? (meeting ? 'Coached call' : 'Deleted item'),
      durationSeconds: meeting?.durationSeconds ?? null,
      // Null when the underlying call/session has since been deleted — the
      // metric outlives it, so the UI must not offer a dead link.
      linkable: Boolean(meeting || session),
    };
  };

  res.json({
    dimension,
    contributing: rows.slice(0, 5).map(shape),
    previous: rows.slice(5, 10).map(shape),
    totalDataPoints: await prisma.progressMetric.count({ where: { userId: req.user!.id, dimension } }),
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
