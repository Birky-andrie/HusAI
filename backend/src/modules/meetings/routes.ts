import { Router } from 'express';
import { prisma } from '../../db.js';
import { authRequired } from '../../middleware/auth.js';
import { quotaGuard, recordCall } from '../../middleware/quotaGuard.js';
import { ownedOr404 } from '../../lib/ownership.js';
import { usageStatusForUser, limitMessage } from '../../lib/usage.js';
import { generateReviewForMeeting, parseReviewRow } from './service.js';

const router = Router();
router.use(authRequired);

/** A transcript line as the live session tracks it, before it is flattened. */
type TimedLine = { t: number; speaker: string; text: string };

/**
 * Validate and normalise the timestamped transcript. Untrusted input, so
 * every field is checked — a malformed array is dropped entirely rather than
 * partially stored, because a half-timestamped transcript is worse to render
 * than none at all (the UI's fallback path is already correct).
 */
function normaliseTimedLines(input: unknown): TimedLine[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const out: TimedLine[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const { t, speaker, text } = raw as Record<string, unknown>;
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) return null;
    if (speaker !== 'va' && speaker !== 'client') return null;
    if (typeof text !== 'string' || !text.trim()) return null;
    out.push({ t: Math.round(t), speaker, text: text.trim() });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Save a completed call and produce its review. The meeting is persisted FIRST
 * so an AI failure never loses the transcript — the response then carries
 * `review: null` and the client retries via POST /:id/review.
 *
 * Free-tier limits gate the REVIEW, never the save. The call already happened;
 * refusing to store the transcript would destroy the user's data to enforce a
 * billing rule. So an over-quota user still gets their meeting saved and can
 * read the transcript back — what they do not get is the AI review, which is
 * both the Pro value and the expensive call.
 */
router.post('/', quotaGuard('gemini'), async (req, res) => {
  const { transcript, timedLines, durationSeconds, platform, startedAt, avgResponseLatencySeconds } = (req.body || {}) as {
    transcript?: unknown;
    timedLines?: unknown;
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

  // Checked BEFORE the row is created so this call is not counted against
  // itself — the question is whether they were allowed to make it, not
  // whether they are allowed to have made it.
  const status = await usageStatusForUser(req.user!.id);

  const timed = normaliseTimedLines(timedLines);
  const meeting = await prisma.meeting.create({
    data: {
      userId: req.user!.id,
      transcript: transcript.trim(),
      transcriptJson: timed ? JSON.stringify(timed) : null,
      durationSeconds: Math.round(duration),
      platform: platform === 'desktop' ? 'desktop' : 'web',
      startedAt: typeof startedAt === 'string' || typeof startedAt === 'number' ? new Date(startedAt) : new Date(),
    },
  });

  if (!status.canStartCall) {
    return res.status(402).json({
      error: 'limit-reached',
      message: limitMessage(status),
      blockedBy: status.blockedBy,
      meeting: { id: meeting.id, startedAt: meeting.startedAt },
      review: null,
    });
  }

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
  // `timedLines` is null for every meeting recorded before transcriptJson
  // existed, and for any whose payload failed validation. The client renders
  // the plain transcript in that case, so a parse failure here degrades to the
  // old behaviour rather than breaking the page.
  let timedLines: TimedLine[] | null = null;
  if (meeting.transcriptJson) {
    try {
      timedLines = JSON.parse(meeting.transcriptJson) as TimedLine[];
    } catch {
      console.warn(`meeting ${meeting.id}: unreadable transcriptJson, falling back to plain transcript`);
    }
  }

  res.json({
    meeting: {
      id: meeting.id,
      startedAt: meeting.startedAt,
      durationSeconds: meeting.durationSeconds,
      platform: meeting.platform,
      transcript: meeting.transcript,
      timedLines,
    },
    review: meeting.review ? parseReviewRow(meeting.review) : null,
  });
});

export default router;
