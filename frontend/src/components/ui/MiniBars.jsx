/**
 * Compact bar chart (violet gradient) for weekly/recent trends. Pure SVG so it
 * scales fluidly; the tallest bar is emphasized. `data` = [{ value, label }].
 */
export default function MiniBars({ data = [], height = 150 }) {
  if (!data.length) return <p className="empty">Not enough data yet.</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = Math.max(...data.map((d) => d.value));

  return (
    <div className="minibars" style={{ height }}>
      {data.map((d, i) => (
        <div className="minibar-col" key={i}>
          <div
            className={`minibar${d.value === peak ? ' peak' : ''}`}
            style={{ height: `${Math.max(6, (d.value / max) * 100)}%` }}
            title={`${d.label ?? ''}: ${d.value}`}
          />
          {d.label && <span className="minibar-label">{d.label}</span>}
        </div>
      ))}
    </div>
  );
}
