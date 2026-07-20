import { Router } from 'express';
import { prisma } from '../../db.js';
import { authRequired } from '../../middleware/auth.js';
import { quotaGuard, recordCall } from '../../middleware/quotaGuard.js';
import {
  generateScenario,
  playTurn,
  summarizeSession,
  difficultyForUser,
  recommendationsForUser,
} from './service.js';

const router = Router();
router.use(authRequired);

function sessionShape(s: {
  id: string;
  title: string;
  scenario: string;
  targetSkillsJson: string;
  difficulty: number;
  status: string;
  summaryJson: string | null;
  createdAt: Date;
  endedAt: Date | null;
  reviewId: string | null;
}) {
  return {
    id: s.id,
    title: s.title,
    scenario: s.scenario,
    targetSkills: JSON.parse(s.targetSkillsJson),
    difficulty: s.difficulty,
    status: s.status,
    summary: s.summaryJson ? JSON.parse(s.summaryJson) : null,
    createdAt: s.createdAt,
    endedAt: s.endedAt,
    reviewId: s.reviewId,
  };
}

const turnShape = (t: { id: string; role: string; text: string; feedbackJson: string | null; createdAt: Date }) => ({
  id: t.id,
  role: t.role,
  text: t.text,
  feedback: t.feedbackJson ? JSON.parse(t.feedbackJson) : null,
  createdAt: t.createdAt,
});

router.get('/recommendations', async (req, res) => {
  res.json({ recommendations: await recommendationsForUser(req.user!.id) });
});

router.get('/sessions', async (req, res) => {
  const sessions = await prisma.practiceSession.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ sessions: sessions.map(sessionShape) });
});

router.get('/sessions/:id', async (req, res) => {
  const session = await prisma.practiceSession.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { turns: { orderBy: { createdAt: 'asc' } } },
  });
  if (!session) return res.status(404).json({ error: 'not-found' });
  res.json({ session: sessionShape(session), turns: session.turns.map(turnShape) });
});

/** Start a session — from a review's weaknesses, a recommendation focus, or general. */
router.post('/sessions', quotaGuard('groqChat'), async (req, res) => {
  const { reviewId, focus } = (req.body || {}) as { reviewId?: unknown; focus?: unknown };

  let weaknesses: string[] = [];
  let linkedReviewId: string | null = null;
  if (typeof reviewId === 'string' && reviewId) {
    const review = await prisma.review.findFirst({ where: { id: reviewId, userId: req.user!.id } });
    if (!review) return res.status(404).json({ error: 'review-not-found' });
    linkedReviewId = review.id;
    weaknesses = (JSON.parse(review.insightsJson) as Array<{ pattern?: string }>)
      .map((i) => i.pattern)
      .filter((p): p is string => Boolean(p));
  }

  try {
    const difficulty = await difficultyForUser(req.user!.id);
    const seed = await generateScenario({
      weaknesses,
      focus: typeof focus === 'string' ? focus : undefined,
      difficulty,
    });
    recordCall('groqChat', { endpoint: '/api/practice/sessions', ok: true });

    const session = await prisma.practiceSession.create({
      data: {
        userId: req.user!.id,
        reviewId: linkedReviewId,
        title: seed.title,
        scenario: seed.scenario,
        targetSkillsJson: JSON.stringify(seed.targetSkills),
        difficulty,
        turns: { create: { role: 'client', text: seed.openingLine } },
      },
      include: { turns: true },
    });
    res.status(201).json({ session: sessionShape(session), turns: session.turns.map(turnShape) });
  } catch (err) {
    recordCall('groqChat', { endpoint: '/api/practice/sessions', ok: false, error: (err as Error).message });
    console.error('practice scenario error:', (err as Error).message);
    res.status(502).json({ error: 'practice-failed', message: 'Could not start a practice session. Please try again.' });
  }
});

/** The VA replies; one AI call returns coaching feedback + the client's next line. */
router.post('/sessions/:id/turns', quotaGuard('groqChat'), async (req, res) => {
  const { text } = (req.body || {}) as { text?: unknown };
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text (string) is required' });
  }

  const session = await prisma.practiceSession.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { turns: { orderBy: { createdAt: 'asc' } } },
  });
  if (!session) return res.status(404).json({ error: 'not-found' });
  if (session.status !== 'active') return res.status(400).json({ error: 'session-completed' });

  const vaTurnNumber = session.turns.filter((t) => t.role === 'va').length + 1;

  try {
    const result = await playTurn({
      scenario: session.scenario,
      targetSkills: JSON.parse(session.targetSkillsJson),
      difficulty: session.difficulty,
      history: session.turns.map((t) => ({ role: t.role, text: t.text })),
      vaReply: text.trim(),
      turnNumber: vaTurnNumber,
    });
    recordCall('groqChat', { endpoint: '/api/practice/turns', ok: true });

    const [vaTurn, clientTurn] = await prisma.$transaction([
      prisma.practiceTurn.create({
        data: { sessionId: session.id, role: 'va', text: text.trim(), feedbackJson: JSON.stringify(result.feedback) },
      }),
      prisma.practiceTurn.create({
        data: { sessionId: session.id, role: 'client', text: result.clientReply },
      }),
    ]);

    res.json({ vaTurn: turnShape(vaTurn), clientTurn: turnShape(clientTurn), done: result.done });
  } catch (err) {
    recordCall('groqChat', { endpoint: '/api/practice/turns', ok: false, error: (err as Error).message });
    console.error('practice turn error:', (err as Error).message);
    res.status(502).json({ error: 'practice-failed', message: 'The client lost connection for a moment — send that again.' });
  }
});

/** End the session: summary + scores, recorded into progress. */
router.post('/sessions/:id/end', quotaGuard('groqChat'), async (req, res) => {
  const session = await prisma.practiceSession.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { turns: { orderBy: { createdAt: 'asc' } } },
  });
  if (!session) return res.status(404).json({ error: 'not-found' });
  if (session.status !== 'active') return res.json({ session: sessionShape(session) }); // idempotent

  try {
    const summary = await summarizeSession({
      scenario: session.scenario,
      targetSkills: JSON.parse(session.targetSkillsJson),
      history: session.turns.map((t) => ({ role: t.role, text: t.text })),
    });
    recordCall('groqChat', { endpoint: '/api/practice/end', ok: true });

    const overall = Math.round(
      (summary.scores.confidence + summary.scores.clarity + summary.scores.conciseness + summary.scores.professionalism) / 4
    );

    const updated = await prisma.practiceSession.update({
      where: { id: session.id },
      data: { status: 'completed', endedAt: new Date(), summaryJson: JSON.stringify(summary) },
    });

    // Only score sessions where the VA actually practiced.
    if (session.turns.some((t) => t.role === 'va')) {
      await prisma.progressMetric.createMany({
        data: [
          ['overall', overall],
          ['confidence', summary.scores.confidence],
          ['clarity', summary.scores.clarity],
          ['conciseness', summary.scores.conciseness],
          ['professionalism', summary.scores.professionalism],
        ].map(([dimension, value]) => ({
          userId: req.user!.id,
          source: 'practice',
          refId: session.id,
          dimension: dimension as string,
          value: value as number,
        })),
      });
    }

    res.json({ session: sessionShape(updated) });
  } catch (err) {
    recordCall('groqChat', { endpoint: '/api/practice/end', ok: false, error: (err as Error).message });
    console.error('practice end error:', (err as Error).message);
    res.status(502).json({ error: 'practice-failed', message: 'Could not summarize the session. Please try again.' });
  }
});

export default router;
