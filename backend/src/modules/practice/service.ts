import { prisma } from '../../db.js';
import { groqChatJson, groqChatAvailable } from '../../providers/llm/groqChat.js';

/**
 * AI roleplay practice. Groq (llama-3.1-8b-instant) plays an international
 * client; every VA reply gets structured coaching feedback plus the client's
 * next line in ONE call. Difficulty (1-5) is seeded from the user's recent
 * overall scores and shapes the client's demeanor.
 */

const MAX_TURNS = 12; // VA replies per session — the model is told to wrap up before this

export interface TurnFeedback {
  didWell: string;
  improve: string;
  strongerExample: string;
  tips: string[];
}

export interface SessionSummary {
  summary: string;
  wins: string[];
  focusAreas: string[];
  scores: { confidence: number; clarity: number; conciseness: number; professionalism: number };
}

const clamp = (n: unknown): number => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

const DIFFICULTY_NOTES: Record<number, string> = {
  1: 'Very friendly, patient client. Encouraging, forgiving of stumbles, asks simple questions.',
  2: 'Friendly professional client. Clear asks, occasional follow-up questions.',
  3: 'Busy, direct client. Expects concise answers, asks pointed follow-ups, mild time pressure.',
  4: 'Demanding client. Pushes back on vague answers, raises objections, questions timelines and costs.',
  5: 'Skeptical, difficult client. Interrupts, challenges competence politely but firmly, raises multiple objections, changes requirements mid-conversation.',
};

export async function difficultyForUser(userId: string): Promise<number> {
  const recent = await prisma.progressMetric.findMany({
    where: { userId, dimension: 'overall' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  if (!recent.length) return 2;
  const avg = recent.reduce((s, m) => s + m.value, 0) / recent.length;
  if (avg < 55) return 1;
  if (avg < 65) return 2;
  if (avg < 75) return 3;
  if (avg < 85) return 4;
  return 5;
}

interface ScenarioSeed {
  title: string;
  scenario: string;
  openingLine: string;
  targetSkills: string[];
}

const MOCK_SCENARIO: ScenarioSeed = {
  title: 'Timeline Pushback (mock)',
  scenario:
    'You are a VA for an e-commerce client. You promised a product-listing cleanup by Friday, but it will take until Tuesday. The client asks for a status update. Deliver the delay confidently: lead with the situation, give the new date once, and offer a concrete next step — without over-apologizing.',
  openingLine: 'Hey, just checking in — are we still on track for the Friday deadline?',
  targetSkills: ['confident delivery', 'one-apology rule', 'leading with the main point'],
};

export async function generateScenario(opts: {
  weaknesses: string[];
  focus?: string;
  difficulty: number;
}): Promise<ScenarioSeed> {
  if (!groqChatAvailable()) return MOCK_SCENARIO;

  const content = await groqChatJson({
    system: `You design roleplay training scenarios for Filipino virtual assistants (VAs) practicing English-language communication with international (US/UK/AU) clients.

Create ONE realistic scenario targeting the given weaknesses. Vary the industry and situation (discovery calls, client interviews, support, sales, objection handling, explaining delays, scope changes...). The VA will chat with an AI playing the client.

Client difficulty ${opts.difficulty}/5: ${DIFFICULTY_NOTES[opts.difficulty]}

Respond ONLY with JSON:
{"title": "short scenario name", "scenario": "2-4 sentence brief for the VA: who the client is, the situation, and what a great outcome looks like", "openingLine": "the client's first message, in character", "targetSkills": ["2-4 specific skills this practices"]}`,
    user: `Weaknesses to target: ${opts.weaknesses.join('; ') || 'general client communication'}${opts.focus ? `\nPrimary focus: ${opts.focus}` : ''}`,
    temperature: 0.9,
    maxTokens: 500,
  });

  const parsed = JSON.parse(content || '{}') as Partial<ScenarioSeed>;
  if (!parsed.title || !parsed.scenario || !parsed.openingLine) return MOCK_SCENARIO;
  return {
    title: parsed.title,
    scenario: parsed.scenario,
    openingLine: parsed.openingLine,
    targetSkills: Array.isArray(parsed.targetSkills) ? parsed.targetSkills.filter((s) => typeof s === 'string') : [],
  };
}

export interface TurnResult {
  feedback: TurnFeedback;
  clientReply: string;
  done: boolean;
}

const MOCK_TURN: TurnResult = {
  feedback: {
    didWell: 'You answered directly and kept a professional tone.',
    improve: 'Lead with the key information before the supporting detail.',
    strongerExample: 'The cleanup will be done Tuesday. I hit a data issue, fixed it, and built in a buffer — I can send the first batch today.',
    tips: ['State the headline first.', 'One apology maximum, then move to the fix.'],
  },
  clientReply: 'Okay, thanks for the straight answer. What do you need from me to make Tuesday certain? (mock)',
  done: false,
};

export async function playTurn(opts: {
  scenario: string;
  targetSkills: string[];
  difficulty: number;
  history: Array<{ role: string; text: string }>;
  vaReply: string;
  turnNumber: number;
}): Promise<TurnResult> {
  if (!groqChatAvailable()) return { ...MOCK_TURN, done: opts.turnNumber >= 3 };

  const transcript = opts.history.map((t) => `${t.role === 'va' ? 'VA' : 'Client'}: ${t.text}`).join('\n');

  const content = await groqChatJson({
    system: `You are two things at once in a roleplay trainer for Filipino VAs:
1. A communication coach reviewing the VA's LATEST reply.
2. An international client (difficulty ${opts.difficulty}/5: ${DIFFICULTY_NOTES[opts.difficulty]}) continuing the conversation in character.

Scenario: ${opts.scenario}
Skills being practiced: ${opts.targetSkills.join(', ') || 'client communication'}
This is VA reply #${opts.turnNumber} of at most ${MAX_TURNS}. If the scenario has reached a natural resolution (or this is reply #${MAX_TURNS - 2} or later), wrap the conversation up and set "done" true.

Coaching rules: specific and encouraging, grounded in the VA's actual words; the strongerExample must be a full rewritten version of THEIR reply, not generic advice.

Respond ONLY with JSON:
{"feedback": {"didWell": "1-2 sentences", "improve": "1-2 sentences", "strongerExample": "a stronger version of the VA's reply, verbatim-ready", "tips": ["1-3 short practical tips"]}, "clientReply": "the client's next message in character (a closing line if done)", "done": false}`,
    user: `Conversation so far:\n${transcript}\n\nVA's latest reply (coach this): ${opts.vaReply}`,
    temperature: 0.7,
    maxTokens: 700,
  });

  const parsed = JSON.parse(content || '{}') as Partial<TurnResult> & { feedback?: Partial<TurnFeedback> };
  const fb: Partial<TurnFeedback> = parsed.feedback || {};
  return {
    feedback: {
      didWell: typeof fb.didWell === 'string' ? fb.didWell : 'Good effort — you kept the conversation moving.',
      improve: typeof fb.improve === 'string' ? fb.improve : 'Aim for a clearer, more direct structure.',
      strongerExample: typeof fb.strongerExample === 'string' ? fb.strongerExample : '',
      tips: Array.isArray(fb.tips) ? fb.tips.filter((t) => typeof t === 'string').slice(0, 3) : [],
    },
    clientReply: typeof parsed.clientReply === 'string' && parsed.clientReply ? parsed.clientReply : 'Alright, let’s continue.',
    done: Boolean(parsed.done) || opts.turnNumber >= MAX_TURNS,
  };
}

const MOCK_SUMMARY: SessionSummary = {
  summary: 'Solid session (mock). You stayed professional and improved your directness across turns.',
  wins: ['Professional tone throughout', 'Responded to every objection'],
  focusAreas: ['Lead with the headline', 'Reduce hedging language'],
  scores: { confidence: 68, clarity: 72, conciseness: 65, professionalism: 80 },
};

export async function summarizeSession(opts: {
  scenario: string;
  targetSkills: string[];
  history: Array<{ role: string; text: string }>;
}): Promise<SessionSummary> {
  if (!groqChatAvailable()) return MOCK_SUMMARY;
  if (!opts.history.some((t) => t.role === 'va')) {
    return { ...MOCK_SUMMARY, summary: 'Session ended before any replies — no coaching to give yet.' };
  }

  const transcript = opts.history.map((t) => `${t.role === 'va' ? 'VA' : 'Client'}: ${t.text}`).join('\n');
  const content = await groqChatJson({
    system: `You are a communication coach summarizing a Filipino VA's roleplay practice session. Score ONLY the VA's replies (0-100 per dimension; 70 = solid professional baseline). Be encouraging and specific.

Respond ONLY with JSON:
{"summary": "2-3 sentence overall assessment", "wins": ["2-3 things done well"], "focusAreas": ["2-3 things to keep practicing"], "scores": {"confidence": 0, "clarity": 0, "conciseness": 0, "professionalism": 0}}`,
    user: `Scenario: ${opts.scenario}\nSkills practiced: ${opts.targetSkills.join(', ')}\n\n${transcript}`,
    temperature: 0.5,
    maxTokens: 500,
  });

  const parsed = JSON.parse(content || '{}') as Omit<Partial<SessionSummary>, 'scores'> & { scores?: Record<string, unknown> };
  const scores: Record<string, unknown> = parsed.scores || {};
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : MOCK_SUMMARY.summary,
    wins: Array.isArray(parsed.wins) ? parsed.wins.filter((w) => typeof w === 'string') : [],
    focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.filter((f) => typeof f === 'string') : [],
    scores: {
      confidence: clamp(scores.confidence),
      clarity: clamp(scores.clarity),
      conciseness: clamp(scores.conciseness),
      professionalism: clamp(scores.professionalism),
    },
  };
}

/**
 * Adaptive learning path v1 — a deterministic rule map over the user's recent
 * metrics. Free, explainable, and it changes as the numbers change.
 */
export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  focus: string;
}

export async function recommendationsForUser(userId: string): Promise<Recommendation[]> {
  const metrics = await prisma.progressMetric.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  const avg = (dim: string): number | null => {
    const vals = metrics.filter((m) => m.dimension === dim).slice(0, 5);
    return vals.length ? vals.reduce((s, m) => s + m.value, 0) / vals.length : null;
  };

  const recs: Recommendation[] = [];
  const hedge = avg('hedgePer100Words');
  if (hedge !== null && hedge > 3) {
    recs.push({
      id: 'assertive-communication',
      title: 'Assertive Communication',
      reason: `You hedge about ${hedge.toFixed(1)} times per 100 words ("maybe", "I think"). Practice stating positions plainly.`,
      focus: 'assertive, hedge-free delivery',
    });
  }
  const apology = avg('apologyPer100Words');
  if (apology !== null && apology > 1.5) {
    recs.push({
      id: 'professional-recovery',
      title: 'The One-Apology Rule',
      reason: `Apologies appear ${apology.toFixed(1)} times per 100 words. Practice recovering from problems with one apology and a fix.`,
      focus: 'error recovery without over-apologizing',
    });
  }
  const filler = avg('fillerPer100Words');
  if (filler !== null && filler > 4) {
    recs.push({
      id: 'fluency-drill',
      title: 'Fluency Drills',
      reason: `Filler words appear ${filler.toFixed(1)} times per 100 words. Practice pausing silently instead of filling.`,
      focus: 'fluent, filler-free speech',
    });
  }
  const latency = avg('responseLatencySeconds');
  if (latency !== null && latency > 4) {
    recs.push({
      id: 'quick-thinking',
      title: 'Quick-Thinking Roleplays',
      reason: `Your average response time is ${latency.toFixed(1)}s. Practice rapid-fire client questions with short, confident answers.`,
      focus: 'fast, structured first responses',
    });
  }
  const clarity = avg('clarity');
  if (clarity !== null && clarity < 65) {
    recs.push({
      id: 'structured-answers',
      title: 'Structured Answers',
      reason: `Clarity is averaging ${Math.round(clarity)}/100. Practice headline-first answers: point, reason, next step.`,
      focus: 'clear, front-loaded answers',
    });
  }
  const confidence = avg('confidence');
  if (confidence !== null && confidence < 65) {
    recs.push({
      id: 'confident-delivery',
      title: 'Confident Delivery',
      reason: `Confidence is averaging ${Math.round(confidence)}/100. Practice holding your ground with pushy clients.`,
      focus: 'confident delivery under pressure',
    });
  }
  const conciseness = avg('conciseness');
  if (conciseness !== null && conciseness < 65) {
    recs.push({
      id: 'concise-answers',
      title: 'Concise Answer Drills',
      reason: `Conciseness is averaging ${Math.round(conciseness)}/100. Practice answering in two sentences or fewer.`,
      focus: 'concise, no-rambling answers',
    });
  }

  if (!recs.length) {
    recs.push({
      id: 'discovery-call',
      title: metrics.length ? 'Keep Your Edge: Discovery Call' : 'Start Here: Discovery Call',
      reason: metrics.length
        ? 'Your metrics look strong — stretch yourself with a realistic discovery call at your current difficulty.'
        : 'Complete a practice session (or a real call) so HusAI can start tailoring your training.',
      focus: 'general discovery-call communication',
    });
  }
  return recs.slice(0, 4);
}
