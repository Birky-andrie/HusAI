import logoUrl from '../assets/Logo.png';

/**
 * HusAI logo — the brand mark (transparent PNG in src/assets) plus the optional
 * "HusAI" wordmark. Used across every page, so this one file drives them all.
 */
export default function Logo({ size = 30, withWordmark = true, wordmarkColor }) {
  return (
    <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <img
        src={logoUrl}
        alt="HusAI"
        style={{ height: size, width: 'auto', display: 'block', flex: '0 0 auto' }}
      />
      {withWordmark && (
        <span className="logo-word" style={wordmarkColor ? { color: wordmarkColor } : undefined}>
          <b>Hus</b>
          <i>AI</i>
        </span>
      )}
    </span>
  );
}
