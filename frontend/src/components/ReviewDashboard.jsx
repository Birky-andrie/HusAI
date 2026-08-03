import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

/**
 * The four scored dimensions, in display order. 'Overall' is deliberately not
 * here: it is the average of these, so it has no rationale of its own to open.
 */
const DIMENSIONS = [
  ['Confidence', 'confidence'],
  ['Clarity', 'clarity'],
  ['Conciseness', 'conciseness'],
  ['Professionalism', 'professionalism'],
];

/**
 * A score with its "why did I get this" breakdown.
 *
 * Only dimensions that actually have a breakdown are interactive. Reviews
 * generated before scoreDetails existed have none, and the model can omit one,
 * so a tile that cannot explain itself stays a plain tile rather than opening
 * an empty panel — nothing is worse than a disclosure that discloses nothing.
 */
function ScoreStrip({ overallScore, scores, scoreDetails }) {
  const [openDim, setOpenDim] = useState(null);
  if (!scores) return null;

  const detail = openDim ? scoreDetails?.[openDim] : null;

  return (
    <>
      <div className="score-strip">
        <div className="score-tile overall">
          <span className="score-value">{overallScore ?? '—'}</span>
          <span className="score-label">Overall</span>
        </div>

        {DIMENSIONS.map(([label, key]) => {
          const value = scores[key];
          const expandable = Boolean(scoreDetails?.[key]);
          const open = openDim === key;

          if (!expandable) {
            return (
              <div className="score-tile" key={key}>
                <span className="score-value">{value ?? '—'}</span>
                <span className="score-label">{label}</span>
              </div>
            );
          }

          return (
            <button
              type="button"
              className={`score-tile expandable${open ? ' open' : ''}`}
              key={key}
              onClick={() => setOpenDim(open ? null : key)}
              aria-expanded={open}
              aria-controls="score-detail-panel"
            >
              <span className="score-value">{value ?? '—'}</span>
              <span className="score-label">{label}</span>
              <span className="score-why">{open ? 'Hide' : 'Why?'}</span>
            </button>
          );
        })}
      </div>

      {detail && (
        <div className="score-detail" id="score-detail-panel">
          <h4>Why you scored {scores[openDim]} on {openDim}</h4>
          <p>{detail.reason}</p>

          {detail.evidence?.length > 0 && (
            <>
              <h5>From your own words</h5>
              <ul className="score-evidence">
                {detail.evidence.map((quote, i) => (
                  <li key={i}>“{quote}”</li>
                ))}
              </ul>
            </>
          )}

          <p className="score-improve">
            <strong>Next call:</strong> {detail.improve}
          </p>
        </div>
      )}
    </>
  );
}

export default function ReviewDashboard({ review, loading, error, onRetry, onClose }) {
  const navigate = useNavigate();
  const [startingPractice, setStartingPractice] = useState(false);

  const startPractice = async () => {
    if (!review?.id || startingPractice) return;
    setStartingPractice(true);
    try {
      const { session } = await api.post('/api/practice/sessions', { reviewId: review.id });
      navigate(`/practice/${session.id}`);
    } catch (err) {
      console.warn('practice start failed:', err.message);
      setStartingPractice(false);
    }
  };

  if (loading) {
    return (
      <div className="review-panel">
        <div className="review-loading">
          <div className="spinner" />
          <p>Analyzing your call… this can take a few seconds on longer calls.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="review-panel">
        <div className="review-error">
          <p>{error}</p>
          <button onClick={onRetry}>Try again</button>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!review) return null;

  return (
    <div className="review-panel">
      <div className="review-header">
        <h2>Call Review</h2>
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      </div>

      <ScoreStrip
        overallScore={review.overallScore}
        scores={review.scores}
        scoreDetails={review.scoreDetails}
      />

      <h3>What we noticed</h3>
      <div className="insight-list">
        {review.insights.map((insight, i) => (
          <div className="insight-card" key={i}>
            <div className="insight-pattern">{insight.pattern}</div>
            <blockquote>“{insight.evidence}”</blockquote>
            <p>{insight.explanation}</p>
          </div>
        ))}
      </div>

      <h3>Practice exercises</h3>
      <div className="exercise-list">
        {review.roleplayExercises.map((exercise, i) => (
          <div className="exercise-card" key={i}>
            <div className="exercise-title">🎭 {exercise.title}</div>
            <p>{exercise.scenario}</p>
            <div className="exercise-skill">Target skill: {exercise.targetSkill}</div>
          </div>
        ))}
      </div>

      {review.id && (
        <div className="review-actions">
          <button className="primary" onClick={startPractice} disabled={startingPractice}>
            {startingPractice ? 'Setting up your roleplay…' : '🎯 Practice these patterns now'}
          </button>
        </div>
      )}
    </div>
  );
}
