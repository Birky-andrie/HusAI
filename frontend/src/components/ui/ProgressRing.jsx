/**
 * Circular progress gauge with the emerald brand gradient. Theme-aware (track
 * uses --inset, stroke uses the brand gradient). `value` 0–max.
 */
export default function ProgressRing({ value = 0, max = 100, size = 118, stroke = 8, label, suffix = '%' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const gid = `ring-${label || 'g'}`.replace(/\s+/g, '');

  return (
    <div className="ring">
      <div className="ring-gauge" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={`${label || 'Score'}: ${value}${suffix}`}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent-bright)" />
              <stop offset="100%" stopColor="var(--accent-strong)" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--inset)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 700ms ease' }}
          />
        </svg>
        <span className="ring-value">
          {value}
          <small>{suffix}</small>
        </span>
      </div>
      {label && <span className="ring-label">{label}</span>}
    </div>
  );
}
