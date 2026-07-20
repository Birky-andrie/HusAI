import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

function FeedbackCard({ feedback }) {
  const [open, setOpen] = useState(true);
  if (!feedback) return null;
  return (
    <div className="feedback-card">
      <button className="feedback-toggle" onClick={() => setOpen((v) => !v)}>
        🧭 Coach feedback {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="feedback-body">
          <p>
            <strong>👍 What worked:</strong> {feedback.didWell}
          </p>
          <p>
            <strong>🔧 To improve:</strong> {feedback.improve}
          </p>
          {feedback.strongerExample && (
            <blockquote>
              <strong>Stronger version:</strong> “{feedback.strongerExample}”
            </blockquote>
          )}
          {feedback.tips?.length > 0 && (
            <ul>
              {feedback.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryPanel({ summary }) {
  if (!summary) return null;
  return (
    <div className="review-panel">
      <h3>Session summary</h3>
      <div className="score-strip">
        {Object.entries(summary.scores).map(([dim, val]) => (
          <div className="score-tile" key={dim}>
            <span className="score-value">{val}</span>
            <span className="score-label">{dim}</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 10 }}>{summary.summary}</p>
      {summary.wins?.length > 0 && (
        <>
          <h3>Wins</h3>
          <ul className="summary-list">
            {summary.wins.map((w, i) => (
              <li key={i}>✅ {w}</li>
            ))}
          </ul>
        </>
      )}
      {summary.focusAreas?.length > 0 && (
        <>
          <h3>Keep practicing</h3>
          <ul className="summary-list">
            {summary.focusAreas.map((f, i) => (
              <li key={i}>🎯 {f}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function PracticeSessionPage() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [turns, setTurns] = useState([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [clientDone, setClientDone] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    api
      .get(`/api/practice/sessions/${id}`)
      .then((d) => {
        setSession(d.session);
        setTurns(d.turns);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, sending]);

  const send = useCallback(
    async (e) => {
      e?.preventDefault();
      const text = draft.trim();
      if (!text || sending) return;
      setSending(true);
      setError('');
      try {
        const result = await api.post(`/api/practice/sessions/${id}/turns`, { text });
        setTurns((prev) => [...prev, result.vaTurn, result.clientTurn]);
        setDraft('');
        if (result.done) setClientDone(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setSending(false);
      }
    },
    [draft, sending, id]
  );

  const endSession = useCallback(async () => {
    setEnding(true);
    setError('');
    try {
      const { session: updated } = await api.post(`/api/practice/sessions/${id}/end`, {});
      setSession(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnding(false);
    }
  }, [id]);

  if (error && !session) return <div className="banner error">{error}</div>;
  if (!session)
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );

  const completed = session.status === 'completed';

  return (
    <div className="page practice-session">
      <div className="page-header">
        <h2>{session.title}</h2>
        <Link to="/practice" className="link-button">
          ← All practice
        </Link>
      </div>

      <div className="scenario-card">
        <span className="chip on">difficulty {session.difficulty}/5</span>
        <p>{session.scenario}</p>
        {session.targetSkills?.length > 0 && (
          <div className="list-sub">Practicing: {session.targetSkills.join(' · ')}</div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="chat" ref={scrollRef}>
        {turns.map((turn) =>
          turn.role === 'client' ? (
            <div className="bubble client" key={turn.id}>
              <span className="bubble-who">Client</span>
              {turn.text}
            </div>
          ) : (
            <div className="turn-group" key={turn.id}>
              <div className="bubble va">
                <span className="bubble-who">You</span>
                {turn.text}
              </div>
              <FeedbackCard feedback={turn.feedback} />
            </div>
          )
        )}
        {sending && <div className="bubble client typing">…</div>}
      </div>

      {completed ? (
        <SummaryPanel summary={session.summary} />
      ) : (
        <>
          {clientDone && (
            <div className="banner info">The client wrapped up the conversation — end the session to get your summary.</div>
          )}
          <form className="chat-input" onSubmit={send}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) send(e);
              }}
              placeholder="Type your reply to the client… (Enter to send, Shift+Enter for a new line)"
              rows={2}
              disabled={sending}
            />
            <div className="chat-actions">
              <button className="primary" type="submit" disabled={sending || !draft.trim()}>
                {sending ? 'Client is replying…' : 'Send'}
              </button>
              <button className="secondary" type="button" onClick={endSession} disabled={ending}>
                {ending ? 'Scoring…' : 'End session'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
