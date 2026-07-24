import { prisma } from '../../db.js';
import { reviewTranscript, overallFromScores, type ReviewResult } from '../review/service.js';
import { computeCallMetrics, type CallMetrics } from './metrics.js';
import { recordCall } from '../../middleware/quotaGuard.js';

export interface StoredReview {
  id: string;
  overallScore: number;
  insights: ReviewResult['insights'];
  roleplayExercises: ReviewResult['roleplayExercises'];
  scores: ReviewResult['scores'];
  metrics: CallMetrics;
  createdAt: Date;
}

type ReviewRow = {
  id: string;
  overallScore: number;
  insightsJson: string;
  exercisesJson: string;
  scoresJson: string;
  metricsJson: string;
  createdAt: Date;
};

export function parseReviewRow(row: ReviewRow): StoredReview {
  return {
    id: row.id,
    overallScore: row.overallScore,
    insights: JSON.parse(row.insightsJson),
    roleplayExercises: JSON.parse(row.exercisesJson),
    scores: JSON.parse(row.scoresJson),
    metrics: JSON.parse(row.metricsJson),
    createdAt: row.createdAt,
  };
}

/**
 * Runs the AI review for a stored meeting and persists Review + ProgressMetric
 * rows. Separated from meeting creation so a Gemini failure never loses the
 * transcript — the client retries this step alone.
 */
export async function generateReviewForMeeting(
  meeting: { id: string; userId: string; transcript: string; durationSeconds: number; platform: string },
  avgResponseLatencySeconds?: number
): Promise<StoredReview> {
  const result = await reviewTranscript(meeting.transcript, meeting.durationSeconds);
  if (!result.mock) {
    recordCall(result.provider === 'groq' ? 'groqChat' : 'gemini', {
      endpoint: '/api/meetings',
      platform: meeting.platform,
      ok: true,
      transcriptChars: meeting.transcript.length,
    });
  }

  const metrics = computeCallMetrics(meeting.transcript, avgResponseLatencySeconds);
  const overallScore = overallFromScores(result.scores);

  const row = await prisma.review.upsert({
    where: { meetingId: meeting.id },
    update: {}, // an existing review stands; don't burn another Gemini call's result
    create: {
      meetingId: meeting.id,
      userId: meeting.userId,
      overallScore,
      insightsJson: JSON.stringify(result.insights),
      exercisesJson: JSON.stringify(result.roleplayExercises),
      scoresJson: JSON.stringify(result.scores),
      metricsJson: JSON.stringify(metrics),
    },
  });

  const dims: Array<[string, number]> = [
    ['overall', overallScore],
    ['confidence', result.scores.confidence],
    ['clarity', result.scores.clarity],
    ['conciseness', result.scores.conciseness],
    ['professionalism', result.scores.professionalism],
    ['fillerPer100Words', metrics.fillerPer100Words],
    ['apologyPer100Words', metrics.apologyPer100Words],
    ['hedgePer100Words', metrics.hedgePer100Words],
  ];
  if (metrics.avgResponseLatencySeconds !== undefined) {
    dims.push(['responseLatencySeconds', metrics.avgResponseLatencySeconds]);
  }
  // Idempotent-ish: only write metrics the first time a review lands for this meeting.
  const existing = await prisma.progressMetric.count({ where: { refId: meeting.id } });
  if (existing === 0) {
    await prisma.progressMetric.createMany({
      data: dims.map(([dimension, value]) => ({
        userId: meeting.userId,
        source: 'call',
        refId: meeting.id,
        dimension,
        value,
      })),
    });
  }

  return parseReviewRow(row);
}
