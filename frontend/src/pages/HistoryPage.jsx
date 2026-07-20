import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

const fmtDuration = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;
const fmtDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function HistoryPage() {
  const [meetings, setMeetings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/meetings')
      .then((d) => setMeetings(d.meetings))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="banner error">{error}</div>;
  if (!meetings)
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <h2>Call history</h2>
        <Link to="/call" className="link-button">
          + New coaching session
        </Link>
      </div>
      {meetings.length === 0 ? (
        <div className="empty-state">
          <p>No calls yet. Start your first coaching session and it will show up here with its review.</p>
        </div>
      ) : (
        <div className="list">
          {meetings.map((m) => (
            <Link className="list-row" to={`/history/${m.id}`} key={m.id}>
              <div>
                <div className="list-title">{fmtDate(m.startedAt)}</div>
                <div className="list-sub">
                  {fmtDuration(m.durationSeconds)} · {m.platform}
                </div>
              </div>
              <div className={`score-pill${m.overallScore === null ? ' pending' : ''}`}>
                {m.overallScore === null ? 'review pending' : `${m.overallScore}`}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
