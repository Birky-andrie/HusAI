import { useEffect, useRef, useState } from 'react';
import AudioWaveform from './AudioWaveform.jsx';

const MicGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
  </svg>
);

/**
 * Live microphone visualizer. When a MediaStream is supplied it drives the bars
 * from real audio levels (AnalyserNode + rAF, mutating DOM directly to avoid
 * per-frame React renders) and glows softly while the user is speaking. With no
 * stream — or when the user prefers reduced motion — it falls back to the calm
 * decorative AudioWaveform, so the same component works everywhere.
 */
export default function MicVisualizer({ stream, active = true, bars = 5, label }) {
  const barRefs = useRef([]);
  const [speaking, setSpeaking] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const live = Boolean(stream) && active && !reduced;

  useEffect(() => {
    if (!live) return undefined;
    let ctx, raf, speakingNow = false;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.max(1, Math.floor(data.length / bars));

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let b = 0; b < bars; b++) {
          let v = 0;
          for (let j = 0; j < step; j++) v += data[b * step + j] || 0;
          v /= step;
          sum += v;
          const el = barRefs.current[b];
          if (el) el.style.height = `${Math.min(100, (v / 255) * 150 + 12)}%`;
        }
        const isSpeaking = sum / bars > 16;
        if (isSpeaking !== speakingNow) {
          speakingNow = isSpeaking;
          setSpeaking(isSpeaking);
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* audio graph unavailable — the idle fallback renders instead */
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
    };
  }, [live, stream, bars]);

  return (
    <span className={`mic-viz${speaking ? ' speaking' : ''}`} aria-label={label || 'Microphone activity'}>
      <span className="mic-glyph" aria-hidden="true">
        <MicGlyph />
      </span>
      {live ? (
        <span className="mic-bars" aria-hidden="true">
          {Array.from({ length: bars }).map((_, i) => (
            <i key={i} ref={(el) => (barRefs.current[i] = el)} />
          ))}
        </span>
      ) : (
        <AudioWaveform bars={bars} />
      )}
    </span>
  );
}
