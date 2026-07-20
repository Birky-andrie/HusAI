import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import ReviewDashboard from '../components/ReviewDashboard.jsx';

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
        {showTranscript && (
          <div className="transcript-lines">
            {data.meeting.transcript.split('\n').map((line, i) => (
              <p key={i} className={`line ${line.startsWith('Client:') ? 'client' : 'va'}`}>
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
