import { useId } from 'react';

/**
 * HusAI brand mark — an inline SVG so it stays crisp at any size and carries the
 * violet identity on both light and dark surfaces. An "H" letterform in violet →
 * indigo, a fuchsia → violet → blue soundwave, and a soft AI node. Rendered
 * everywhere through this one component, optionally with the "HusAI" wordmark.
 */
export function LogoMark({ size = 30 }) {
  const uid = useId().replace(/[:]/g, '');
  const pid = `hp-${uid}`;
  const wid = `hw-${uid}`;
  const aid = `ha-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="HusAI"
      style={{ display: 'block', flex: '0 0 auto' }}
    >
      <defs>
        <linearGradient id={pid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id={wid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="38%" stopColor="#d946ef" />
          <stop offset="72%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <radialGradient id={aid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d946ef" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      {/* H letterform */}
      <rect x="4" y="4" width="4" height="24" rx="1.5" fill={`url(#${pid})`} />
      <rect x="14" y="4" width="4" height="24" rx="1.5" fill={`url(#${pid})`} />
      <rect x="4" y="14" width="14" height="4" rx="1.5" fill={`url(#${pid})`} opacity="0.72" />
      {/* Waveform bars */}
      <rect x="21" y="11" width="2.2" height="10" rx="1.1" fill={`url(#${wid})`} opacity="0.9" />
      <rect x="24.5" y="8" width="2.2" height="16" rx="1.1" fill={`url(#${wid})`} />
      <rect x="28" y="13" width="2.2" height="8" rx="1.1" fill={`url(#${wid})`} opacity="0.82" />
      {/* AI node */}
      <circle cx="29.1" cy="7" r="2.6" fill={`url(#${aid})`} />
      <circle cx="29.1" cy="7" r="1.4" fill="#ffffff" />
    </svg>
  );
}

export default function Logo({ size = 30, withWordmark = true, wordmarkColor }) {
  return (
    <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="logo-word" style={wordmarkColor ? { color: wordmarkColor } : undefined}>
          <b>Hus</b>
          <i>AI</i>
        </span>
      )}
    </span>
  );
}
