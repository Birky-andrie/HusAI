/**
 * Deterministic communication metrics computed from the VA's lines only.
 * These complement the LLM's judgment scores with countable facts — the same
 * regexes every time, so trends across meetings are apples-to-apples.
 */

const FILLER_RE = /\b(um+|uh+|ah+|hmm+|you know|basically|actually|literally|i mean)\b/gi;
const APOLOGY_RE = /\b(sorry|apologi[sz]e[sd]?|apologi[sz]ing|my bad|pasensya)\b/gi;
const HEDGE_RE = /\b(maybe|i think|i guess|perhaps|possibly|kind of|sort of|a little bit|if (that|it)('s| is) okay)\b/gi;

export interface CallMetrics {
  vaWordCount: number;
  vaLineCount: number;
  fillerCount: number;
  apologyCount: number;
  hedgeCount: number;
  fillerPer100Words: number;
  apologyPer100Words: number;
  hedgePer100Words: number;
  avgResponseLatencySeconds?: number;
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) || []).length;
}

const per100 = (count: number, words: number): number => (words > 0 ? Math.round((count / words) * 100 * 10) / 10 : 0);

export function computeCallMetrics(transcript: string, avgResponseLatencySeconds?: number): CallMetrics {
  const lines = transcript.split('\n').filter((l) => l.trim());
  const labeled = lines.some((l) => /^(VA|Client):/i.test(l));
  // Unlabeled transcripts (mic-only calls) are all VA speech by construction.
  const vaLines = labeled ? lines.filter((l) => /^VA:/i.test(l)).map((l) => l.replace(/^VA:\s*/i, '')) : lines;

  const vaText = vaLines.join(' ');
  const vaWordCount = vaText.split(/\s+/).filter(Boolean).length;
  const fillerCount = countMatches(vaText, FILLER_RE);
  const apologyCount = countMatches(vaText, APOLOGY_RE);
  const hedgeCount = countMatches(vaText, HEDGE_RE);

  return {
    vaWordCount,
    vaLineCount: vaLines.length,
    fillerCount,
    apologyCount,
    hedgeCount,
    fillerPer100Words: per100(fillerCount, vaWordCount),
    apologyPer100Words: per100(apologyCount, vaWordCount),
    hedgePer100Words: per100(hedgeCount, vaWordCount),
    ...(avgResponseLatencySeconds !== undefined && Number.isFinite(avgResponseLatencySeconds)
      ? { avgResponseLatencySeconds: Math.round(avgResponseLatencySeconds * 10) / 10 }
      : {}),
  };
}
