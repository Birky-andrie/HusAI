import { groqChatJson, groqChatAvailable } from '../../providers/llm/groqChat.js';

const LIFELINE_SYSTEM_PROMPT = `You are a real-time call coach for Filipino virtual assistants (VAs) on live phone calls with international (mostly US/UK/AU) clients. The conversation has paused and it is the VA's turn to speak. Transcript lines may be labeled "VA:" and "Client side:" (older transcripts use "Client:") — pay closest attention to the last client-side line; that is usually what the VA is stuck responding to. The client side is one shared audio channel with no speaker separation, so those lines may come from several different participants — never assume they are all the same person. Suggest exactly 3 short things the VA could say RIGHT NOW to keep the call moving.

Rules:
- Each suggestion is ONE sentence the VA can say verbatim, under 15 words.
- Confident, warm, professional. No over-apologizing, no excessive hedging.
- Prefer moving the conversation forward: confirm next steps, summarize, ask a clarifying question.
- Respond ONLY with JSON: {"bullets": ["...", "...", "..."]}`;

/**
 * Banter mode: the client side is mid-conversation (often several participants
 * talking to each other) and the VA is listening rather than being asked
 * something. The job here is the opposite of the turn-based prompt above — not
 * "fill this silence" but "here is a natural way to join what they are already
 * discussing", so the VA can contribute instead of waiting to be addressed.
 */
const BANTER_SYSTEM_PROMPT = `You are a real-time call coach for Filipino virtual assistants (VAs) on live calls with international (mostly US/UK/AU) clients. RIGHT NOW the people on the client's side are talking amongst themselves and the VA is listening. The VA is NOT being asked a question — they want to join the conversation naturally and contribute something worthwhile.

Transcript lines may be labeled "VA:" and "Client side:" (older transcripts use "Client:"). The client side is one shared audio channel with no speaker separation, so those lines are very likely SEVERAL different people talking to each other — never assume they are one person, and never guess which of them said what.

Suggest exactly 3 short things the VA could say to join in RIGHT NOW.

Rules:
- NEVER put a claim in the VA's mouth that the transcript does not support. Do not write "I've seen this before", "we have experience with that", "I've handled similar projects", or any claim about past work, expertise, results, or capacity. The VA would be saying it live to a real client — a fabricated claim is a professional liability, not a helpful suggestion.
- Because of that, prefer questions, offers to help, and observations about what THEY just said — those are always safe. State facts only if they appear in the transcript.
- Each suggestion is ONE sentence the VA can say verbatim, under 18 words.
- Engage with what they are ACTUALLY discussing — reference their real topic, never generic filler.
- Good ways in: ask a sharp clarifying question, offer to take a task off their plate, surface a consideration they have not raised, or build on a point one of them made.
- Sound like a confident colleague joining a discussion — not an assistant interrupting. No over-apologizing, no asking permission to speak.
- Respond ONLY with JSON: {"bullets": ["...", "...", "..."]}`;

const MOCK_BULLETS = [
  'Just to confirm, you would like this done by Friday, correct?',
  'Shall I walk you through the next steps now?',
  'To summarize: I will send the report and follow up tomorrow.',
];

const MOCK_BANTER_BULLETS = [
  'That timeline sounds workable — I can start on it this afternoon.',
  'Quick question on that: which of the two should I prioritise?',
  'Happy to take that piece off your plate if it helps.',
];

/** 'turn' = it is the VA's turn to reply; 'banter' = joining an ongoing client-side discussion. */
export type LifelineMode = 'turn' | 'banter';

export interface LifelineResult {
  bullets: string[];
  mock?: boolean;
}

export async function getLifelineBullets(transcriptSnippet: string, mode: LifelineMode = 'turn'): Promise<LifelineResult> {
  const banter = mode === 'banter';
  const mocks = banter ? MOCK_BANTER_BULLETS : MOCK_BULLETS;

  if (!groqChatAvailable()) {
    return { bullets: mocks, mock: true };
  }

  const content = await groqChatJson({
    system: banter ? BANTER_SYSTEM_PROMPT : LIFELINE_SYSTEM_PROMPT,
    user: `Recent transcript:\n${transcriptSnippet}`,
    temperature: banter ? 0.75 : 0.6, // a touch more variety when joining a discussion
    maxTokens: 220,
  });

  const parsed = JSON.parse(content || '{}') as { bullets?: unknown };
  let bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets.filter((b): b is string => typeof b === 'string' && Boolean(b.trim())).slice(0, 3)
    : [];
  // The model occasionally returns fewer than 3 — pad from mocks rather than break the UI contract.
  while (bullets.length < 3) bullets.push(mocks[bullets.length]);
  return { bullets };
}
