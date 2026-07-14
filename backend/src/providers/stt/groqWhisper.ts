import { config } from '../../config.js';
import type { SttProvider, SttSegmentRequest, SttResult } from './types.js';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

export const groqWhisper: SttProvider = {
  name: 'groq-whisper-large-v3-turbo',

  get available() {
    return Boolean(config.groqApiKey);
  },

  async transcribeSegment({ audio, mimeType }: SttSegmentRequest): Promise<SttResult> {
    const baseMime = (mimeType || 'audio/webm').split(';')[0].trim();
    const ext = EXT_BY_MIME[baseMime] || 'webm';

    const form = new FormData();
    // Buffer's ArrayBufferLike backing doesn't satisfy BlobPart in @types/node 26; runtime is fine.
    form.append('file', new Blob([audio as unknown as ArrayBufferView<ArrayBuffer>], { type: baseMime }), `chunk.${ext}`);
    form.append('model', WHISPER_MODEL);
    form.append('response_format', 'json');
    // No language pin: calls mix English and Filipino; Whisper handles code-switching better unpinned.

    const resp = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.groqApiKey}` },
      body: form,
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Groq whisper ${resp.status}: ${body.slice(0, 300)}`);
    }

    const data = (await resp.json()) as { text?: string };
    return { text: (data.text || '').trim() };
  },
};
