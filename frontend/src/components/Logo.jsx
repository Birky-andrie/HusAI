/**
 * HusAI brand mark — an "H" in a speech bubble with a soundwave, in the
 * emerald→teal gradient from the brand reference. `withWordmark` appends the
 * "Hus" + "AI" wordmark (AI in the brand green).
 */
export default function Logo({ size = 30, withWordmark = true, wordmarkColor }) {
  const gid = 'husGrad';
  return (
    <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="HusAI" role="img">
        <defs>
          <linearGradient id={gid} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34d399" />
            <stop offset="1" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        {/* speech bubble */}
        <path
          d="M13 5h16a11 11 0 0 1 11 11v9a11 11 0 0 1 -11 11h-7l-7 6v-6h-2A11 11 0 0 1 2 25v-9A11 11 0 0 1 13 5Z"
          fill={`url(#${gid})`}
        />
        {/* white H */}
        <rect x="15" y="13" width="3.6" height="16" rx="1.4" fill="#fff" />
        <rect x="24.4" y="13" width="3.6" height="16" rx="1.4" fill="#fff" />
        <rect x="15" y="19.2" width="13" height="3.4" rx="1.4" fill="#fff" />
        {/* soundwave */}
        <rect x="31.5" y="17" width="2.4" height="8" rx="1.2" fill="#fff" opacity="0.95" />
        <rect x="35.4" y="14" width="2.4" height="14" rx="1.2" fill="#fff" opacity="0.8" />
      </svg>
      {withWordmark && (
        <span className="logo-word" style={wordmarkColor ? { color: wordmarkColor } : undefined}>
          <b>Hus</b>
          <i>AI</i>
        </span>
      )}
    </span>
  );
}
