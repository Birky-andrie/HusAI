export default function LifelineCard({ bullets }) {
  if (!bullets?.length) return null;
  return (
    <div className="lifeline-card" role="status" aria-live="polite">
      <div className="lifeline-title">💡 You could say…</div>
      <ul>
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  );
}
