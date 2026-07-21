/**
 * Small metric tile (reuses the shared .stat-tile styles). `delta` colours by
 * direction; `downIsGood` flips it for rate metrics (fewer fillers = better).
 */
export default function StatTile({ label, value, unit, delta, deltaSuffix = '', downIsGood = false }) {
  let cls = 'muted';
  let arrow = '';
  if (typeof delta === 'number' && delta !== 0) {
    cls = (downIsGood ? delta < 0 : delta > 0) ? 'good' : 'bad';
    arrow = delta > 0 ? '↑' : '↓';
  }
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <small style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}> {unit}</small>}
      </span>
      {delta === null || delta === undefined ? (
        <span className="delta muted">—</span>
      ) : (
        <span className={`delta ${cls}`}>
          {arrow} {delta > 0 ? '+' : ''}
          {delta}
          {deltaSuffix}
        </span>
      )}
    </div>
  );
}
