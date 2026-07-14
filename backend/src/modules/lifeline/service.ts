import { groqChatJson, groqChatAvailable } from '../../providers/llm/groqChat.js';

const LIFELINE_SYSTEM_PROMPT = `You are a real-time call coach for Filipino virtual assistants (VAs) on live phone calls with international (mostly US/UK/AU) clients. The client has gone silent. Based on the recent transcript, suggest exactly 3 short things the VA could say RIGHT NOW to keep the call moving.

Rules:
- Each suggestion is ONE sentence the VA can say verbatim, under 15 words.
- Confident, warm, professional. No over-apologizing, no excessive hedging.
- Prefer moving the conversation forward: confirm next steps, summarize, ask a clarifying question.
- Respond ONLY with JSON: {"bullets": ["...", "...", "..."]}`;

const MOCK_BULLETS = [
  'Just to confirm, you would like this done by Friday, correct?',
  'Shall I walk you through the next steps now?',
  'To summarize: I will send the report and follow up tomorrow.',
];

export interface LifelineResult {
  bullets: string[];
  mock?: boolean;
}

export async function getLifelineBullets(transcriptSnippet: string): Promise<LifelineResult> {
  if (!groqChatAvailable()) {
    return { bullets: MOCK_BULLETS, mock: true };
  }

  const content = await groqChatJson({
    system: LIFELINE_SYSTEM_PROMPT,
    user: `Recent transcript:\n${transcriptSnippet}`,
    temperature: 0.6,
    maxTokens: 200,
  });

  const parsed = JSON.parse(content || '{}') as { bullets?: unknown };
  let bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets.filter((b): b is string => typeof b === 'string' && Boolean(b.trim())).slice(0, 3)
    : [];
  // The model occasionally returns fewer than 3 — pad from mocks rather than break the UI contract.
  while (bullets.length < 3) bullets.push(MOCK_BULLETS[bullets.length]);
  return { bullets };
}
