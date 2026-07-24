import { geminiGenerateJson, geminiAvailable } from '../../providers/llm/gemini.js';
import { groqChatJson, groqChatAvailable } from '../../providers/llm/groqChat.js';

const REVIEW_SYSTEM_PROMPT = `You are a communication coach reviewing a call transcript from a Filipino virtual assistant (VA) speaking with an international client.

Transcript lines may be labeled "VA:" (the person you are coaching) and "Client:" (their customer). Coach ONLY the VA. Client lines are context — never critique, score, or address the client, and every evidence quote must come from a VA line. If the transcript has no labels, treat all speech as the VA's.

Identify 2-4 SPECIFIC communication patterns present in the VA's speech on this call — for example: excessive apologizing, burying the main point, over-hedging ("maybe", "I think", "if it's okay"), indirect refusals, filler overuse, or not confirming next steps. For each, quote a short excerpt from the transcript as evidence and explain the pattern's impact in 1-2 supportive sentences.

Then create 2-3 realistic roleplay exercises targeting those patterns, appropriate for a Filipino VA practicing English-language client communication. Each exercise needs a title, a concrete scenario the VA can act out (2-4 sentences), and the specific skill it targets.

Also score the VA's communication on this call from 0-100 in four dimensions (be fair but honest; 70 = solid professional baseline):
- confidence: assertive, self-assured delivery without excessive hedging or apologizing
- clarity: easy to follow, main point stated plainly and early
- conciseness: says what's needed without rambling or filler
- professionalism: warm, courteous, client-appropriate tone and follow-through

Be encouraging and specific. Never invent quotes that are not in the transcript.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    insights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          pattern: { type: 'STRING' },
          evidence: { type: 'STRING' },
          explanation: { type: 'STRING' },
        },
        required: ['pattern', 'evidence', 'explanation'],
      },
    },
    roleplayExercises: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          scenario: { type: 'STRING' },
          targetSkill: { type: 'STRING' },
        },
        required: ['title', 'scenario', 'targetSkill'],
      },
    },
    scores: {
      type: 'OBJECT',
      properties: {
        confidence: { type: 'INTEGER' },
        clarity: { type: 'INTEGER' },
        conciseness: { type: 'INTEGER' },
        professionalism: { type: 'INTEGER' },
      },
      required: ['confidence', 'clarity', 'conciseness', 'professionalism'],
    },
  },
  required: ['insights', 'roleplayExercises', 'scores'],
};

export interface ReviewInsight {
  pattern: string;
  evidence: string;
  explanation: string;
}

export interface RoleplayExercise {
  title: string;
  scenario: string;
  targetSkill: string;
}

export interface ReviewScores {
  confidence: number;
  clarity: number;
  conciseness: number;
  professionalism: number;
}

export interface ReviewResult {
  insights: ReviewInsight[];
  roleplayExercises: RoleplayExercise[];
  scores: ReviewScores;
  /** Which provider produced this review — drives quota accounting upstream. */
  provider?: 'gemini' | 'groq';
  mock?: boolean;
}

const SCORE_DIMENSIONS: Array<keyof ReviewScores> = ['confidence', 'clarity', 'conciseness', 'professionalism'];

const clampScore = (n: unknown): number => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export function overallFromScores(scores: ReviewScores): number {
  return Math.round(SCORE_DIMENSIONS.reduce((sum, d) => sum + scores[d], 0) / SCORE_DIMENSIONS.length);
}

const MOCK_REVIEW: ReviewResult = {
  scores: { confidence: 62, clarity: 70, conciseness: 66, professionalism: 78 },
  insights: [
    {
      pattern: 'Excessive apologizing',
      evidence: '"Sorry po, sorry, I will check again, so sorry for that."',
      explanation:
        'Apologizing multiple times for a small issue can make the client doubt your competence. One clear apology plus a fix is stronger.',
    },
    {
      pattern: 'Burying the main point',
      evidence: '"So I checked the file, and there were some things, and also the schedule... anyway the report is actually done."',
      explanation:
        'The key news (the report is done) came last. Lead with the headline, then add detail.',
    },
  ],
  roleplayExercises: [
    {
      title: 'One Apology Rule',
      scenario:
        'Your client points out a typo in a deliverable. Respond with exactly one apology, state the fix, and give a completion time. Practice until it feels natural.',
      targetSkill: 'Confident error recovery without over-apologizing',
    },
    {
      title: 'Headline First',
      scenario:
        'You finished a task early but hit two small snags along the way. Report this to the client leading with the good news in the first sentence.',
      targetSkill: 'Front-loading the main point',
    },
  ],
};

/**
 * Field-by-field validation shared by both provider paths. Gemini's
 * responseSchema makes bad shapes unlikely; Groq's json_object mode only
 * guarantees valid JSON, not THIS shape — so nothing is trusted here.
 */
function validateReview(parsed: unknown): Omit<ReviewResult, 'provider' | 'mock'> {
  const p = parsed as Partial<ReviewResult>;
  if (!Array.isArray(p.insights) || !Array.isArray(p.roleplayExercises)) {
    throw new Error('review response missing required arrays');
  }
  const insights = p.insights
    .filter((i) => i && typeof i.pattern === 'string' && typeof i.evidence === 'string' && typeof i.explanation === 'string')
    .slice(0, 6);
  const roleplayExercises = p.roleplayExercises
    .filter((e) => e && typeof e.title === 'string' && typeof e.scenario === 'string' && typeof e.targetSkill === 'string')
    .slice(0, 5);
  if (!insights.length || !roleplayExercises.length) {
    throw new Error('review response has no valid insights or exercises');
  }
  const rawScores = (p.scores || {}) as unknown as Record<string, unknown>;
  return {
    insights,
    roleplayExercises,
    scores: {
      confidence: clampScore(rawScores.confidence),
      clarity: clampScore(rawScores.clarity),
      conciseness: clampScore(rawScores.conciseness),
      professionalism: clampScore(rawScores.professionalism),
    },
  };
}

// Groq has no responseSchema equivalent, so the shape rides in the prompt.
const GROQ_SHAPE_NOTE = `

Respond ONLY with JSON in exactly this shape:
{"insights": [{"pattern": "...", "evidence": "...", "explanation": "..."}], "roleplayExercises": [{"title": "...", "scenario": "...", "targetSkill": "..."}], "scores": {"confidence": 0, "clarity": 0, "conciseness": 0, "professionalism": 0}}`;

// Bigger than the Lifeline/Practice model — the review needs real reasoning.
const GROQ_REVIEW_MODEL = 'llama-3.3-70b-versatile';

export async function reviewTranscript(fullTranscript: string, callDurationSeconds?: number): Promise<ReviewResult> {
  if (!geminiAvailable() && !groqChatAvailable()) {
    return { ...MOCK_REVIEW, mock: true };
  }

  const userPrompt = `Call duration: ${Math.round((callDurationSeconds || 0) / 60)} minutes.\n\nTranscript:\n${fullTranscript}`;

  // Primary: Gemini — API-enforced JSON schema, separate free quota.
  if (geminiAvailable()) {
    try {
      const text = await geminiGenerateJson({
        system: REVIEW_SYSTEM_PROMPT,
        user: userPrompt,
        schema: RESPONSE_SCHEMA,
        temperature: 0.7,
      });
      return { ...validateReview(JSON.parse(text)), provider: 'gemini' };
    } catch (err) {
      if (!groqChatAvailable()) throw err;
      console.warn('review: Gemini failed after retries, falling back to Groq:', (err as Error).message);
    }
  }

  // Fallback (or primary when only a Groq key is set). One re-ask on a bad
  // shape, then give up to the route's existing "try again" handling.
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await groqChatJson({
        system: REVIEW_SYSTEM_PROMPT + GROQ_SHAPE_NOTE,
        user: userPrompt,
        temperature: 0.7,
        maxTokens: 1500,
        model: GROQ_REVIEW_MODEL,
      });
      return { ...validateReview(JSON.parse(content || '{}')), provider: 'groq' };
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error('review generation failed');
}
