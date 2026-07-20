export default function LifelineCard({ bullets, onDismiss, docked = false }) {
  if (!bullets?.length) return null;
  return (
    <div className={`lifeline-card${docked ? ' docked' : ''}`} role="status" aria-live="polite">
      <div className="lifeline-header">
        <span className="lifeline-title">💡 You could say…</span>
        <button className="lifeline-dismiss" onClick={onDismiss} aria-label="Dismiss suggestions">
          ✕
        </button>
      </div>
      <ul>
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  );
}
