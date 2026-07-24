import { Router } from 'express';
import { prisma } from '../../db.js';
import { authRequired } from '../../middleware/auth.js';
import { quotaGuard, recordCall } from '../../middleware/quotaGuard.js';
import { ownedOr404 } from '../../lib/ownership.js';
import { generateReviewForMeeting, parseReviewRow } from './service.js';

const router = Router();
router.use(authRequired);

/**
 * Save a completed call and produce its review. The meeting is persisted FIRST
 * so an AI failure never loses the transcript — the response then carries
 * `review: null` and the client retries via POST /:id/review.
 */
router.post('/', quotaGuard('gemini'), async (req, res) => {
  const { transcript, durationSeconds, platform, startedAt, avgResponseLatencySeconds } = (req.body || {}) as {
    transcript?: unknown;
    durationSeconds?: unknown;
    platform?: unknown;
    startedAt?: unknown;
    avgResponseLatencySeconds?: unknown;
  };
  if (typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'transcript (string) is required' });
  }
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration < 0) {
    return res.status(400).json({ error: 'durationSeconds (number) is required' });
  }

  const meeting = await prisma.meeting.create({
    data: {
      userId: req.user!.id,
      transcript: transcript.trim(),
      durationSeconds: Math.round(duration),
      platform: platform === 'desktop' ? 'desktop' : 'web',
      startedAt: typeof startedAt === 'string' || typeof startedAt === 'number' ? new Date(startedAt) : new Date(),
    },
  });

  try {
    const review = await generateReviewForMeeting(meeting, Number(avgResponseLatencySeconds) || undefined);
    res.status(201).json({ meeting: { id: meeting.id, startedAt: meeting.startedAt }, review });
  } catch (err) {
    recordCall('gemini', { endpoint: '/api/meetings', platform: meeting.platform, ok: false, error: (err as Error).message });
    console.error('meeting review error:', (err as Error).message);
    res.status(201).json({ meeting: { id: meeting.id, startedAt: meeting.startedAt }, review: null });
  }
});

/** Retry review generation for a saved meeting (e.g. after a Gemini 503). */
router.post('/:id/review', quotaGuard('gemini'), async (req, res) => {
  const meeting = await ownedOr404(res, () =>
    prisma.meeting.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { review: true },
    })
  );
  if (!meeting) return;
  if (meeting.review) return res.json({ review: parseReviewRow(meeting.review) });

  const { avgResponseLatencySeconds } = (req.body || {}) as { avgResponseLatencySeconds?: unknown };
  try {
    const review = await generateReviewForMeeting(meeting, Number(avgResponseLatencySeconds) || undefined);
    res.json({ review });
  } catch (err) {
    recordCall('gemini', { endpoint: '/api/meetings', platform: meeting.platform, ok: false, error: (err as Error).message });
    console.error('meeting review retry error:', (err as Error).message);
    res.status(503).json({
      error: 'review-failed',
      message: 'Your review is taking longer than expected. Please try again in a moment.',
    });
  }
});

router.get('/', async (req, res) => {
  const meetings = await prisma.meeting.findMany({
    where: { userId: req.user!.id },
    orderBy: { startedAt: 'desc' },
    take: 100,
    include: { review: { select: { overallScore: true } } },
  });
  res.json({
    meetings: meetings.map((m) => ({
      id: m.id,
      startedAt: m.startedAt,
      durationSeconds: m.durationSeconds,
      platform: m.platform,
      overallScore: m.review?.overallScore ?? null,
    })),
  });
});

router.get('/:id', async (req, res) => {
  const meeting = await ownedOr404(res, () =>
    prisma.meeting.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { review: true },
    })
  );
  if (!meeting) return;
  res.json({
    meeting: {
      id: meeting.id,
      startedAt: meeting.startedAt,
      durationSeconds: meeting.durationSeconds,
      platform: meeting.platform,
      transcript: meeting.transcript,
    },
    review: meeting.review ? parseReviewRow(meeting.review) : null,
  });
});

export default router;
