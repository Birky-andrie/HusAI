import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import ReviewDashboard from '../components/ReviewDashboard.jsx';

/**
 * Milliseconds from the call start as "m:ss" (or "h:mm:ss" past an hour).
 * Offsets, not clock times: what matters when re-reading a call is how far in
 * something was said, and an offset also avoids exposing when the user works.
 */
function formatOffset(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function HistoryDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    api
      .get(`/api/meetings/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  const retryReview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError('');
    try {
      const result = await api.post(`/api/meetings/${id}/review`, {});
      setData((prev) => ({ ...prev, review: result.review }));
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewLoading(false);
    }
  }, [id]);

  if (error) return <div className="banner error">{error}</div>;
  if (!data)
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <h2>Call from {new Date(data.meeting.startedAt).toLocaleString()}</h2>
        <Link to="/history" className="link-button">
          ← All calls
        </Link>
      </div>

      {data.review ? (
        <ReviewDashboard review={data.review} loading={false} error="" onRetry={retryReview} onClose={() => {}} />
      ) : (
        <div className="review-panel">
          <div className="review-error">
            {reviewLoading ? (
              <div className="spinner" />
            ) : (
              <>
                <p>{reviewError || 'The review for this call has not been generated yet.'}</p>
                <button onClick={retryReview}>Generate review</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="transcript-panel" style={{ marginTop: 16 }}>
        <h3>
          Transcript{' '}
          <button className="secondary chip-button" onClick={() => setShowTranscript((v) => !v)}>
            {showTranscript ? 'hide' : 'show'}
          </button>
        </h3>
        {showTranscript && data.meeting.transcript.includes('Client') && (
          <p className="capture-note">
            Everyone on the client&apos;s end shares one audio channel, so “Client side” lines may be
            more than one participant.
          </p>
        )}
        {showTranscript &&
          // Meetings recorded before timestamps were stored have no timedLines,
          // so the plain-text path below stays as the fallback rather than
          // being replaced — old calls still render, just without times.
          (data.meeting.timedLines?.length ? (
            <div className="transcript-lines timed">
              {data.meeting.timedLines.map((line, i) => (
                <p key={i} className={`line ${line.speaker === 'client' ? 'client' : 'va'}`}>
                  <time className="line-time" dateTime={`PT${Math.round(line.t / 1000)}S`}>
                    {formatOffset(line.t)}
                  </time>
                  <span className="line-who">{line.speaker === 'client' ? 'Client side' : 'VA'}</span>
                  <span className="line-text">{line.text}</span>
                </p>
              ))}
            </div>
          ) : (
            <div className="transcript-lines">
              {/* startsWith('Client') matches both "Client side:" and the legacy "Client:" prefix. */}
              {data.meeting.transcript.split('\n').map((line, i) => (
                <p key={i} className={`line ${line.startsWith('Client') ? 'client' : 'va'}`}>
                  {line}
                </p>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
