import { config } from '../../config.js';

const MODEL = 'gemini-3.5-flash'; // gemini-2.5-flash was pulled from new-key access ahead of its official Oct 2026 shutdown; 3.5-flash is the current stable replacement. Do NOT switch to a *-pro model (removed from free tier April 2026).
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface GeminiJsonRequest {
  system: string;
  user: string;
  /** Gemini responseSchema (OBJECT/ARRAY/STRING type tree) — enforced JSON shape. */
  schema: unknown;
  temperature?: number;
}

export function geminiAvailable(): boolean {
  return Boolean(config.geminiApiKey);
}

/** Schema-enforced JSON generation (Review path). Returns the raw JSON string; the caller parses and validates. */
export async function geminiGenerateJson({ system, user, schema, temperature = 0.7 }: GeminiJsonRequest): Promise<string> {
  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.geminiApiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature,
      },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Gemini ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = (await resp.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return text;
}
