import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function PracticePage() {
  const navigate = useNavigate();
  const [recs, setRecs] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [startingId, setStartingId] = useState('');

  useEffect(() => {
    Promise.all([api.get('/api/practice/recommendations'), api.get('/api/practice/sessions')])
      .then(([r, s]) => {
        setRecs(r.recommendations);
        setSessions(s.sessions);
      })
      .catch((e) => setError(e.message));
  }, []);

  const startFromRec = async (rec) => {
    setStartingId(rec.id);
    try {
      const { session } = await api.post('/api/practice/sessions', { focus: rec.focus });
      navigate(`/practice/${session.id}`);
    } catch (err) {
      setError(err.message);
      setStartingId('');
    }
  };

  if (error && !recs) return <div className="banner error">{error}</div>;
  if (!recs || !sessions)
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );

  const active = sessions.filter((s) => s.status === 'active');
  const completed = sessions.filter((s) => s.status === 'completed');

  return (
    <div className="page">
      <div className="page-header">
        <h2>Practice</h2>
      </div>
      {error && <div className="banner error">{error}</div>}

      <h3 className="section-title">Recommended for you</h3>
      <div className="rec-grid">
        {recs.map((rec) => (
          <div className="rec-card" key={rec.id}>
            <div className="rec-title">{rec.title}</div>
            <p className="rec-reason">{rec.reason}</p>
            <button className="primary" onClick={() => startFromRec(rec)} disabled={Boolean(startingId)}>
              {startingId === rec.id ? 'Setting up…' : 'Start roleplay'}
            </button>
          </div>
        ))}
      </div>

      {active.length > 0 && (
        <>
          <h3 className="section-title">In progress</h3>
          <div className="list">
            {active.map((s) => (
              <Link className="list-row" to={`/practice/${s.id}`} key={s.id}>
                <div>
                  <div className="list-title">{s.title}</div>
                  <div className="list-sub">difficulty {s.difficulty}/5 · started {fmtDate(s.createdAt)}</div>
                </div>
                <span className="score-pill pending">continue</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {completed.length > 0 && (
        <>
          <h3 className="section-title">Completed sessions</h3>
          <div className="list">
            {completed.map((s) => {
              const overall = s.summary
                ? Math.round(
                    (s.summary.scores.confidence +
                      s.summary.scores.clarity +
                      s.summary.scores.conciseness +
                      s.summary.scores.professionalism) /
                      4
                  )
                : null;
              return (
                <Link className="list-row" to={`/practice/${s.id}`} key={s.id}>
                  <div>
                    <div className="list-title">{s.title}</div>
                    <div className="list-sub">difficulty {s.difficulty}/5 · {fmtDate(s.createdAt)}</div>
                  </div>
                  <div className={`score-pill${overall === null ? ' pending' : ''}`}>{overall ?? '—'}</div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
