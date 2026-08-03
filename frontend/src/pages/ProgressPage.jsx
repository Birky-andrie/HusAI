import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

/**
 * Progress dashboard: KPI row of stat tiles (current vs previous, delta colored
 * by direction × whether up is good) + a single-series trend line per selected
 * dimension. Inline SVG per the dataviz method: 2px line, ≥8px markers with a
 * 2px surface ring, 10%-opacity area wash, hairline gridlines, endpoint-only
 * direct label, crosshair+tooltip hover, and a table view for accessibility.
 * Violet line hue on the dark slate surface, matching the brand theme.
 */

const LINE = '#8b5cf6';
const SURFACE = '#14161f';
const GRID = 'rgba(255,255,255,0.08)';

const SCORE_LABELS = {
  overall: 'Overall',
  confidence: 'Confidence',
  clarity: 'Clarity',
  conciseness: 'Conciseness',
  professionalism: 'Professionalism',
};
// For these, DOWN is improvement.
const RATE_LABELS = {
  fillerPer100Words: 'Fillers /100 words',
  apologyPer100Words: 'Apologies /100 words',
  hedgePer100Words: 'Hedges /100 words',
  responseLatencySeconds: 'Response time (s)',
};

/**
 * What each number actually measures. The tile shows a figure; this says what
 * the figure is *about* — without it, "Conciseness 64" is a score with no
 * stated criterion, which is the main thing users distrust about AI scoring.
 */
const DIMENSION_HELP = {
  overall: 'The average of your four communication scores for each call or practice session.',
  confidence: 'Assertive, self-assured delivery — scored down by excessive hedging or apologising.',
  clarity: 'How easy you are to follow, and whether your main point lands plainly and early.',
  conciseness: 'Saying what is needed without rambling or filler.',
  professionalism: 'Warm, courteous, client-appropriate tone and follow-through.',
  fillerPer100Words: 'Filler words ("um", "like", "you know") per 100 words you spoke.',
  apologyPer100Words: 'How often you apologised, per 100 words you spoke.',
  hedgePer100Words: 'Hedging phrases ("maybe", "I think", "if that\'s okay") per 100 words.',
  responseLatencySeconds: 'Average seconds between the client finishing and you replying.',
};

function Delta({ current, previous, downIsGood }) {
  if (current === null || previous === null) return <span className="delta muted">vs previous: —</span>;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return <span className="delta muted">no change</span>;
  const improved = downIsGood ? diff < 0 : diff > 0;
  return (
    <span className={`delta ${improved ? 'good' : 'bad'}`}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)} vs previous
    </span>
  );
}

/**
 * The "why is my score this number" panel behind a stat tile.
 *
 * Deliberately shows the individual data points rather than only restating the
 * average: a 62 made of five mediocre calls and a 62 made of one disaster
 * among four strong calls call for completely different responses, and the
 * average alone hides which one you are looking at.
 */
function StatBreakdown({ dimension, label, isScore }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api
      .get(`/api/progress/breakdown?dimension=${encodeURIComponent(dimension)}`)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [dimension]);

  if (error) return <div className="banner error">{error}</div>;
  if (!data)
    return (
      <div className="stat-breakdown">
        <div className="spinner" />
      </div>
    );

  const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const avgOf = (rows) =>
    rows.length ? Math.round((rows.reduce((s, r) => s + r.value, 0) / rows.length) * 10) / 10 : null;

  const row = (p, i) => (
    <li key={`${p.refId}-${i}`}>
      <span className="bd-value">{p.value}</span>
      <span className="bd-meta">
        {p.source === 'call' ? 'Call' : 'Practice'} · {fmt(p.at)}
      </span>
      {p.linkable ? (
        <Link to={p.source === 'call' ? `/history/${p.refId}` : `/practice/${p.refId}`}>View</Link>
      ) : (
        <span className="bd-gone">deleted</span>
      )}
    </li>
  );

  return (
    <div className="stat-breakdown">
      <p className="bd-help">{DIMENSION_HELP[dimension]}</p>

      <h4>
        How this {isScore ? 'score' : 'figure'} is calculated
      </h4>
      <p className="bd-formula">
        The average of your {data.contributing.length} most recent
        {data.contributing.length === 1 ? ' result' : ' results'}
        {data.totalDataPoints > data.contributing.length && (
          <> — out of {data.totalDataPoints} recorded in total</>
        )}
        .
      </p>

      {data.contributing.length === 0 ? (
        <p className="bd-formula">No data points yet.</p>
      ) : (
        <>
          <h5>
            Counting toward it now{avgOf(data.contributing) !== null && <> — average {avgOf(data.contributing)}</>}
          </h5>
          <ul className="bd-list">{data.contributing.map(row)}</ul>
        </>
      )}

      {data.previous.length > 0 && (
        <>
          <h5>
            Compared against{avgOf(data.previous) !== null && <> — average {avgOf(data.previous)}</>}
          </h5>
          <ul className="bd-list muted">{data.previous.map(row)}</ul>
          <p className="bd-formula">
            The arrow on the tile is the difference between these two averages.
          </p>
        </>
      )}
    </div>
  );
}

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (v <= m * pow) return m * pow;
  return 10 * pow;
}

function TrendChart({ points, isScore, label }) {
  const [hover, setHover] = useState(null); // index
  const wrapRef = useRef(null);

  const W = 720;
  const H = 240;
  const pad = { l: 40, r: 56, t: 12, b: 26 };

  const { xs, ys, ticks, yMax } = useMemo(() => {
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const yMax = isScore ? 100 : niceMax(Math.max(...points.map((p) => p.value)));
    const tickVals = isScore ? [0, 25, 50, 75, 100] : [0, yMax / 2, yMax];
    const x = (i) => pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v) => pad.t + innerH - (v / yMax) * innerH;
    return {
      xs: points.map((_, i) => x(i)),
      ys: points.map((p) => y(p.value)),
      ticks: tickVals.map((v) => ({ v, y: y(v) })),
      yMax,
    };
  }, [points, isScore]);

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const area = `${path} L${xs[xs.length - 1]},${H - pad.b} L${xs[0]},${H - pad.b} Z`;

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i;
    setHover(best);
  };

  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="trend-chart"
        role="img"
        aria-label={`${label} trend, ${points.length} data points`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke={GRID} strokeWidth="1" />
            <text x={pad.l - 8} y={t.y + 3} textAnchor="end" className="tick-label">
              {t.v}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 8} className="tick-label">
          {fmtDate(points[0].at)}
        </text>
        <text x={W - pad.r} y={H - 8} textAnchor="end" className="tick-label">
          {fmtDate(points[points.length - 1].at)}
        </text>

        <path d={area} fill={LINE} opacity="0.1" />
        <path d={path} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && (
          <line x1={xs[hover]} x2={xs[hover]} y1={pad.t} y2={H - pad.b} stroke={GRID} strokeWidth="1" />
        )}

        {points.map((p, i) => (
          <circle key={i} cx={xs[i]} cy={ys[i]} r={hover === i ? 5.5 : 4} fill={LINE} stroke={SURFACE} strokeWidth="2" />
        ))}

        {/* endpoint-only direct label */}
        <text x={xs[xs.length - 1] + 10} y={ys[ys.length - 1] + 4} className="end-label">
          {points[points.length - 1].value}
        </text>

        {/* transparent hover hit layer */}
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="transparent" />
      </svg>
      {hover !== null && (
        <div className="chart-tooltip" style={{ left: `${(xs[hover] / W) * 100}%` }}>
          <div className="tooltip-value">{points[hover].value}{isScore ? ` / ${yMax}` : ''}</div>
          <div className="tooltip-sub">
            {fmtDate(points[hover].at)} · {points[hover].source === 'call' ? 'real call' : 'practice'}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProgressPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [dimension, setDimension] = useState('overall');
  const [history, setHistory] = useState(null);
  const [showTable, setShowTable] = useState(false);
  // Which stat tile has its "why is this number what it is" panel open.
  const [openStat, setOpenStat] = useState(null);

  useEffect(() => {
    api
      .get('/api/progress/summary')
      .then(setSummary)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setHistory(null);
    api
      .get(`/api/progress/history?dimension=${encodeURIComponent(dimension)}`)
      .then((d) => setHistory(d.points))
      .catch((e) => setError(e.message));
  }, [dimension]);

  if (error) return <div className="banner error">{error}</div>;
  if (!summary)
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );

  const hasData = summary.scores.some((s) => s.dataPoints > 0);
  const isScoreDim = dimension in SCORE_LABELS;
  const availableDims = [
    ...summary.scores.filter((s) => s.dataPoints > 0).map((s) => s.dimension),
    ...summary.rates.map((r) => r.dimension),
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2>Progress</h2>
        <span className="list-sub">
          {summary.totals.calls} call{summary.totals.calls === 1 ? '' : 's'} · {summary.totals.practiceSessions} practice
          session{summary.totals.practiceSessions === 1 ? '' : 's'}
        </span>
      </div>

      {!hasData ? (
        <div className="empty-state">
          <p>
            No data yet. Finish a coached call or a practice session and your communication scores will start
            trending here.
          </p>
        </div>
      ) : (
        <>
          <div className="tile-row">
            {[
              ...summary.scores.filter((s) => s.dataPoints > 0).map((s) => ({ ...s, downIsGood: false })),
              ...summary.rates.map((r) => ({ ...r, downIsGood: true })),
            ].map((s) => {
              const label = SCORE_LABELS[s.dimension] || RATE_LABELS[s.dimension] || s.dimension;
              const open = openStat === s.dimension;
              return (
                <button
                  type="button"
                  className={`stat-tile expandable${open ? ' open' : ''}`}
                  key={s.dimension}
                  onClick={() => setOpenStat(open ? null : s.dimension)}
                  aria-expanded={open}
                  aria-controls="stat-breakdown-panel"
                >
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">{s.current ?? '—'}</span>
                  <Delta current={s.current} previous={s.previous} downIsGood={s.downIsGood} />
                  <span className="stat-why">{open ? 'Hide' : 'Why?'}</span>
                </button>
              );
            })}
          </div>

          {openStat && (
            <div id="stat-breakdown-panel">
              <StatBreakdown
                dimension={openStat}
                label={SCORE_LABELS[openStat] || RATE_LABELS[openStat] || openStat}
                isScore={openStat in SCORE_LABELS}
              />
            </div>
          )}

          <div className="chart-panel">
            <div className="chart-controls">
              <label>
                Trend:{' '}
                <select value={dimension} onChange={(e) => setDimension(e.target.value)}>
                  {availableDims.map((d) => (
                    <option value={d} key={d}>
                      {SCORE_LABELS[d] || RATE_LABELS[d] || d}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary chip-button" onClick={() => setShowTable((v) => !v)}>
                {showTable ? 'chart view' : 'table view'}
              </button>
            </div>

            {!history ? (
              <div className="page-loading">
                <div className="spinner" />
              </div>
            ) : history.length === 0 ? (
              <div className="empty-state">
                <p>No data points for this dimension yet.</p>
              </div>
            ) : showTable ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Source</th>
                      <th>{SCORE_LABELS[dimension] || RATE_LABELS[dimension]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((p, i) => (
                      <tr key={i}>
                        <td>{new Date(p.at).toLocaleString()}</td>
                        <td>{p.source === 'call' ? 'Real call' : 'Practice'}</td>
                        <td className="num">{p.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <TrendChart points={history} isScore={isScoreDim} label={SCORE_LABELS[dimension] || RATE_LABELS[dimension]} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
