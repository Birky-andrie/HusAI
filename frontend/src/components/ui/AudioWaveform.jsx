/**
 * Decorative, self-animating waveform (CSS-driven, no audio input). Used where
 * a gentle "listening" motion is wanted without a live stream (e.g. landing).
 * Respects prefers-reduced-motion via CSS.
 */
export default function AudioWaveform({ bars = 5, className = '' }) {
  return (
    <span className={`aw ${className}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <i key={i} style={{ animationDelay: `${(i % bars) * 0.11}s` }} />
      ))}
    </span>
  );
}
