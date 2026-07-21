import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import DashboardCard from '../components/ui/DashboardCard.jsx';
import ProgressRing from '../components/ui/ProgressRing.jsx';
import MiniBars from '../components/ui/MiniBars.jsx';
import StatTile from '../components/ui/StatTile.jsx';
import Reveal from '../components/ui/Reveal.jsx';

const s = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const IMic = () => (<svg {...s}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>);
const IBook = () => (<svg {...s}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM19 17H6a2 2 0 0 0-2 2" /></svg>);
const IReview = () => (<svg {...s}><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>);
const IBot = () => (<svg {...s}><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4M9 14h.01M15 14h.01M2 13v2M22 13v2" /></svg>);
const IPhone = () => (<svg {...s}><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>);
const IArrow = () => (<svg {...s}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtDur = (n) => `${Math.round(n / 60)} min`;

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/progress/summary'),
      api.get('/api/meetings'),
      api.get('/api/practice/recommendations'),
      api.get('/api/practice/sessions'),
      api.get('/api/progress/history?dimension=overall&limit=7'),
    ])
      .then(([summary, meetings, recs, sessions, history]) =>
        setData({ summary, meetings: meetings.meetings, recs: recs.recommendations, sessions: sessions.sessions, history: history.points })
      )
      .catch((e) => setError(e.message));
  }, []);

  const d = useMemo(() => {
    if (!data) return null;
    const scoreOf = (dim) => data.summary.scores.find((x) => x.dimension === dim) || { current: null, previous: null };
    const rateOf = (dim) => data.summary.rates.find((x) => x.dimension === dim) || { current: null, previous: null };
    const delta = (o) => (o.current !== null && o.previous !== null ? Math.round((o.current - o.previous) * 10) / 10 : null);
    const latestReviewed = data.meetings.find((m) => m.overallScore !== null);
    return {
      confidence: scoreOf('confidence'),
      clarity: scoreOf('clarity'),
      conciseness: scoreOf('conciseness'),
      confidenceDelta: delta(scoreOf('confidence')),
      filler: rateOf('fillerPer100Words'),
      latency: rateOf('responseLatencySeconds'),
      practiceCount: data.summary.totals.practiceSessions,
      recentCalls: data.meetings.slice(0, 4),
      recentPractice: data.sessions.filter((x) => x.status === 'completed').slice(0, 3),
      recs: data.recs.slice(0, 2),
      trends: data.history.map((p) => ({ value: p.value, label: DAY[new Date(p.at).getDay()] })),
      latestReviewLink: latestReviewed ? `/history/${latestReviewed.id}` : '/history',
    };
  }, [data]);

  if (error) return <div className="banner error">{error}</div>;
  if (!d)
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const ringVal = (o) => (o.current !== null ? o.current : 0);

  return (
    <div className="dashboard">
      <div className="dash-greeting">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p>Your communication is sharpening, one call at a time.</p>
        </div>
      </div>

      {/* Quick actions */}
      <Reveal className="dash-quick">
        <Link to="/call" className="quick-action accent">
          <span className="qa-icon"><IMic /></span>
          <span>
            <span className="qa-title">Start a Call</span>
            <span className="qa-sub">Live coaching in real time</span>
          </span>
        </Link>
        <Link to="/practice" className="quick-action">
          <span className="qa-icon"><IBook /></span>
          <span>
            <span className="qa-title">Start Practice</span>
            <span className="qa-sub">Roleplay your weak spots</span>
          </span>
        </Link>
        <Link to={d.latestReviewLink} className="quick-action">
          <span className="qa-icon"><IReview /></span>
          <span>
            <span className="qa-title">Latest Review</span>
            <span className="qa-sub">Revisit your last analysis</span>
          </span>
        </Link>
      </Reveal>

      {/* Performance + feature */}
      <Reveal className="dash-grid">
        <DashboardCard title="Overall Performance" icon={<IReview />}>
          {d.confidence.current === null ? (
            <p className="empty">Finish your first call to see your performance rings.</p>
          ) : (
            <div className="dash-rings">
              <ProgressRing value={ringVal(d.confidence)} label="Confidence" />
              <ProgressRing value={ringVal(d.clarity)} label="Clarity" />
              <ProgressRing value={ringVal(d.conciseness)} label="Conciseness" />
            </div>
          )}
        </DashboardCard>

        <DashboardCard className="dash-feature">
          <span className="df-icon"><IBot /></span>
          <h3>Sharpen your skills</h3>
          <p>Practice an upcoming call with a realistic AI client and real-time feedback.</p>
          <button className="df-btn" onClick={() => navigate('/practice')}>
            Start Session <IArrow />
          </button>
        </DashboardCard>
      </Reveal>

      {/* Trends + recent calls */}
      <Reveal className="dash-grid">
        <DashboardCard title="Progress Trends">
          <MiniBars data={d.trends} />
        </DashboardCard>

        <DashboardCard title="Recent Calls" action={{ to: '/history', label: 'View all' }}>
          {d.recentCalls.length === 0 ? (
            <p className="empty">No calls yet — start one above.</p>
          ) : (
            <div className="dash-list">
              {d.recentCalls.map((m) => (
                <Link className="dash-list-row" to={`/history/${m.id}`} key={m.id}>
                  <span className="dash-list-icon"><IPhone /></span>
                  <span className="dash-list-meta">
                    <span className="dash-list-title">Coaching call</span>
                    <span className="dash-list-sub">{fmtDate(m.startedAt)} · {fmtDur(m.durationSeconds)}</span>
                  </span>
                  <span className={`score-pill${m.overallScore === null ? ' pending' : ''}`}>
                    {m.overallScore === null ? '—' : m.overallScore}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>
      </Reveal>

      {/* Communication metrics */}
      <Reveal className="dash-metrics">
        <StatTile label="Confidence" value={d.confidence.current ?? '—'} unit={d.confidence.current !== null ? '/100' : ''} delta={d.confidenceDelta} />
        <StatTile label="Filler words /100w" value={d.filler.current ?? '—'} delta={d.filler.current !== null && d.filler.previous !== null ? Math.round((d.filler.current - d.filler.previous) * 10) / 10 : null} downIsGood />
        <StatTile label="Response time" value={d.latency.current ?? '—'} unit={d.latency.current !== null ? 's' : ''} delta={d.latency.current !== null && d.latency.previous !== null ? Math.round((d.latency.current - d.latency.previous) * 10) / 10 : null} downIsGood />
        <StatTile label="Practice sessions" value={d.practiceCount} delta={null} />
      </Reveal>

      {/* Recommendations + recent practice */}
      <Reveal className="dash-grid">
        <DashboardCard title="Practice Recommendations" action={{ to: '/practice', label: 'All practice' }}>
          {d.recs.length === 0 ? (
            <p className="empty">Complete a call and HusAI will tailor practice for you.</p>
          ) : (
            <div className="dash-list">
              {d.recs.map((r) => (
                <Link className="dash-list-row" to="/practice" key={r.id}>
                  <span className="dash-list-icon"><IBook /></span>
                  <span className="dash-list-meta">
                    <span className="dash-list-title">{r.title}</span>
                    <span className="dash-list-sub">{r.reason}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Recent Practice" action={{ to: '/practice', label: 'View all' }}>
          {d.recentPractice.length === 0 ? (
            <p className="empty">No completed practice sessions yet.</p>
          ) : (
            <div className="dash-list">
              {d.recentPractice.map((p) => (
                <Link className="dash-list-row" to={`/practice/${p.id}`} key={p.id}>
                  <span className="dash-list-icon"><IBook /></span>
                  <span className="dash-list-meta">
                    <span className="dash-list-title">{p.title}</span>
                    <span className="dash-list-sub">Difficulty {p.difficulty}/5 · {fmtDate(p.createdAt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </DashboardCard>
      </Reveal>
    </div>
  );
}
