import { config } from '../../config.js';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const CHAT_MODEL = 'llama-3.1-8b-instant';

export interface ChatJsonRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export function groqChatAvailable(): boolean {
  return Boolean(config.groqApiKey);
}

/** Low-latency JSON-mode chat completion (Lifeline path). Returns the raw content string; the caller parses. */
export async function groqChatJson({ system, user, temperature = 0.6, maxTokens = 200 }: ChatJsonRequest): Promise<string> {
  const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Groq chat ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}
