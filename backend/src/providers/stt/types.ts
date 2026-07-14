/**
 * Speech-to-text abstraction. Groq Whisper (chunked segments) is the free-tier
 * default; a streaming provider (e.g. Deepgram) can implement this interface
 * later — add an `openStream()` method alongside `transcribeSegment()` then,
 * so chunked callers keep working unchanged.
 */
export interface SttSegmentRequest {
  audio: Buffer;
  mimeType: string;
}

export interface SttResult {
  text: string;
  /** 0-1 when the provider reports it; undefined for providers that don't (Groq Whisper). */
  confidence?: number;
}

export interface SttProvider {
  readonly name: string;
  /** False when the provider can't run (e.g. missing API key) — callers fall back to mock responses. */
  readonly available: boolean;
  transcribeSegment(req: SttSegmentRequest): Promise<SttResult>;
}
